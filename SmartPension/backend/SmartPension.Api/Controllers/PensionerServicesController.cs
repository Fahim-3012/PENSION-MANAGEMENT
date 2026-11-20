using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers;

[Route("api/life-verification")]
[Authorize(Policy = Policies.PensionerOnly)]
public class LifeVerificationController : PensionerControllerBase
{
    private readonly PensionService _pension;
    private readonly FileStorageService _files;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;
    private readonly SettingsService _settings;

    public LifeVerificationController(AppDbContext db, PensionService pension, FileStorageService files,
        AuditService audit, NotificationService notify, SettingsService settings) : base(db)
    {
        _pension = pension; _files = files; _audit = audit; _notify = notify; _settings = settings;
    }

    [HttpGet]
    public async Task<ActionResult<LifeStatusDto>> Status()
    {
        var p = await GetPensionerAsync();
        var (state, until) = await _pension.GetLifeStateAsync(p.Id);
        var history = await Db.LifeVerifications.Where(l => l.PensionerId == p.Id)
            .OrderByDescending(l => l.SubmittedAt).Take(20).ToListAsync();
        var threshold = (double)await _settings.GetDecimalAsync(SettingKeys.FaceMatchThreshold, 0.5m);
        return Ok(new LifeStatusDto(state, until, history.FirstOrDefault()?.ToDto(), history.Select(h => h.ToDto()).ToList(),
            p.FaceDescriptor != null, p.FaceEnrolledAt, threshold));
    }

