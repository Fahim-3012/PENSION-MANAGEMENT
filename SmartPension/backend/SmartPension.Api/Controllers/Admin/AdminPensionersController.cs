using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers.Admin;

internal static class AdminQueries
{
    public static IQueryable<AdminPensionerListItem> ProjectList(this IQueryable<Pensioner> q, DateTime now) =>
        q.Select(p => new AdminPensionerListItem(
            p.Id, p.PensionId, p.FullName, p.User!.Email ?? string.Empty, p.Phone, p.PensionType, p.FormerOrganization,
            p.MonthlyPensionAmount, p.Balance, p.Status,
            p.BankAccounts.Any(b => b.Status == VerificationStatus.Verified) ? "Verified"
                : p.BankAccounts.Any(b => b.Status == VerificationStatus.Pending) ? "Pending"
                : p.BankAccounts.Any() ? "Rejected" : "None",
            p.LifeVerifications.Any(l => l.Status == LifeVerificationStatus.Approved && l.ValidUntil >= now) ? "Verified"
                : p.LifeVerifications.Any(l => l.Status == LifeVerificationStatus.Pending) ? "Pending"
                : p.LifeVerifications.Any() ? "Expired" : "NotSubmitted",
            p.CreatedAt));

    public static IQueryable<AdminWithdrawalItem> ProjectAdmin(this IQueryable<Withdrawal> q) =>
        q.Select(w => new AdminWithdrawalItem(
            w.Id, w.PensionerId, w.Pensioner!.PensionId, w.Pensioner.FullName, w.Amount, w.Pensioner.Balance, w.Status,
            w.BankAccount!.BankName, Mask.Tail(w.BankAccount.AccountNumber, 4), w.Note, w.RejectionReason, w.Reference,
            w.RequestedAt, w.ReviewStartedAt, w.ReviewedAt, w.PaidAt));

    public static IQueryable<AdminPaymentItem> ProjectAdmin(this IQueryable<Payment> q) =>
        q.Select(p => new AdminPaymentItem(
            p.Id, p.PensionerId, p.Pensioner!.PensionId, p.Pensioner.FullName, p.Year, p.Month, p.Amount, p.Status,
            p.Reference, p.FailureReason, p.CreatedAt, p.ProcessedAt));
}

