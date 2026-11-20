using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers.Admin;

[Route("api/admin/bank-accounts")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminBankAccountsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public AdminBankAccountsController(AppDbContext db, AuditService audit, NotificationService notify)
    {
        _db = db; _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminBankAccountItem>>> List([FromQuery] PageQuery q)
    {
        var query = _db.BankAccounts.AsQueryable();
        if (ParseEnum<VerificationStatus>(q.Status) is { } st) query = query.Where(b => b.Status == st);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(b => b.Pensioner!.FullName.Contains(s) || b.BankName.Contains(s) || b.AccountNumber.Contains(s)
                || (b.Pensioner.PensionId != null && b.Pensioner.PensionId.Contains(s)));
        }
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        // Full account number is shown to admins because they must verify it against bank records.
        var items = await query.OrderByDescending(b => b.CreatedAt).Skip(skip).Take(take)
            .Select(b => new AdminBankAccountItem(b.Id, b.PensionerId, b.Pensioner!.PensionId, b.Pensioner.FullName, b.BankName,
                b.BranchName, b.AccountHolderName, b.AccountNumber, b.RoutingNumber, b.Status, b.RejectionReason, b.CreatedAt, b.VerifiedAt))
            .ToListAsync();
        return Ok(new PagedResult<AdminBankAccountItem>(items, total, q.Page, q.PageSize));
    }

    [HttpPost("{id:int}/verify")]
    public async Task<ActionResult<MessageResponse>> Verify(int id)
    {
        var b = await Find(id);
        if (b.Status == VerificationStatus.Verified) throw new AppException("Account is already verified.");
        b.Status = VerificationStatus.Verified;
        b.RejectionReason = null;
        b.VerifiedAt = DateTime.UtcNow;
        b.VerifiedById = CurrentUserId;
        if (!await _db.BankAccounts.AnyAsync(x => x.PensionerId == b.PensionerId && x.IsPrimary && x.Id != id && x.Status == VerificationStatus.Verified))
        {
            foreach (var other in await _db.BankAccounts.Where(x => x.PensionerId == b.PensionerId).ToListAsync())
                other.IsPrimary = other.Id == id;
        }
        _audit.Log("BankAccount.Verified", nameof(BankAccount), id.ToString(), $"{b.BankName} {Mask.Tail(b.AccountNumber)}");
        _notify.Notify(b.Pensioner!.UserId, "Bank account verified", $"Your {b.BankName} account ending {b.AccountNumber[^4..]} is verified.",
            "ব্যাংক অ্যাকাউন্ট যাচাই হয়েছে", $"আপনার {b.BankName} অ্যাকাউন্ট (শেষ ৪ অঙ্ক {b.AccountNumber[^4..]}) যাচাই করা হয়েছে।",
            "success", "/app/bank-accounts");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Bank account verified."));
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<MessageResponse>> Reject(int id, ReasonRequest req)
    {
        var b = await Find(id);
        if (await _db.Withdrawals.AnyAsync(w => w.BankAccountId == id && (w.Status == WithdrawalStatus.Pending
                || w.Status == WithdrawalStatus.UnderReview || w.Status == WithdrawalStatus.Approved)))
            throw new AppException("This account has an open withdrawal. Resolve the withdrawal first.");
        b.Status = VerificationStatus.Rejected;
        b.RejectionReason = req.Reason.Trim();
        b.IsPrimary = false;
        _audit.Log("BankAccount.Rejected", nameof(BankAccount), id.ToString(), b.RejectionReason);
        _notify.Notify(b.Pensioner!.UserId, "Bank account rejected", $"Your {b.BankName} account was rejected. Reason: {b.RejectionReason}",
            "ব্যাংক অ্যাকাউন্ট প্রত্যাখ্যাত", $"আপনার {b.BankName} অ্যাকাউন্ট প্রত্যাখ্যাত হয়েছে। কারণ: {b.RejectionReason}",
            "error", "/app/bank-accounts");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Bank account rejected."));
    }

    private async Task<BankAccount> Find(int id) =>
        await _db.BankAccounts.Include(b => b.Pensioner).FirstOrDefaultAsync(b => b.Id == id)
        ?? throw new AppException("Bank account not found.", 404);
}

[Route("api/admin/withdrawals")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminWithdrawalsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly PensionService _pension;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public AdminWithdrawalsController(AppDbContext db, PensionService pension, AuditService audit, NotificationService notify)
    {
        _db = db; _pension = pension; _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminWithdrawalItem>>> List([FromQuery] PageQuery q)
    {
        var query = _db.Withdrawals.AsQueryable();
        if (q.Status == "Open")
            query = query.Where(w => w.Status == WithdrawalStatus.Pending || w.Status == WithdrawalStatus.UnderReview);
        else if (ParseEnum<WithdrawalStatus>(q.Status) is { } st) query = query.Where(w => w.Status == st);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(w => w.Pensioner!.FullName.Contains(s) || (w.Pensioner.PensionId != null && w.Pensioner.PensionId.Contains(s))
                || (w.Reference != null && w.Reference.Contains(s)));
        }
        query = q.SortBy == "amount"
            ? (q.SortDesc ? query.OrderByDescending(w => w.Amount) : query.OrderBy(w => w.Amount))
            : (q.SortDesc ? query.OrderByDescending(w => w.RequestedAt) : query.OrderBy(w => w.RequestedAt));
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ProjectAdmin().ToListAsync();
        return Ok(new PagedResult<AdminWithdrawalItem>(items, total, q.Page, q.PageSize));
    }

    [HttpPost("{id:int}/review")]
    public async Task<ActionResult<MessageResponse>> StartReview(int id)
    {
        var w = await Find(id);
        if (w.Status != WithdrawalStatus.Pending) throw new AppException("Only pending requests can be moved to review.");
        w.Status = WithdrawalStatus.UnderReview;
        w.ReviewStartedAt = DateTime.UtcNow;
        _audit.Log("Withdrawal.ReviewStarted", nameof(Withdrawal), id.ToString());
        _notify.Notify(w.Pensioner!.UserId, "Withdrawal under review", $"Your withdrawal of BDT {w.Amount:N2} is being reviewed.",
            "উত্তোলন পর্যালোচনাধীন", $"আপনার BDT {w.Amount:N2} উত্তোলনের অনুরোধ পর্যালোচনা করা হচ্ছে।", "info", $"/app/withdrawals/{id}");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Request moved to review."));
    }

    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<MessageResponse>> Approve(int id)
    {
        var w = await Find(id);
        if (w.Status != WithdrawalStatus.Pending && w.Status != WithdrawalStatus.UnderReview)
            throw new AppException("Only pending or under-review requests can be approved.");
        var p = w.Pensioner!;
        if (p.Status != PensionerStatus.Active) throw new AppException("Pensioner account is not active.");
        if (w.BankAccount!.Status != VerificationStatus.Verified) throw new AppException("The destination bank account is no longer verified.");
        if (p.Balance < w.Amount) throw new AppException($"Insufficient balance. Available: BDT {p.Balance:N2}.");

        w.Status = WithdrawalStatus.Approved;
        w.ReviewStartedAt ??= DateTime.UtcNow;
        w.ReviewedAt = DateTime.UtcNow;
        w.ReviewedById = CurrentUserId;
        w.Reference = $"WD-{DateTime.UtcNow:yyyyMMdd}-{w.Id:D6}";
        _pension.Post(p, TransactionType.Debit, w.Amount, $"Withdrawal to {w.BankAccount.BankName} {Mask.Tail(w.BankAccount.AccountNumber)}",
            w.Reference, withdrawalId: w.Id);
        _audit.Log("Withdrawal.Approved", nameof(Withdrawal), id.ToString(), $"BDT {w.Amount:N2} for {p.PensionId}");
        _notify.Notify(p.UserId, "Withdrawal approved", $"Your withdrawal of BDT {w.Amount:N2} was approved and will be transferred to your bank.",
            "উত্তোলন অনুমোদিত", $"আপনার BDT {w.Amount:N2} উত্তোলন অনুমোদিত হয়েছে এবং ব্যাংকে পাঠানো হবে।", "success", $"/app/withdrawals/{id}");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Withdrawal approved and balance debited."));
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<MessageResponse>> Reject(int id, ReasonRequest req)
    {
        var w = await Find(id);
        if (w.Status != WithdrawalStatus.Pending && w.Status != WithdrawalStatus.UnderReview)
            throw new AppException("Only pending or under-review requests can be rejected.");
        w.Status = WithdrawalStatus.Rejected;
        w.RejectionReason = req.Reason.Trim();
        w.ReviewedAt = DateTime.UtcNow;
        w.ReviewedById = CurrentUserId;
        _audit.Log("Withdrawal.Rejected", nameof(Withdrawal), id.ToString(), w.RejectionReason);
        _notify.Notify(w.Pensioner!.UserId, "Withdrawal rejected", $"Your withdrawal of BDT {w.Amount:N2} was rejected. Reason: {w.RejectionReason}",
            "উত্তোলন প্রত্যাখ্যাত", $"আপনার BDT {w.Amount:N2} উত্তোলনের অনুরোধ প্রত্যাখ্যাত হয়েছে। কারণ: {w.RejectionReason}", "error", $"/app/withdrawals/{id}");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Withdrawal rejected."));
    }

    /// <summary>
    /// Records that the bank transfer was completed. No payment gateway is integrated, so the admin
    /// confirms the transfer manually (optionally entering the bank's transfer reference).
    /// </summary>
    [HttpPost("{id:int}/mark-paid")]
    public async Task<ActionResult<MessageResponse>> MarkPaid(int id, MarkPaidRequest req)
    {
        var w = await Find(id);
        if (w.Status != WithdrawalStatus.Approved) throw new AppException("Only approved requests can be marked as paid.");
        w.Status = WithdrawalStatus.Paid;
        w.PaidAt = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(req.Reference)) w.Reference = req.Reference.Trim();
        _audit.Log("Withdrawal.MarkedPaid", nameof(Withdrawal), id.ToString(), $"Ref {w.Reference}");
        _notify.Notify(w.Pensioner!.UserId, "Withdrawal completed", $"BDT {w.Amount:N2} has been transferred. Reference: {w.Reference}",
            "উত্তোলন সম্পন্ন", $"BDT {w.Amount:N2} স্থানান্তর করা হয়েছে। রেফারেন্স: {w.Reference}", "success", $"/app/withdrawals/{id}");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Withdrawal marked as paid."));
    }

    private async Task<Withdrawal> Find(int id) =>
        await _db.Withdrawals.Include(w => w.Pensioner).Include(w => w.BankAccount).FirstOrDefaultAsync(w => w.Id == id)
        ?? throw new AppException("Withdrawal not found.", 404);
}

[Route("api/admin/payments")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminPaymentsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly PensionService _pension;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public AdminPaymentsController(AppDbContext db, PensionService pension, AuditService audit, NotificationService notify)
    {
        _db = db; _pension = pension; _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminPaymentItem>>> List([FromQuery] PageQuery q, [FromQuery] int? year, [FromQuery] int? month)
    {
        var query = _db.Payments.AsQueryable();
        if (ParseEnum<PaymentStatus>(q.Status) is { } st) query = query.Where(p => p.Status == st);
        if (year is > 0) query = query.Where(p => p.Year == year);
        if (month is >= 1 and <= 12) query = query.Where(p => p.Month == month);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(p => p.Pensioner!.FullName.Contains(s) || (p.Pensioner.PensionId != null && p.Pensioner.PensionId.Contains(s))
                || (p.Reference != null && p.Reference.Contains(s)));
        }
        query = q.SortBy == "amount"
            ? (q.SortDesc ? query.OrderByDescending(p => p.Amount) : query.OrderBy(p => p.Amount))
            : (q.SortDesc ? query.OrderByDescending(p => p.Year).ThenByDescending(p => p.Month).ThenByDescending(p => p.Id)
                          : query.OrderBy(p => p.Year).ThenBy(p => p.Month).ThenBy(p => p.Id));
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ProjectAdmin().ToListAsync();
        return Ok(new PagedResult<AdminPaymentItem>(items, total, q.Page, q.PageSize));
    }

    /// <summary>Creates pending payment records for all active pensioners for a period (skips existing ones).</summary>
    [HttpPost("generate")]
    public async Task<ActionResult<BatchResult>> Generate(PeriodRequest req)
    {
        var now = DateTime.UtcNow;
        if (new DateTime(req.Year, req.Month, 1) > new DateTime(now.Year, now.Month, 1))
            throw new AppException("Payments cannot be generated for a future month.");

        var existing = (await _db.Payments.Where(p => p.Year == req.Year && p.Month == req.Month)
            .Select(p => p.PensionerId).ToListAsync()).ToHashSet();
        var eligible = (await _db.Pensioners.Where(p => p.Status == PensionerStatus.Active && p.MonthlyPensionAmount > 0)
            .Select(p => new { p.Id, p.MonthlyPensionAmount }).ToListAsync())
            .Where(p => !existing.Contains(p.Id)).ToList();
        foreach (var p in eligible)
            _db.Payments.Add(new Payment { PensionerId = p.Id, Year = req.Year, Month = req.Month, Amount = p.MonthlyPensionAmount });
        _audit.Log("Payments.Generated", nameof(Payment), null, $"{req.Month:D2}/{req.Year}: {eligible.Count} created");
        await _db.SaveChangesAsync();
        return Ok(new BatchResult(eligible.Count, eligible.Count, 0,
            eligible.Count == 0 ? "No new payments to create for this period." : $"{eligible.Count} pending payment(s) created."));
    }

    [HttpPost("{id:int}/process")]
    public async Task<ActionResult<MessageResponse>> Process(int id)
    {
        var payment = await _db.Payments.Include(p => p.Pensioner).FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new AppException("Payment not found.", 404);
        var ok = await _pension.ProcessPaymentAsync(payment, CurrentUserId);
        _audit.Log(ok ? "Payment.Succeeded" : "Payment.Failed", nameof(Payment), id.ToString(), payment.FailureReason ?? payment.Reference);
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse(ok ? "Payment credited successfully." : $"Payment failed: {payment.FailureReason}"));
    }

    [HttpPost("process-batch")]
    public async Task<ActionResult<BatchResult>> ProcessBatch(PeriodRequest req)
    {
        var pending = await _db.Payments.Include(p => p.Pensioner)
            .Where(p => p.Year == req.Year && p.Month == req.Month && p.Status == PaymentStatus.Pending).ToListAsync();
        int ok = 0, failed = 0;
        foreach (var payment in pending)
        {
            if (await _pension.ProcessPaymentAsync(payment, CurrentUserId)) ok++; else failed++;
        }
        _audit.Log("Payments.BatchProcessed", nameof(Payment), null, $"{req.Month:D2}/{req.Year}: {ok} succeeded, {failed} failed");
        await _db.SaveChangesAsync();
        return Ok(new BatchResult(pending.Count, ok, failed,
            pending.Count == 0 ? "No pending payments for this period." : $"{ok} succeeded, {failed} failed."));
    }

    [HttpPost("{id:int}/fail")]
    public async Task<ActionResult<MessageResponse>> MarkFailed(int id, FailPaymentRequest req)
    {
        var payment = await _db.Payments.Include(p => p.Pensioner).FirstOrDefaultAsync(p => p.Id == id)
            ?? throw new AppException("Payment not found.", 404);
        if (payment.Status != PaymentStatus.Pending) throw new AppException("Only pending payments can be marked as failed.");
        payment.Status = PaymentStatus.Failed;
        payment.FailureReason = req.Reason.Trim();
        payment.ProcessedAt = DateTime.UtcNow;
        payment.ProcessedById = CurrentUserId;
        var period = new DateTime(payment.Year, payment.Month, 1).ToString("MMMM yyyy", CultureInfo.InvariantCulture);
        _audit.Log("Payment.MarkedFailed", nameof(Payment), id.ToString(), payment.FailureReason);
        _notify.Notify(payment.Pensioner!.UserId, "Pension payment failed", $"Your pension for {period} failed: {payment.FailureReason}",
            "পেনশন প্রদান ব্যর্থ", $"{period} মাসের পেনশন ব্যর্থ হয়েছে: {payment.FailureReason}", "error", "/app/payments");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Payment marked as failed."));
    }

    [HttpPost("{id:int}/retry")]
    public async Task<ActionResult<MessageResponse>> Retry(int id)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == id) ?? throw new AppException("Payment not found.", 404);
        if (payment.Status != PaymentStatus.Failed) throw new AppException("Only failed payments can be retried.");
        payment.Status = PaymentStatus.Pending;
        payment.FailureReason = null;
        payment.ProcessedAt = null;
        _audit.Log("Payment.Requeued", nameof(Payment), id.ToString());
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Payment moved back to pending."));
    }
}

