using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers.Admin;

[Route("api/admin/nominees")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminNomineesController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public AdminNomineesController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminNomineeItem>>> List([FromQuery] PageQuery q)
    {
        var query = _db.Nominees.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(n => n.FullName.Contains(s) || n.Pensioner!.FullName.Contains(s)
                || (n.Pensioner.PensionId != null && n.Pensioner.PensionId.Contains(s)) || n.Relationship.Contains(s));
        }
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.OrderByDescending(n => n.CreatedAt).Skip(skip).Take(take)
            .Select(n => new AdminNomineeItem(n.Id, n.PensionerId, n.Pensioner!.PensionId, n.Pensioner.FullName, n.FullName,
                n.Relationship, n.NidNumber, n.Phone, n.SharePercentage, n.CreatedAt)).ToListAsync();
        return Ok(new PagedResult<AdminNomineeItem>(items, total, q.Page, q.PageSize));
    }
}

[Route("api/admin/complaints")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminComplaintsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public AdminComplaintsController(AppDbContext db, AuditService audit, NotificationService notify)
    {
        _db = db; _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ComplaintDto>>> List([FromQuery] PageQuery q)
    {
        var query = _db.Complaints.Include(c => c.Pensioner).AsQueryable();
        if (ParseEnum<ComplaintStatus>(q.Status) is { } st) query = query.Where(c => c.Status == st);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(c => c.Subject.Contains(s) || c.Pensioner!.FullName.Contains(s) || c.Category.Contains(s));
        }
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.OrderByDescending(c => c.CreatedAt).Skip(skip).Take(take).ToListAsync();
        return Ok(new PagedResult<ComplaintDto>(items.Select(c => c.ToDto()).ToList(), total, q.Page, q.PageSize));
    }

    [HttpPost("{id:int}/respond")]
    public async Task<ActionResult<ComplaintDto>> Respond(int id, RespondComplaintRequest req)
    {
        var c = await _db.Complaints.Include(x => x.Pensioner).FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new AppException("Complaint not found.", 404);
        c.AdminResponse = req.Response.Trim();
        c.Status = req.Status!.Value;
        c.RespondedById = CurrentUserId;
        c.UpdatedAt = DateTime.UtcNow;
        _audit.Log("Complaint.Responded", nameof(Complaint), id.ToString(), $"Status {c.Status}");
        _notify.Notify(c.Pensioner!.UserId, "Support request updated", $"\"{c.Subject}\" – {c.Status}: {c.AdminResponse}",
            "সহায়তা অনুরোধ হালনাগাদ", $"\"{c.Subject}\" – উত্তর: {c.AdminResponse}", "info", "/app/support");
        await _db.SaveChangesAsync();
        return Ok(c.ToDto());
    }
}