[Route("api/admin")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminDashboardController : ApiControllerBase
{
    private readonly AppDbContext _db;
    public AdminDashboardController(AppDbContext db) => _db = db;

    [HttpGet("dashboard")]
    public async Task<ActionResult<AdminDashboardDto>> Dashboard()
    {
        var now = DateTime.UtcNow;
        var pensioners = _db.Pensioners;
        var payments = _db.Payments;

        var dto = new AdminDashboardDto(
            TotalPensioners: await pensioners.CountAsync(),
            ActiveAccounts: await pensioners.CountAsync(p => p.Status == PensionerStatus.Active),
            RegistryRecords: await _db.PensionRecords.CountAsync(),
            UnclaimedRecords: await _db.PensionRecords.CountAsync(r => r.IsActive && r.ClaimedByPensionerId == null),
            SuspendedAccounts: await pensioners.CountAsync(p => p.Status == PensionerStatus.Suspended),
            PendingWithdrawals: await _db.Withdrawals.CountAsync(w => w.Status == WithdrawalStatus.Pending || w.Status == WithdrawalStatus.UnderReview),
            ApprovedAwaitingPayout: await _db.Withdrawals.CountAsync(w => w.Status == WithdrawalStatus.Approved),
            SuccessfulPayments: await payments.CountAsync(p => p.Status == PaymentStatus.Success),
            SuccessfulPaymentAmount: await payments.Where(p => p.Status == PaymentStatus.Success).SumAsync(p => (decimal?)p.Amount) ?? 0,
            FailedPayments: await payments.CountAsync(p => p.Status == PaymentStatus.Failed),
            PendingPayments: await payments.CountAsync(p => p.Status == PaymentStatus.Pending),
            PendingBankVerifications: await _db.BankAccounts.CountAsync(b => b.Status == VerificationStatus.Pending),
            PendingLifeVerifications: await _db.LifeVerifications.CountAsync(l => l.Status == LifeVerificationStatus.Pending),
            OpenComplaints: await _db.Complaints.CountAsync(c => c.Status == ComplaintStatus.Open || c.Status == ComplaintStatus.InProgress),
            DisbursedThisMonth: await payments.Where(p => p.Status == PaymentStatus.Success && p.Year == now.Year && p.Month == now.Month)
                .SumAsync(p => (decimal?)p.Amount) ?? 0,
            TotalBalanceHeld: await pensioners.SumAsync(p => (decimal?)p.Balance) ?? 0,
            RecentWithdrawals: await _db.Withdrawals.OrderByDescending(w => w.RequestedAt).Take(6).ProjectAdmin().ToListAsync(),
            RecentRegistrations: await pensioners.OrderByDescending(p => p.CreatedAt).Take(6).ProjectList(now).ToListAsync());
        return Ok(dto);
    }

    /// <summary>Financial analytics: range = monthly (last 12 months) or yearly (last 5 years).</summary>
    [HttpGet("analytics")]
    public async Task<ActionResult<AnalyticsDto>> Analytics([FromQuery] string range = "monthly")
    {
        var now = DateTime.UtcNow;
        var yearly = range.Equals("yearly", StringComparison.OrdinalIgnoreCase);
        var start = yearly ? new DateTime(now.Year - 4, 1, 1, 0, 0, 0, DateTimeKind.Utc)
                           : new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-11);

        var pays = await _db.Payments.Where(p => p.Year > start.Year || (p.Year == start.Year && p.Month >= start.Month))
            .Select(p => new { p.Year, p.Month, p.Amount, p.Status }).ToListAsync();
        var debits = await _db.Transactions.Where(t => t.Type == TransactionType.Debit && t.CreatedAt >= start)
            .Select(t => new { t.CreatedAt, t.Amount }).ToListAsync();
        var regs = await _db.Pensioners.Where(p => p.CreatedAt >= start).Select(p => p.CreatedAt).ToListAsync();

        List<AnalyticsPoint> series;
        if (yearly)
        {
            series = Enumerable.Range(start.Year, 5).Select(y => new AnalyticsPoint(
                y.ToString(CultureInfo.InvariantCulture),
                pays.Where(p => p.Year == y && p.Status == PaymentStatus.Success).Sum(p => p.Amount),
                debits.Where(d => d.CreatedAt.Year == y).Sum(d => d.Amount),
                pays.Count(p => p.Year == y && p.Status == PaymentStatus.Failed),
                regs.Count(r => r.Year == y))).ToList();
        }
        else
        {
            series = Enumerable.Range(0, 12).Select(i =>
            {
                var m = start.AddMonths(i);
                return new AnalyticsPoint(m.ToString("MMM yy", CultureInfo.InvariantCulture),
                    pays.Where(p => p.Year == m.Year && p.Month == m.Month && p.Status == PaymentStatus.Success).Sum(p => p.Amount),
                    debits.Where(d => d.CreatedAt.Year == m.Year && d.CreatedAt.Month == m.Month).Sum(d => d.Amount),
                    pays.Count(p => p.Year == m.Year && p.Month == m.Month && p.Status == PaymentStatus.Failed),
                    regs.Count(r => r.Year == m.Year && r.Month == m.Month));
            }).ToList();
        }

        var byStatus = (await _db.Pensioners.Select(p => p.Status).ToListAsync())
            .GroupBy(s => s).Select(g => new CountItem(g.Key.ToString(), g.Count())).ToList();
        var wByStatus = (await _db.Withdrawals.Select(w => w.Status).ToListAsync())
            .GroupBy(s => s).Select(g => new CountItem(g.Key.ToString(), g.Count())).ToList();
        var byType = (await _db.Pensioners.Select(p => p.PensionType).ToListAsync())
            .GroupBy(s => s).Select(g => new CountItem(g.Key.ToString(), g.Count())).ToList();

        return Ok(new AnalyticsDto(yearly ? "yearly" : "monthly", series, byStatus, wByStatus, byType));
    }
}