    /// <summary>
    /// AI face verification (demo). The browser runs face-api.js neural networks: face detection, 68 landmarks,
    /// a blink / head-turn liveness challenge and a 128-number face descriptor. The SERVER compares that
    /// descriptor with the enrolled one (Euclidean distance) and decides. The first successful capture enrols the face.
    /// Limitation: liveness runs in the browser, so a determined attacker could fake it; production needs a
    /// server-side liveness provider and a reference photo from an official source (e.g. the NID photo).
    /// </summary>
    [HttpPost("face")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<FaceResultDto>> Face([FromForm] IFormFile photo, [FromForm] FaceVerifyForm form)
    {
        var p = await GetPensionerAsync();
        if (p.Status != PensionerStatus.Active && p.Status != PensionerStatus.Pending)
            throw new AppException("Life verification is not available for this account status.");

        double[] live;
        try { live = JsonSerializer.Deserialize<double[]>(form.Descriptor) ?? Array.Empty<double>(); }
        catch (JsonException) { throw new AppException("The face data could not be read. Please try again."); }
        if (live.Length != 128 || live.Any(v => double.IsNaN(v) || double.IsInfinity(v) || Math.Abs(v) > 1.5))
            throw new AppException("The face data is not valid. Please try again.");

        var (path, contentType) = await _files.SaveImageAsync(photo, "life");
        var now = DateTime.UtcNow;
        var months = await _settings.GetIntAsync(SettingKeys.LifeVerificationValidityMonths, 12);
        var threshold = (double)await _settings.GetDecimalAsync(SettingKeys.FaceMatchThreshold, 0.5m);
        var lv = new LifeVerification
        {
            PensionerId = p.Id, PhotoPath = path, PhotoContentType = contentType, SubmittedAt = now,
            LivenessPassed = form.LivenessPassed, LivenessChallenge = form.Challenge
        };

        string outcome, message;
        double? distance = null;

        if (p.FaceDescriptor == null)
        {
            if (!form.LivenessPassed) throw new AppException("The liveness challenge was not completed. Please try again.");
            p.FaceDescriptor = JsonSerializer.Serialize(live);
            p.FaceEnrolledAt = now;
            p.FacePhotoPath = path;
            lv.Method = "AI-Enrollment";
            lv.Status = LifeVerificationStatus.Approved;
            lv.ReviewedAt = now;
            lv.ValidUntil = now.AddMonths(months);
            outcome = "Enrolled";
            message = "Your face is enrolled and your life verification is approved.";
        }
        else
        {
            var reference = JsonSerializer.Deserialize<double[]>(p.FaceDescriptor) ?? Array.Empty<double>();
            if (reference.Length != 128) throw new AppException("Your enrolled face data is damaged. Ask the office to reset it.", 409);
            distance = Math.Round(Math.Sqrt(reference.Zip(live, (a, b) => (a - b) * (a - b)).Sum()), 4);
            lv.MatchDistance = distance;
            lv.ReviewedAt = now;

            if (form.LivenessPassed && distance <= threshold)
            {
                lv.Method = "AI";
                lv.Status = LifeVerificationStatus.Approved;
                lv.ValidUntil = now.AddMonths(months);
                outcome = "Verified";
                message = "Face matched. Your life verification is approved.";
                // A successful AI check replaces any photo still waiting for manual review.
                foreach (var pending in await Db.LifeVerifications
                             .Where(x => x.PensionerId == p.Id && x.Status == LifeVerificationStatus.Pending).ToListAsync())
                {
                    pending.Status = LifeVerificationStatus.Rejected;
                    pending.RejectionReason = "Replaced by a successful AI face verification.";
                    pending.ReviewedAt = now;
                }
            }
            else
            {
                lv.Method = "AI-Failed";
                lv.Status = LifeVerificationStatus.Rejected;
                lv.RejectionReason = !form.LivenessPassed
                    ? "AI: the liveness challenge was not completed."
                    : $"AI: face did not match the enrolled face (distance {distance:0.000}, limit {threshold:0.00}).";
                outcome = form.LivenessPassed ? "NotMatched" : "LivenessFailed";
                message = form.LivenessPassed
                    ? "The face did not match your enrolled face. Try again in good light, or send a photo for manual review."
                    : "The liveness challenge was not completed. Please try again.";
            }
        }

        Db.LifeVerifications.Add(lv);
        await Db.SaveChangesAsync();
        _audit.Log($"LifeVerification.{lv.Method}", nameof(LifeVerification), lv.Id.ToString(),
            distance is null ? "face enrolled" : $"distance {distance:0.000} / limit {threshold:0.00}, liveness {(form.LivenessPassed ? "passed" : "failed")}");
        if (lv.Status == LifeVerificationStatus.Approved)
            _notify.Notify(p.UserId, "Life verification approved", $"AI face verification passed. Valid until {lv.ValidUntil:dd MMM yyyy}.",
                "জীবিত যাচাই অনুমোদিত", $"এআই মুখ যাচাই সফল হয়েছে। {lv.ValidUntil:dd MMM yyyy} পর্যন্ত বৈধ।", "success", "/app/life-verification");
        await Db.SaveChangesAsync();

        return Ok(new FaceResultDto(outcome, distance, threshold, message, lv.ToDto()));
    }

    /// <summary>
    /// Uploads a live camera photo for MANUAL review by an administrator.
    /// No automated face-matching or NID-database check is performed by this system.
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<LifeVerificationDto>> Submit(IFormFile photo)
    {
        var p = await GetPensionerAsync();
        if (p.Status != PensionerStatus.Active && p.Status != PensionerStatus.Pending)
            throw new AppException("Life verification is not available for this account status.");
        if (await Db.LifeVerifications.AnyAsync(l => l.PensionerId == p.Id && l.Status == LifeVerificationStatus.Pending))
            throw new AppException("You already have a verification waiting for review.");

        var (path, contentType) = await _files.SaveImageAsync(photo, "life");
        var lv = new LifeVerification { PensionerId = p.Id, PhotoPath = path, PhotoContentType = contentType };
        Db.LifeVerifications.Add(lv);
        await Db.SaveChangesAsync();

        _audit.Log("LifeVerification.Submitted", nameof(LifeVerification), lv.Id.ToString());
        _notify.Notify(p.UserId, "Life verification submitted", "Your photo was submitted and will be reviewed by an administrator.",
            "জীবিত যাচাই জমা হয়েছে", "আপনার ছবি জমা হয়েছে, প্রশাসক পর্যালোচনা করবেন।", "info", "/app/life-verification");
        await _notify.NotifyAdminsAsync("Life verification submitted", $"{p.FullName} submitted a life verification photo.", "/admin/life-verifications");
        await Db.SaveChangesAsync();
        return Ok(lv.ToDto());
    }

    [HttpGet("{id:int}/photo")]
    public async Task<IActionResult> Photo(int id)
    {
        var p = await GetPensionerAsync();
        var lv = await Db.LifeVerifications.FirstOrDefaultAsync(l => l.Id == id && l.PensionerId == p.Id)
            ?? throw new AppException("Not found.", 404);
        var stream = _files.OpenRead(lv.PhotoPath) ?? throw new AppException("Photo file is missing.", 404);
        return File(stream, lv.PhotoContentType);
    }
}

[Route("api/statements")]
[Authorize(Policy = Policies.PensionerOnly)]
public class StatementsController : PensionerControllerBase
{
    private readonly PdfService _pdf;
    private readonly AuditService _audit;