[Route("api/admin/reports")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminReportsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly PdfService _pdf;
    private readonly AuditService _audit;

    public AdminReportsController(AppDbContext db, PdfService pdf, AuditService audit)
    {
        _db = db; _pdf = pdf; _audit = audit;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<ReportSummaryDto>> Summary([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        => Ok(await BuildSummary(from, to));

    [HttpGet("pdf")]
    public async Task<IActionResult> Pdf([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var s = await BuildSummary(from, to);
        var (payments, withdrawals) = await LoadDetails(s.From, s.To);
        var bytes = _pdf.AdminReport(s, payments, withdrawals);
        _audit.Log("Report.ExportedPdf", "Report", null, $"{s.From:yyyy-MM-dd} to {s.To:yyyy-MM-dd}");
        await _db.SaveChangesAsync();
        return File(bytes, "application/pdf", $"smart-pension-report-{s.From:yyyyMMdd}-{s.To:yyyyMMdd}.pdf");
    }

    [HttpGet("csv")]
    public async Task<IActionResult> Csv([FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var s = await BuildSummary(from, to);
        var (payments, _) = await LoadDetails(s.From, s.To);
        var sb = new StringBuilder();
        sb.AppendLine("PaymentId,PensionId,Name,Year,Month,Amount,Status,Reference,FailureReason,ProcessedAt");
        foreach (var p in payments)
            sb.AppendLine(string.Join(",", p.Id, Csv(p.PensionId), Csv(p.PensionerName), p.Year, p.Month,
                p.Amount.ToString(CultureInfo.InvariantCulture), p.Status, Csv(p.Reference), Csv(p.FailureReason),
                p.ProcessedAt?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)));
        _audit.Log("Report.ExportedCsv", "Report", null, $"{s.From:yyyy-MM-dd} to {s.To:yyyy-MM-dd}");
        await _db.SaveChangesAsync();
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", $"payments-{s.From:yyyyMMdd}-{s.To:yyyyMMdd}.csv");
    }

    private static string Csv(string? v)
    {
        if (string.IsNullOrEmpty(v)) return string.Empty;
        // Neutralise spreadsheet formula injection and escape quotes.
        if ("=+-@".Contains(v[0])) v = "'" + v;
        return $"\"{v.Replace("\"", "\"\"")}\"";
    }

    private async Task<(List<AdminPaymentItem>, List<AdminWithdrawalItem>)> LoadDetails(DateTime from, DateTime to)
    {
        var end = to.AddDays(1);
        var payments = await _db.Payments.Where(p => p.ProcessedAt >= from && p.ProcessedAt < end)
            .OrderBy(p => p.ProcessedAt).Take(2000).ProjectAdmin().ToListAsync();
        var withdrawals = await _db.Withdrawals.Where(w => w.RequestedAt >= from && w.RequestedAt < end)
            .OrderBy(w => w.RequestedAt).Take(2000).ProjectAdmin().ToListAsync();
        return (payments, withdrawals);
    }

    private async Task<ReportSummaryDto> BuildSummary(DateTime? from, DateTime? to)
    {
        var end = (to ?? DateTime.UtcNow).Date;
        var start = (from ?? new DateTime(end.Year, end.Month, 1)).Date;
        if (start > end) throw new AppException("'From' date must be before 'To' date.");
        var endEx = end.AddDays(1);

        var pays = _db.Payments.Where(p => p.ProcessedAt >= start && p.ProcessedAt < endEx);
        var reviewed = _db.Withdrawals.Where(w => w.ReviewedAt >= start && w.ReviewedAt < endEx);
        return new ReportSummaryDto(start, end,
            await _db.Pensioners.CountAsync(p => p.CreatedAt >= start && p.CreatedAt < endEx),
            await _db.Pensioners.CountAsync(p => p.ApprovedAt >= start && p.ApprovedAt < endEx),
            await pays.CountAsync(p => p.Status == PaymentStatus.Success),
            await pays.Where(p => p.Status == PaymentStatus.Success).SumAsync(p => (decimal?)p.Amount) ?? 0,
            await pays.CountAsync(p => p.Status == PaymentStatus.Failed),
            await reviewed.CountAsync(w => w.Status == WithdrawalStatus.Approved || w.Status == WithdrawalStatus.Paid),
            await reviewed.Where(w => w.Status == WithdrawalStatus.Approved || w.Status == WithdrawalStatus.Paid).SumAsync(w => (decimal?)w.Amount) ?? 0,
            await reviewed.CountAsync(w => w.Status == WithdrawalStatus.Rejected),
            await _db.LifeVerifications.CountAsync(l => l.Status == LifeVerificationStatus.Approved && l.ReviewedAt >= start && l.ReviewedAt < endEx),
            await _db.Complaints.CountAsync(c => c.CreatedAt >= start && c.CreatedAt < endEx));
    }
}

[Route("api/admin/audit-logs")]
[Authorize(Policy = Policies.AdminOnly)]
public class AuditLogsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public AuditLogsController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AuditLogDto>>> List([FromQuery] PageQuery q, [FromQuery] string? action,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var query = _db.AuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action.StartsWith(action));
        if (from.HasValue) query = query.Where(a => a.CreatedAt >= from.Value.Date);
        if (to.HasValue) query = query.Where(a => a.CreatedAt < to.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(a => (a.UserEmail != null && a.UserEmail.Contains(s)) || a.Action.Contains(s)
                || (a.Details != null && a.Details.Contains(s)) || (a.EntityId != null && a.EntityId == s));
        }
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.OrderByDescending(a => a.CreatedAt).Skip(skip).Take(take)
            .Select(a => new AuditLogDto(a.Id, a.UserEmail, a.Action, a.EntityType, a.EntityId, a.Details, a.IpAddress, a.CreatedAt))
            .ToListAsync();
        return Ok(new PagedResult<AuditLogDto>(items, total, q.Page, q.PageSize));
    }

    [HttpGet("actions")]
    public async Task<ActionResult<IEnumerable<string>>> Actions()
        => Ok(await _db.AuditLogs.Select(a => a.Action).Distinct().OrderBy(a => a).Take(200).ToListAsync());
}