[Route("api/admin/pensioners")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminPensionersController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;
    private readonly SettingsService _settings;

    public AdminPensionersController(AppDbContext db, AuditService audit, NotificationService notify, SettingsService settings)
    {
        _db = db; _audit = audit; _notify = notify; _settings = settings;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminPensionerListItem>>> List([FromQuery] PageQuery q, [FromQuery] string? pensionType)
    {
        var query = _db.Pensioners.AsQueryable();
        if (ParseEnum<PensionerStatus>(q.Status) is { } st) query = query.Where(p => p.Status == st);
        if (ParseEnum<PensionType>(pensionType) is { } pt) query = query.Where(p => p.PensionType == pt);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(p => p.FullName.Contains(s) || (p.PensionId != null && p.PensionId.Contains(s))
                || p.Phone.Contains(s) || p.NidNumber.Contains(s) || p.User!.Email!.Contains(s) || p.FormerOrganization.Contains(s));
        }
        query = (q.SortBy, q.SortDesc) switch
        {
            ("name", false) => query.OrderBy(p => p.FullName),
            ("name", true) => query.OrderByDescending(p => p.FullName),
            ("amount", false) => query.OrderBy(p => p.MonthlyPensionAmount),
            ("amount", true) => query.OrderByDescending(p => p.MonthlyPensionAmount),
            ("balance", false) => query.OrderBy(p => p.Balance),
            ("balance", true) => query.OrderByDescending(p => p.Balance),
            (_, false) => query.OrderBy(p => p.CreatedAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ProjectList(DateTime.UtcNow).ToListAsync();
        return Ok(new PagedResult<AdminPensionerListItem>(items, total, q.Page, q.PageSize));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminPensionerDetail>> Get(int id)
    {
        var p = await _db.Pensioners.Include(x => x.User).Include(x => x.BankAccounts).Include(x => x.Nominees)
            .Include(x => x.LifeVerifications).AsSplitQuery().FirstOrDefaultAsync(x => x.Id == id)
            ?? throw new AppException("Pensioner not found.", 404);
        var withdrawals = await _db.Withdrawals.Include(w => w.BankAccount).Where(w => w.PensionerId == id)
            .OrderByDescending(w => w.RequestedAt).Take(20).ToListAsync();
        var payments = await _db.Payments.Where(x => x.PensionerId == id)
            .OrderByDescending(x => x.Year).ThenByDescending(x => x.Month).Take(24).ToListAsync();
        var rate = await _settings.GetDecimalAsync(SettingKeys.SuggestedPensionRatePercent, 50);

        _audit.Log("Pensioner.Viewed", nameof(Pensioner), id.ToString());
        await _db.SaveChangesAsync();

        return Ok(new AdminPensionerDetail(
            p.Id, p.PensionId, p.FullName, p.FullNameBn, p.User?.Email ?? string.Empty, p.NidNumber, p.DateOfBirth, p.Gender,
            p.Phone, p.Address, p.PensionType, p.FormerOrganization, p.Designation, p.EmployeeId, p.RetirementDate,
            p.LastBasicSalary, p.MonthlyPensionAmount, Math.Round(p.LastBasicSalary * rate / 100m, 2), p.Balance,
            p.Status, p.StatusReason, p.ApprovedAt, p.CreatedAt, p.FaceEnrolledAt,
            p.BankAccounts.OrderByDescending(b => b.CreatedAt).Select(b => b.ToDto()).ToList(),
            p.Nominees.Select(n => n.ToDto()).ToList(),
            p.LifeVerifications.OrderByDescending(l => l.SubmittedAt).Select(l => l.ToDto()).ToList(),
            withdrawals.Select(w => w.ToDto()).ToList(),
            payments.Select(x => x.ToDto()).ToList()));
    }

    [HttpPost("{id:int}/suspend")]
    public async Task<ActionResult<MessageResponse>> Suspend(int id, ReasonRequest req)
    {
        var p = await Find(id);
        if (p.Status != PensionerStatus.Active) throw new AppException("Only active accounts can be suspended.");
        p.Status = PensionerStatus.Suspended;
        p.StatusReason = req.Reason.Trim();
        p.UpdatedAt = DateTime.UtcNow;
        _audit.Log("Pensioner.Suspended", nameof(Pensioner), id.ToString(), p.StatusReason);
        _notify.Notify(p.UserId, "Account suspended", $"Your pension account was suspended. Reason: {p.StatusReason}",
            "অ্যাকাউন্ট স্থগিত", $"আপনার পেনশন অ্যাকাউন্ট স্থগিত করা হয়েছে। কারণ: {p.StatusReason}", "error", "/app/dashboard");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Account suspended."));
    }

    [HttpPost("{id:int}/reactivate")]
    public async Task<ActionResult<MessageResponse>> Reactivate(int id)
    {
        var p = await Find(id);
        if (p.Status != PensionerStatus.Suspended) throw new AppException("Only suspended accounts can be reactivated.");
        p.Status = PensionerStatus.Active;
        p.StatusReason = null;
        p.UpdatedAt = DateTime.UtcNow;
        _audit.Log("Pensioner.Reactivated", nameof(Pensioner), id.ToString());
        _notify.Notify(p.UserId, "Account reactivated", "Your pension account is active again.",
            "অ্যাকাউন্ট পুনরায় সক্রিয়", "আপনার পেনশন অ্যাকাউন্ট আবার সক্রিয় হয়েছে।", "success", "/app/dashboard");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Account reactivated."));
    }

    /// <summary>Clears the enrolled face so the pensioner enrols again at the next AI verification.</summary>
    [HttpPost("{id:int}/reset-face")]
    public async Task<ActionResult<MessageResponse>> ResetFace(int id)
    {
        var p = await Find(id);
        if (p.FaceDescriptor == null) throw new AppException("This pensioner has no enrolled face.");
        p.FaceDescriptor = null;
        p.FaceEnrolledAt = null;
        p.UpdatedAt = DateTime.UtcNow;
        _audit.Log("Pensioner.FaceReset", nameof(Pensioner), id.ToString());
        _notify.Notify(p.UserId, "Face enrolment reset", "Your enrolled face was reset by the office. Enrol again at your next life verification.",
            "মুখের নিবন্ধন রিসেট", "অফিস আপনার নিবন্ধিত মুখ রিসেট করেছে। পরবর্তী জীবিত যাচাইয়ে আবার নিবন্ধন করুন।", "info", "/app/life-verification");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Face enrolment reset."));
    }

    [HttpPut("{id:int}/pension-amount")]
    public async Task<ActionResult<MessageResponse>> UpdateAmount(int id, UpdatePensionAmountRequest req)
    {
        var p = await Find(id);
        var old = p.MonthlyPensionAmount;
        p.MonthlyPensionAmount = Math.Round(req.MonthlyPensionAmount, 2);
        p.UpdatedAt = DateTime.UtcNow;
        // Keep the master list in step with the account.
        var record = await _db.PensionRecords.FirstOrDefaultAsync(r => r.ClaimedByPensionerId == p.Id);
        if (record != null) { record.MonthlyPensionAmount = p.MonthlyPensionAmount; record.UpdatedAt = DateTime.UtcNow; }
        _audit.Log("Pensioner.PensionAmountChanged", nameof(Pensioner), id.ToString(),
            $"BDT {old:N2} -> BDT {p.MonthlyPensionAmount:N2}. Reason: {req.Reason}");
        _notify.Notify(p.UserId, "Monthly pension updated", $"Your monthly pension is now BDT {p.MonthlyPensionAmount:N2}.",
            "মাসিক পেনশন হালনাগাদ", $"আপনার মাসিক পেনশন এখন BDT {p.MonthlyPensionAmount:N2}।", "info", "/app/dashboard");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Monthly pension amount updated."));
    }

    private async Task<Pensioner> Find(int id) =>
        await _db.Pensioners.FirstOrDefaultAsync(p => p.Id == id) ?? throw new AppException("Pensioner not found.", 404);
}