    public StatementsController(AppDbContext db, PdfService pdf, AuditService audit) : base(db)
    {
        _pdf = pdf; _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<StatementDto>> Get([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        => Ok(await BuildAsync((await GetPensionerAsync()).Id, from, to));

    [HttpGet("pdf")]
    public async Task<IActionResult> Pdf([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var p = await GetPensionerAsync();
        var s = await BuildAsync(p.Id, from, to);
        var bytes = _pdf.Statement(p, s);
        _audit.Log("Statement.Downloaded", nameof(Pensioner), p.Id.ToString(), $"{s.From:yyyy-MM-dd} to {s.To:yyyy-MM-dd}");
        await Db.SaveChangesAsync();
        return File(bytes, "application/pdf", $"pension-statement-{s.From:yyyyMMdd}-{s.To:yyyyMMdd}.pdf");
    }

    private async Task<StatementDto> BuildAsync(int pensionerId, DateTime? from, DateTime? to)
    {
        var end = (to ?? DateTime.UtcNow).Date;
        var start = (from ?? end.AddMonths(-6)).Date;
        if (start > end) throw new AppException("'From' date must be before 'To' date.");
        if ((end - start).TotalDays > 366 * 3) throw new AppException("Please choose a period of 3 years or less.");

        var before = await Db.Transactions.Where(t => t.PensionerId == pensionerId && t.CreatedAt < start)
            .OrderByDescending(t => t.CreatedAt).ThenByDescending(t => t.Id).Select(t => (decimal?)t.BalanceAfter).FirstOrDefaultAsync();
        var txs = await Db.Transactions.Where(t => t.PensionerId == pensionerId && t.CreatedAt >= start && t.CreatedAt < end.AddDays(1))
            .OrderBy(t => t.CreatedAt).ThenBy(t => t.Id).ToListAsync();
        var opening = before ?? 0;
        var credit = txs.Where(t => t.Type == TransactionType.Credit).Sum(t => t.Amount);
        var debit = txs.Where(t => t.Type == TransactionType.Debit).Sum(t => t.Amount);
        return new StatementDto(start, end, opening, credit, debit, opening + credit - debit, txs.Select(t => t.ToDto()).ToList());
    }
}

[Route("api/complaints")]
[Authorize(Policy = Policies.PensionerOnly)]
public class ComplaintsController : PensionerControllerBase
{
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public ComplaintsController(AppDbContext db, AuditService audit, NotificationService notify) : base(db)
    {
        _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ComplaintDto>>> List()
    {
        var p = await GetPensionerAsync();
        var list = await Db.Complaints.Where(c => c.PensionerId == p.Id).OrderByDescending(c => c.CreatedAt).ToListAsync();
        return Ok(list.Select(c => c.ToDto()));
    }

    [HttpPost]
    public async Task<ActionResult<ComplaintDto>> Create(ComplaintRequest req)
    {
        var p = await GetPensionerAsync();
        var c = new Complaint
        {
            PensionerId = p.Id, Category = req.Category.Trim(), Subject = req.Subject.Trim(), Message = req.Message.Trim()
        };
        Db.Complaints.Add(c);
        await Db.SaveChangesAsync();
        _audit.Log("Complaint.Created", nameof(Complaint), c.Id.ToString(), c.Subject);
        await _notify.NotifyAdminsAsync("New support request", $"{p.FullName}: {c.Subject}", "/admin/complaints");
        await Db.SaveChangesAsync();
        return Ok(c.ToDto());
    }
}

[Route("api/assistant")]
[Authorize(Policy = Policies.PensionerOnly)]
public class AssistantController : ApiControllerBase
{
    private readonly AssistantService _assistant;
    public AssistantController(AssistantService assistant) => _assistant = assistant;

    [HttpPost("chat")]
    public async Task<ActionResult<AssistantReply>> Chat(AssistantRequest req)
        => Ok(await _assistant.ReplyAsync(CurrentUserId, req.Message, req.Language));
}

[Route("api/notifications")]
[Authorize]
public class NotificationsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public NotificationsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<PagedResult<NotificationDto>>> List([FromQuery] PageQuery q, [FromQuery] bool unreadOnly = false)
    {
        var query = _db.Notifications.Where(n => n.UserId == CurrentUserId);
        if (unreadOnly) query = query.Where(n => !n.IsRead);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(n => n.Title.Contains(s) || n.Message.Contains(s));
        }
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.OrderByDescending(n => n.CreatedAt).Skip(skip).Take(take).ToListAsync();
        return Ok(new PagedResult<NotificationDto>(items.Select(n => n.ToDto()).ToList(), total, q.Page, q.PageSize));
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<object>> UnreadCount()
        => Ok(new { count = await _db.Notifications.CountAsync(n => n.UserId == CurrentUserId && !n.IsRead) });

    [HttpPost("{id:int}/read")]
    public async Task<ActionResult<MessageResponse>> MarkRead(int id)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId)
            ?? throw new AppException("Notification not found.", 404);
        n.IsRead = true;
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Marked as read."));
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<MessageResponse>> MarkAllRead()
    {
        await _db.Notifications.Where(n => n.UserId == CurrentUserId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
        return Ok(new MessageResponse("All notifications marked as read."));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<MessageResponse>> Delete(int id)
    {
        var n = await _db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId)
            ?? throw new AppException("Notification not found.", 404);
        _db.Notifications.Remove(n);
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Notification deleted."));
    }
}