[Route("api/admin/life-verifications")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminLifeVerificationsController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _files;
    private readonly SettingsService _settings;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public AdminLifeVerificationsController(AppDbContext db, FileStorageService files, SettingsService settings,
        AuditService audit, NotificationService notify)
    {
        _db = db; _files = files; _settings = settings; _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminLifeItem>>> List([FromQuery] PageQuery q)
    {
        var query = _db.LifeVerifications.AsQueryable();
        if (q.Status == "Expired")
        {
            var now = DateTime.UtcNow;
            query = query.Where(l => l.Status == LifeVerificationStatus.Approved && l.ValidUntil < now);
        }
        else if (ParseEnum<LifeVerificationStatus>(q.Status) is { } st) query = query.Where(l => l.Status == st);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(l => l.Pensioner!.FullName.Contains(s) || (l.Pensioner.PensionId != null && l.Pensioner.PensionId.Contains(s)));
        }
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.OrderByDescending(l => l.SubmittedAt).Skip(skip).Take(take)
            .Select(l => new AdminLifeItem(l.Id, l.PensionerId, l.Pensioner!.PensionId, l.Pensioner.FullName, l.Status,
                l.RejectionReason, l.SubmittedAt, l.ReviewedAt, l.ValidUntil, l.Method, l.MatchDistance, l.LivenessPassed)).ToListAsync();
        return Ok(new PagedResult<AdminLifeItem>(items, total, q.Page, q.PageSize));
    }

    [HttpGet("{id:int}/photo")]
    public async Task<IActionResult> Photo(int id)
    {
        var lv = await _db.LifeVerifications.FirstOrDefaultAsync(l => l.Id == id) ?? throw new AppException("Not found.", 404);
        var stream = _files.OpenRead(lv.PhotoPath) ?? throw new AppException("Photo file is missing.", 404);
        _audit.Log("LifeVerification.PhotoViewed", nameof(LifeVerification), id.ToString());
        await _db.SaveChangesAsync();
        return File(stream, lv.PhotoContentType);
    }

    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<MessageResponse>> Approve(int id)
    {
        var lv = await Find(id);
        if (lv.Status != LifeVerificationStatus.Pending) throw new AppException("Only pending verifications can be approved.");
        var months = await _settings.GetIntAsync(SettingKeys.LifeVerificationValidityMonths, 12);
        lv.Status = LifeVerificationStatus.Approved;
        lv.ReviewedAt = DateTime.UtcNow;
        lv.ReviewedById = CurrentUserId;
        lv.ValidUntil = DateTime.UtcNow.AddMonths(months);
        _audit.Log("LifeVerification.Approved", nameof(LifeVerification), id.ToString(), $"Valid until {lv.ValidUntil:yyyy-MM-dd}");
        _notify.Notify(lv.Pensioner!.UserId, "Life verification approved", $"Your life verification is valid until {lv.ValidUntil:dd MMM yyyy}.",
            "জীবিত যাচাই অনুমোদিত", $"আপনার জীবিত যাচাই {lv.ValidUntil:dd MMM yyyy} পর্যন্ত বৈধ।", "success", "/app/life-verification");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Life verification approved."));
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult<MessageResponse>> Reject(int id, ReasonRequest req)
    {
        var lv = await Find(id);
        if (lv.Status != LifeVerificationStatus.Pending) throw new AppException("Only pending verifications can be rejected.");
        lv.Status = LifeVerificationStatus.Rejected;
        lv.RejectionReason = req.Reason.Trim();
        lv.ReviewedAt = DateTime.UtcNow;
        lv.ReviewedById = CurrentUserId;
        _audit.Log("LifeVerification.Rejected", nameof(LifeVerification), id.ToString(), lv.RejectionReason);
        _notify.Notify(lv.Pensioner!.UserId, "Life verification rejected", $"Please submit again. Reason: {lv.RejectionReason}",
            "জীবিত যাচাই প্রত্যাখ্যাত", $"অনুগ্রহ করে আবার জমা দিন। কারণ: {lv.RejectionReason}", "error", "/app/life-verification");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Life verification rejected."));
    }

    private async Task<LifeVerification> Find(int id) =>
        await _db.LifeVerifications.Include(l => l.Pensioner).FirstOrDefaultAsync(l => l.Id == id)
        ?? throw new AppException("Life verification not found.", 404);
}
