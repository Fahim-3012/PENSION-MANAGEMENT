using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;

namespace SmartPension.Api.Services;

/// <summary>Core pension business rules: eligibility, life status, ledger postings and payment processing.</summary>
public class PensionService(AppDbContext db, SettingsService settings, NotificationService notifications)
{
    public static readonly WithdrawalStatus[] OpenWithdrawalStatuses =
        { WithdrawalStatus.Pending, WithdrawalStatus.UnderReview, WithdrawalStatus.Approved };

    public async Task<LifeVerification?> GetValidLifeVerificationAsync(int pensionerId)
    {
        var now = DateTime.UtcNow;
        return await db.LifeVerifications
            .Where(l => l.PensionerId == pensionerId && l.Status == LifeVerificationStatus.Approved && l.ValidUntil >= now)
            .OrderByDescending(l => l.ValidUntil).FirstOrDefaultAsync();
    }

    /// <summary>Returns Verified / Pending / Expired / Rejected / NotSubmitted.</summary>
    public async Task<(string State, DateTime? ValidUntil)> GetLifeStateAsync(int pensionerId)
    {
        var valid = await GetValidLifeVerificationAsync(pensionerId);
        if (valid != null) return ("Verified", valid.ValidUntil);
        var latest = await db.LifeVerifications.Where(l => l.PensionerId == pensionerId)
            .OrderByDescending(l => l.SubmittedAt).FirstOrDefaultAsync();
        if (latest == null) return ("NotSubmitted", null);
        return latest.Status switch
        {
            LifeVerificationStatus.Pending => ("Pending", null),
            LifeVerificationStatus.Rejected => ("Rejected", null),
            _ => ("Expired", latest.ValidUntil)
        };
    }

    /// <summary>Returns Verified / Pending / Rejected / None based on the pensioner's accounts.</summary>
    public static string GetBankState(IEnumerable<BankAccount> accounts)
    {
        var list = accounts.ToList();
        if (list.Any(b => b.Status == VerificationStatus.Verified)) return "Verified";
        if (list.Any(b => b.Status == VerificationStatus.Pending)) return "Pending";
        if (list.Any(b => b.Status == VerificationStatus.Rejected)) return "Rejected";
        return "None";
    }

    public async Task<WithdrawalEligibility> CheckEligibilityAsync(Pensioner p)
    {
        var reasons = new List<string>();
        var now = DateTime.UtcNow;
        var min = await settings.GetDecimalAsync(SettingKeys.MinWithdrawalAmount, 500);
        var maxPerMonth = await settings.GetIntAsync(SettingKeys.MaxWithdrawalsPerMonth, 1);

        var active = p.Status == PensionerStatus.Active;
        if (!active) reasons.Add("ACCOUNT_NOT_ACTIVE");

        var hasBank = await db.BankAccounts.AnyAsync(b => b.PensionerId == p.Id && b.Status == VerificationStatus.Verified);
        if (!hasBank) reasons.Add("NO_VERIFIED_BANK");

        var life = await GetValidLifeVerificationAsync(p.Id);
        if (life == null) reasons.Add("LIFE_VERIFICATION_REQUIRED");

        if (await db.Withdrawals.AnyAsync(w => w.PensionerId == p.Id && (w.Status == WithdrawalStatus.Pending
                || w.Status == WithdrawalStatus.UnderReview || w.Status == WithdrawalStatus.Approved)))
            reasons.Add("OPEN_REQUEST_EXISTS");

        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var thisMonth = await db.Withdrawals.CountAsync(w => w.PensionerId == p.Id && w.RequestedAt >= monthStart
            && w.Status != WithdrawalStatus.Rejected && w.Status != WithdrawalStatus.Cancelled);
        var limitReached = thisMonth >= maxPerMonth;
        if (limitReached) reasons.Add("MONTHLY_LIMIT_REACHED");

        if (p.Balance < min) reasons.Add("INSUFFICIENT_BALANCE");

        var eligible = reasons.Count == 0;
        DateTime? next = eligible ? now.Date
            : limitReached && reasons.All(r => r is "MONTHLY_LIMIT_REACHED" or "OPEN_REQUEST_EXISTS" or "INSUFFICIENT_BALANCE")
                ? monthStart.AddMonths(1)
                : null;

        return new WithdrawalEligibility(eligible, reasons, p.Balance, min, next, hasBank, life != null,
            life?.ValidUntil, active);
    }

    public Transaction Post(Pensioner p, TransactionType type, decimal amount, string description, string? reference,
        int? paymentId = null, int? withdrawalId = null)
    {
        if (type == TransactionType.Debit && p.Balance < amount)
            throw new AppException("Insufficient balance for this transaction.");
        p.Balance += type == TransactionType.Credit ? amount : -amount;
        p.ConcurrencyStamp = Guid.NewGuid();
        p.UpdatedAt = DateTime.UtcNow;
        var tx = new Transaction
        {
            PensionerId = p.Id, Type = type, Amount = amount, BalanceAfter = p.Balance, Description = description,
            Reference = reference, PaymentId = paymentId, WithdrawalId = withdrawalId, CreatedAt = DateTime.UtcNow
        };
        db.Transactions.Add(tx);
        return tx;
    }

    /// <summary>
    /// Processes a pending monthly payment. No external payment gateway is configured, so a successful
    /// payment is an internal credit to the pension account. Pre-conditions are checked for real.
    /// </summary>
    public async Task<bool> ProcessPaymentAsync(Payment payment, string adminId)
    {
        if (payment.Status != PaymentStatus.Pending) throw new AppException("Only pending payments can be processed.");
        var p = payment.Pensioner ?? await db.Pensioners.FirstAsync(x => x.Id == payment.PensionerId);
        var period = new DateTime(payment.Year, payment.Month, 1).ToString("MMMM yyyy", CultureInfo.InvariantCulture);

        string? failure = null;
        if (p.Status != PensionerStatus.Active) failure = "Pensioner account is not active.";
        else if (await GetValidLifeVerificationAsync(p.Id) == null) failure = "Life verification is missing or expired.";

        payment.ProcessedAt = DateTime.UtcNow;
        payment.ProcessedById = adminId;

        if (failure != null)
        {
            payment.Status = PaymentStatus.Failed;
            payment.FailureReason = failure;
            notifications.Notify(p.UserId, "Pension payment failed",
                $"Your pension for {period} could not be credited: {failure}",
                "পেনশন প্রদান ব্যর্থ হয়েছে",
                $"{period} মাসের পেনশন জমা করা যায়নি। কারণ: {failure}", "error", "/app/payments");
            return false;
        }

        payment.Status = PaymentStatus.Success;
        payment.FailureReason = null;
        payment.Reference = $"PAY-{payment.Year}{payment.Month:D2}-{payment.Id:D6}";
        Post(p, TransactionType.Credit, payment.Amount, $"Monthly pension – {period}", payment.Reference, paymentId: payment.Id);
        notifications.Notify(p.UserId, "Pension credited",
            $"Your pension of BDT {payment.Amount:N2} for {period} has been credited to your pension account.",
            "পেনশন জমা হয়েছে",
            $"{period} মাসের পেনশন BDT {payment.Amount:N2} আপনার পেনশন অ্যাকাউন্টে জমা হয়েছে।", "success", "/app/payments");
        return true;
    }
}
