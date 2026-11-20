using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers.Admin;

/// <summary>Master pensioner list: import, browse, add, edit, deactivate.</summary>
[Route("api/admin/registry")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminRegistryController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly RegistryService _registry;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public AdminRegistryController(AppDbContext db, RegistryService registry, AuditService audit, NotificationService notify)
    {
        _db = db; _registry = registry; _audit = audit; _notify = notify;
    }

    private static PensionRecordDto ToDto(PensionRecord r) => new(
        r.Id, r.PensionId, r.FullName, r.FullNameBn, r.NidNumber, r.DateOfBirth, r.Gender, r.PensionType, r.FormerOrganization,
        r.Designation, r.EmployeeId, r.RetirementDate, r.LastBasicSalary, r.MonthlyPensionAmount, r.Phone, r.IsActive,
        r.ClaimedByPensionerId, r.ClaimedAt, r.ImportBatch, r.UpdatedAt);

    [HttpGet("stats")]
    public async Task<ActionResult<RegistryStats>> Stats() => Ok(new RegistryStats(
        await _db.PensionRecords.CountAsync(),
        await _db.PensionRecords.CountAsync(r => r.ClaimedByPensionerId != null),
        await _db.PensionRecords.CountAsync(r => r.IsActive && r.ClaimedByPensionerId == null),
        await _db.PensionRecords.CountAsync(r => !r.IsActive),
        await _db.AuditLogs.Where(a => a.Action == "Registry.Imported").MaxAsync(a => (DateTime?)a.CreatedAt)));

    /// <summary>status = claimed | unclaimed | inactive (empty = all).</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<PensionRecordDto>>> List([FromQuery] PageQuery q, [FromQuery] string? pensionType)
    {
        var query = _db.PensionRecords.AsQueryable();
        query = q.Status switch
        {
            "claimed" => query.Where(r => r.ClaimedByPensionerId != null),
            "unclaimed" => query.Where(r => r.IsActive && r.ClaimedByPensionerId == null),
            "inactive" => query.Where(r => !r.IsActive),
            _ => query
        };
        if (ParseEnum<PensionType>(pensionType) is { } pt) query = query.Where(r => r.PensionType == pt);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(r => r.PensionId.Contains(s) || r.FullName.Contains(s) || r.NidNumber.Contains(s)
                || r.FormerOrganization.Contains(s) || (r.Phone != null && r.Phone.Contains(s)));
        }
        query = (q.SortBy, q.SortDesc) switch
        {
            ("name", false) => query.OrderBy(r => r.FullName),
            ("name", true) => query.OrderByDescending(r => r.FullName),
            ("amount", false) => query.OrderBy(r => r.MonthlyPensionAmount),
            ("amount", true) => query.OrderByDescending(r => r.MonthlyPensionAmount),
            ("pensionId", false) => query.OrderBy(r => r.PensionId),
            ("pensionId", true) => query.OrderByDescending(r => r.PensionId),
            _ => query.OrderByDescending(r => r.UpdatedAt)
        };
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ToListAsync();
        return Ok(new PagedResult<PensionRecordDto>(items.Select(ToDto).ToList(), total, q.Page, q.PageSize));
    }

    [HttpGet("template")]
    public IActionResult Template()
    {
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(RegistryService.TemplateCsv())).ToArray();
        return File(bytes, "text/csv", "pensioner-registry-template.csv");
    }

    /// <summary>Upload a CSV. dryRun=true validates and reports without saving anything.</summary>
    [HttpPost("import")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ImportResult>> Import(IFormFile file, [FromQuery] bool dryRun = false)
    {
        if (file is null || file.Length == 0) throw new AppException("Choose a CSV file to import.");
        if (file.Length > 5 * 1024 * 1024) throw new AppException("The file must be smaller than 5 MB.");
        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            throw new AppException("Only .csv files are accepted. In Excel use File → Save As → CSV UTF-8.");
        await using var stream = file.OpenReadStream();
        return Ok(await _registry.ImportAsync(stream, dryRun, Path.GetFileName(file.FileName)));
    }

    [HttpPost]
    public async Task<ActionResult<PensionRecordDto>> Create(PensionRecordRequest req)
    {
        var record = new PensionRecord { ImportBatch = "manual" };
        var err = RegistryService.Apply(req.ToValues(), record);
        if (err != null) throw new AppException(err);
        if (await _db.PensionRecords.AnyAsync(r => r.PensionId == record.PensionId))
            throw new AppException("A record with this Pension ID already exists.");
        if (await _db.PensionRecords.AnyAsync(r => r.NidNumber == record.NidNumber))
            throw new AppException("A record with this NID already exists.");
        _db.PensionRecords.Add(record);
        await _db.SaveChangesAsync();
        _audit.Log("Registry.RecordAdded", nameof(PensionRecord), record.Id.ToString(), record.PensionId);
        await _db.SaveChangesAsync();
        return Ok(ToDto(record));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<PensionRecordDto>> Update(int id, PensionRecordRequest req)
    {
        var record = await _db.PensionRecords.FirstOrDefaultAsync(r => r.Id == id) ?? throw new AppException("Record not found.", 404);
        var incoming = new PensionRecord();
        var err = RegistryService.Apply(req.ToValues(), incoming);
        if (err != null) throw new AppException(err);
        if (incoming.PensionId != record.PensionId) throw new AppException("Pension ID cannot be changed. Deactivate this record and add a new one.");
        var claimed = record.ClaimedByPensionerId != null;
        if (claimed && (incoming.NidNumber != record.NidNumber || incoming.DateOfBirth != record.DateOfBirth || incoming.FullName != record.FullName))
            throw new AppException("This record already has an account; name, NID and date of birth cannot be changed here.");
        if (!claimed && await _db.PensionRecords.AnyAsync(r => r.NidNumber == incoming.NidNumber && r.Id != id))
            throw new AppException("Another record already uses this NID.");

        var oldAmount = record.MonthlyPensionAmount;
        RegistryService.CopyEditable(incoming, record, claimed);

        if (claimed && oldAmount != record.MonthlyPensionAmount)
        {
            var p = await _db.Pensioners.FirstAsync(x => x.Id == record.ClaimedByPensionerId);
            p.MonthlyPensionAmount = record.MonthlyPensionAmount;
            p.UpdatedAt = DateTime.UtcNow;
            _notify.Notify(p.UserId, "Monthly pension updated", $"Your monthly pension is now BDT {p.MonthlyPensionAmount:N2}.",
                "মাসিক পেনশন হালনাগাদ", $"আপনার মাসিক পেনশন এখন BDT {p.MonthlyPensionAmount:N2}।", "info", "/app/dashboard");
        }
        _audit.Log("Registry.RecordUpdated", nameof(PensionRecord), id.ToString(),
            oldAmount != record.MonthlyPensionAmount ? $"{record.PensionId}: BDT {oldAmount:N2} -> BDT {record.MonthlyPensionAmount:N2}" : record.PensionId);
        await _db.SaveChangesAsync();
        return Ok(ToDto(record));
    }

    /// <summary>An inactive record can no longer be used to register. Existing accounts are not affected (use Suspend for that).</summary>
    [HttpPost("{id:int}/toggle-active")]
    public async Task<ActionResult<MessageResponse>> ToggleActive(int id)
    {
        var record = await _db.PensionRecords.FirstOrDefaultAsync(r => r.Id == id) ?? throw new AppException("Record not found.", 404);
        record.IsActive = !record.IsActive;
        record.UpdatedAt = DateTime.UtcNow;
        _audit.Log(record.IsActive ? "Registry.RecordActivated" : "Registry.RecordDeactivated", nameof(PensionRecord), id.ToString(), record.PensionId);
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse(record.IsActive ? "Record activated." : "Record deactivated. It can no longer be used to sign up."));
    }
}