[Route("api/admin/settings")]
[Authorize(Policy = Policies.AdminOnly)]
public class SettingsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;

    public SettingsController(AppDbContext db, AuditService audit)
    {
        _db = db; _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SettingDto>>> List()
        => Ok(await _db.SystemSettings.OrderBy(s => s.Key)
            .Select(s => new SettingDto(s.Key, s.Value, s.Description, s.UpdatedAt)).ToListAsync());

    [HttpPut]
    [Authorize(Policy = Policies.SuperAdminOnly)]
    public async Task<ActionResult<IEnumerable<SettingDto>>> Update(UpdateSettingsRequest req)
    {
        var numeric = new Dictionary<string, (decimal Min, decimal Max)>
        {
            [SettingKeys.MinWithdrawalAmount] = (1, 1_000_000),
            [SettingKeys.MaxWithdrawalsPerMonth] = (1, 10),
            [SettingKeys.LifeVerificationValidityMonths] = (1, 36),
            [SettingKeys.SuggestedPensionRatePercent] = (1, 100),
            [SettingKeys.FaceMatchThreshold] = (0.3m, 0.7m),
        };
        foreach (var (key, raw) in req.Values)
        {
            var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
            if (setting == null) { ModelState.AddModelError(key, "Unknown setting."); continue; }
            var value = (raw ?? string.Empty).Trim();
            if (numeric.TryGetValue(key, out var range))
            {
                if (!decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var d) || d < range.Min || d > range.Max)
                {
                    ModelState.AddModelError(key, $"Must be a number between {range.Min} and {range.Max}.");
                    continue;
                }
            }
            else if (value.Length > 200) { ModelState.AddModelError(key, "Value is too long."); continue; }

            if (setting.Value != value)
            {
                _audit.Log("Settings.Updated", nameof(SystemSetting), key, $"'{setting.Value}' -> '{value}'");
                setting.Value = value;
                setting.UpdatedAt = DateTime.UtcNow;
            }
        }
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        await _db.SaveChangesAsync();
        return await List();
    }
}

[Route("api/admin/users")]
[Authorize(Policy = Policies.SuperAdminOnly)]
public class AdminUsersController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly AuditService _audit;

    public AdminUsersController(AppDbContext db, UserManager<ApplicationUser> users, AuditService audit)
    {
        _db = db; _users = users; _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminUserDto>>> List()
    {
        var admins = await _users.GetUsersInRoleAsync(Roles.Admin);
        var supers = await _users.GetUsersInRoleAsync(Roles.SuperAdmin);
        var all = admins.Concat(supers).DistinctBy(u => u.Id).OrderBy(u => u.CreatedAt).ToList();
        var result = new List<AdminUserDto>();
        foreach (var u in all)
            result.Add(new AdminUserDto(u.Id, u.Email ?? string.Empty, u.FullName, await _users.GetRolesAsync(u), u.IsActive, u.CreatedAt, u.LastLoginAt));
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<AdminUserDto>> Create(CreateAdminRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (await _users.FindByEmailAsync(email) != null)
        {
            ModelState.AddModelError(nameof(req.Email), "An account with this email already exists.");
            return ValidationProblem(ModelState);
        }
        var user = new ApplicationUser { UserName = email, Email = email, EmailConfirmed = true, FullName = req.FullName.Trim() };
        var result = await _users.CreateAsync(user, req.Password);
        if (!result.Succeeded)
        {
            foreach (var e in result.Errors) ModelState.AddModelError(nameof(req.Password), e.Description);
            return ValidationProblem(ModelState);
        }
        var roles = req.Role == Roles.SuperAdmin ? new[] { Roles.Admin, Roles.SuperAdmin } : new[] { Roles.Admin };
        await _users.AddToRolesAsync(user, roles);
        _audit.Log("AdminUser.Created", "User", user.Id, $"{email} ({req.Role})");
        await _db.SaveChangesAsync();
        return Ok(new AdminUserDto(user.Id, email, user.FullName, roles, true, user.CreatedAt, null));
    }

    [HttpPost("{id}/toggle-active")]
    public async Task<ActionResult<MessageResponse>> ToggleActive(string id)
    {
        if (id == CurrentUserId) throw new AppException("You cannot deactivate your own account.");
        var user = await _users.FindByIdAsync(id) ?? throw new AppException("User not found.", 404);
        user.IsActive = !user.IsActive;
        await _users.UpdateAsync(user);
        _audit.Log(user.IsActive ? "AdminUser.Activated" : "AdminUser.Deactivated", "User", id, user.Email);
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse(user.IsActive ? "Account activated." : "Account deactivated."));
    }
}
