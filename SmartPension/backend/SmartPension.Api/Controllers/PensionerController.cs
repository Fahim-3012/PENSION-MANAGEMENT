using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers;

[Route("api/pensioner")]
[Authorize(Policy = Policies.PensionerOnly)]
public class PensionerController : PensionerControllerBase
{
    private readonly PensionService _pension;
    private readonly AuditService _audit;

    public PensionerController(AppDbContext db, PensionService pension, AuditService audit) : base(db)
    {
        _pension = pension; _audit = audit;
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardDto>> Dashboard()
    {
        var p = await GetPensionerAsync();
        var email = await Db.Users.Where(u => u.Id == p.UserId).Select(u => u.Email).FirstAsync() ?? string.Empty;
        var banks = await Db.BankAccounts.Where(b => b.PensionerId == p.Id).ToListAsync();
        var primary = banks.FirstOrDefault(b => b.IsPrimary) ?? banks.FirstOrDefault();
        var eligibility = await _pension.CheckEligibilityAsync(p);
        var (lifeState, lifeUntil) = await _pension.GetLifeStateAsync(p.Id);

        var recent = await Db.Transactions.Where(t => t.PensionerId == p.Id)
            .OrderByDescending(t => t.CreatedAt).Take(5).ToListAsync();
        var latestWithdrawal = await Db.Withdrawals.Include(w => w.BankAccount)
            .Where(w => w.PensionerId == p.Id).OrderByDescending(w => w.RequestedAt).FirstOrDefaultAsync();
        var unread = await Db.Notifications.CountAsync(n => n.UserId == p.UserId && !n.IsRead);
        var nominees = await Db.Nominees.CountAsync(n => n.PensionerId == p.Id);

        var now = DateTime.UtcNow;
        var start = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc).AddMonths(-11);
        var payments = await Db.Payments.Where(x => x.PensionerId == p.Id && x.Status == PaymentStatus.Success)
            .Select(x => new { x.Year, x.Month, x.Amount }).ToListAsync();
        var withdrawals = await Db.Transactions
            .Where(t => t.PensionerId == p.Id && t.Type == TransactionType.Debit && t.CreatedAt >= start)
            .Select(t => new { t.CreatedAt, t.Amount }).ToListAsync();

        var chart = Enumerable.Range(0, 12).Select(i =>
        {
            var m = start.AddMonths(i);
            return new ChartPoint(m.ToString("MMM yy", CultureInfo.InvariantCulture), m.Year, m.Month,
                payments.Where(x => x.Year == m.Year && x.Month == m.Month).Sum(x => x.Amount),
                withdrawals.Where(x => x.CreatedAt.Year == m.Year && x.CreatedAt.Month == m.Month).Sum(x => x.Amount));
        }).ToList();
        var totalThisYear = payments.Where(x => x.Year == now.Year).Sum(x => x.Amount);

        return Ok(new DashboardDto(p.ToProfileDto(email), eligibility, PensionService.GetBankState(banks),
            primary?.ToDto(), lifeState, lifeUntil, recent.Select(t => t.ToDto()).ToList(),
            latestWithdrawal?.ToDto(), unread, nominees, totalThisYear, chart));
    }

    /// <summary>Yearly totals (last 5 years) of credited pension and withdrawals for the dashboard chart filter.</summary>
    [HttpGet("chart")]
    public async Task<ActionResult<IEnumerable<ChartPoint>>> Chart([FromQuery] string range = "yearly")
    {
        var p = await GetPensionerAsync();
        var now = DateTime.UtcNow;
        var firstYear = now.Year - 4;
        var payments = await Db.Payments.Where(x => x.PensionerId == p.Id && x.Status == PaymentStatus.Success && x.Year >= firstYear)
            .Select(x => new { x.Year, x.Amount }).ToListAsync();
        var start = new DateTime(firstYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var debits = await Db.Transactions.Where(t => t.PensionerId == p.Id && t.Type == TransactionType.Debit && t.CreatedAt >= start)
            .Select(t => new { t.CreatedAt, t.Amount }).ToListAsync();
        return Ok(Enumerable.Range(firstYear, 5).Select(y => new ChartPoint(y.ToString(CultureInfo.InvariantCulture), y, 0,
            payments.Where(x => x.Year == y).Sum(x => x.Amount), debits.Where(d => d.CreatedAt.Year == y).Sum(d => d.Amount))).ToList());
    }

    [HttpGet("profile")]
    public async Task<ActionResult<PensionerProfileDto>> Profile()
    {
        var p = await GetPensionerAsync();
        var email = await Db.Users.Where(u => u.Id == p.UserId).Select(u => u.Email).FirstAsync() ?? string.Empty;
        return Ok(p.ToProfileDto(email));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<PensionerProfileDto>> UpdateProfile(UpdateProfileRequest req)
    {
        var p = await GetPensionerAsync();
        p.Phone = req.Phone;
        p.Address = req.Address.Trim();
        p.FullNameBn = string.IsNullOrWhiteSpace(req.FullNameBn) ? null : req.FullNameBn.Trim();
        p.UpdatedAt = DateTime.UtcNow;
        _audit.Log("Pensioner.ProfileUpdated", nameof(Pensioner), p.Id.ToString());
        await Db.SaveChangesAsync();
        var email = await Db.Users.Where(u => u.Id == p.UserId).Select(u => u.Email).FirstAsync() ?? string.Empty;
        return Ok(p.ToProfileDto(email));
    }
}

[Route("api/bank-accounts")]
[Authorize(Policy = Policies.PensionerOnly)]
public class BankAccountsController : PensionerControllerBase
{
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public BankAccountsController(AppDbContext db, AuditService audit, NotificationService notify) : base(db)
    {
        _audit = audit; _notify = notify;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BankAccountDto>>> List()
    {
        var p = await GetPensionerAsync();
        var list = await Db.BankAccounts.Where(b => b.PensionerId == p.Id)
            .OrderByDescending(b => b.IsPrimary).ThenByDescending(b => b.CreatedAt).ToListAsync();
        return Ok(list.Select(b => b.ToDto()));
    }

    [HttpPost]
    public async Task<ActionResult<BankAccountDto>> Create(BankAccountInput req)
    {
        var p = await GetPensionerAsync();
        var count = await Db.BankAccounts.CountAsync(b => b.PensionerId == p.Id);
        if (count >= 3) throw new AppException("You can register up to 3 bank accounts.");
        if (await Db.BankAccounts.AnyAsync(b => b.PensionerId == p.Id && b.AccountNumber == req.AccountNumber && b.Status != VerificationStatus.Rejected))
            throw new AppException("This account number is already added.");

        var account = new BankAccount
        {
            PensionerId = p.Id, BankName = req.BankName.Trim(), BranchName = req.BranchName.Trim(),
            AccountHolderName = req.AccountHolderName.Trim(), AccountNumber = req.AccountNumber,
            RoutingNumber = req.RoutingNumber, IsPrimary = count == 0
        };
        Db.BankAccounts.Add(account);
        await Db.SaveChangesAsync();
        _audit.Log("BankAccount.Added", nameof(BankAccount), account.Id.ToString(), $"{account.BankName} {Mask.Tail(account.AccountNumber)}");
        await _notify.NotifyAdminsAsync("Bank verification needed", $"{p.FullName} added a bank account for verification.", "/admin/bank-verifications");
        await Db.SaveChangesAsync();
        return Ok(account.ToDto());
    }

    [HttpPut("{id:int}/primary")]
    public async Task<ActionResult<MessageResponse>> SetPrimary(int id)
    {
        var p = await GetPensionerAsync();
        var accounts = await Db.BankAccounts.Where(b => b.PensionerId == p.Id).ToListAsync();
        var target = accounts.FirstOrDefault(b => b.Id == id) ?? throw new AppException("Bank account not found.", 404);
        if (target.Status == VerificationStatus.Rejected) throw new AppException("A rejected account cannot be primary.");
        foreach (var a in accounts) a.IsPrimary = a.Id == id;
        _audit.Log("BankAccount.PrimaryChanged", nameof(BankAccount), id.ToString());
        await Db.SaveChangesAsync();
        return Ok(new MessageResponse("Primary account updated."));
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<MessageResponse>> Delete(int id)
    {
        var p = await GetPensionerAsync();
        var account = await Db.BankAccounts.FirstOrDefaultAsync(b => b.Id == id && b.PensionerId == p.Id)
            ?? throw new AppException("Bank account not found.", 404);
        if (await Db.Withdrawals.AnyAsync(w => w.BankAccountId == id))
            throw new AppException("This account is linked to withdrawal records and cannot be removed.");
        Db.BankAccounts.Remove(account);
        if (account.IsPrimary)
        {
            var next = await Db.BankAccounts.Where(b => b.PensionerId == p.Id && b.Id != id)
                .OrderByDescending(b => b.Status == VerificationStatus.Verified).FirstOrDefaultAsync();
            if (next != null) next.IsPrimary = true;
        }
        _audit.Log("BankAccount.Removed", nameof(BankAccount), id.ToString());
        await Db.SaveChangesAsync();
        return Ok(new MessageResponse("Bank account removed."));
    }
}

[Route("api/nominees")]
[Authorize(Policy = Policies.PensionerOnly)]
public class NomineesController : PensionerControllerBase
{
    private readonly AuditService _audit;
    public NomineesController(AppDbContext db, AuditService audit) : base(db) => _audit = audit;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NomineeDto>>> List()
    {
        var p = await GetPensionerAsync();
        var list = await Db.Nominees.Where(n => n.PensionerId == p.Id).OrderBy(n => n.CreatedAt).ToListAsync();
        return Ok(list.Select(n => n.ToDto()));
    }

    [HttpPost]
    public async Task<ActionResult<NomineeDto>> Create(NomineeRequest req)
    {
        var p = await GetPensionerAsync();
        await EnsureShareAsync(p.Id, req.SharePercentage, null);
        var n = new Nominee { PensionerId = p.Id };
        Apply(n, req);
        Db.Nominees.Add(n);
        await Db.SaveChangesAsync();
        _audit.Log("Nominee.Added", nameof(Nominee), n.Id.ToString(), n.FullName);
        await Db.SaveChangesAsync();
        return Ok(n.ToDto());
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<NomineeDto>> Update(int id, NomineeRequest req)
    {
        var p = await GetPensionerAsync();
        var n = await Db.Nominees.FirstOrDefaultAsync(x => x.Id == id && x.PensionerId == p.Id)
            ?? throw new AppException("Nominee not found.", 404);
        await EnsureShareAsync(p.Id, req.SharePercentage, id);
        var existingNid = n.NidNumber;
        Apply(n, req);
        // The client only sees a masked NID, so an empty value on update means "keep the current NID".
        if (string.IsNullOrWhiteSpace(req.NidNumber)) n.NidNumber = existingNid;
        n.UpdatedAt = DateTime.UtcNow;
        _audit.Log("Nominee.Updated", nameof(Nominee), n.Id.ToString(), n.FullName);
        await Db.SaveChangesAsync();
        return Ok(n.ToDto());
    }

    [HttpDelete("{id:int}")]
    public async Task<ActionResult<MessageResponse>> Delete(int id)
    {
        var p = await GetPensionerAsync();
        var n = await Db.Nominees.FirstOrDefaultAsync(x => x.Id == id && x.PensionerId == p.Id)
            ?? throw new AppException("Nominee not found.", 404);
        Db.Nominees.Remove(n);
        _audit.Log("Nominee.Removed", nameof(Nominee), id.ToString(), n.FullName);
        await Db.SaveChangesAsync();
        return Ok(new MessageResponse("Nominee removed."));
    }

    private static void Apply(Nominee n, NomineeRequest r)
    {
        n.FullName = r.FullName.Trim();
        n.Relationship = r.Relationship.Trim();
        n.NidNumber = string.IsNullOrWhiteSpace(r.NidNumber) ? null : r.NidNumber;
        n.Phone = string.IsNullOrWhiteSpace(r.Phone) ? null : r.Phone;
        n.DateOfBirth = r.DateOfBirth?.Date;
        n.SharePercentage = Math.Round(r.SharePercentage, 2);
    }

    private async Task EnsureShareAsync(int pensionerId, decimal share, int? excludeId)
    {
        var others = await Db.Nominees.Where(n => n.PensionerId == pensionerId && n.Id != (excludeId ?? 0))
            .SumAsync(n => (decimal?)n.SharePercentage) ?? 0;
        if (others + share > 100)
            throw new AppException($"Total nominee share cannot exceed 100%. Remaining share: {100 - others:0.##}%.");
    }
}

[Route("api")]
[Authorize(Policy = Policies.PensionerOnly)]
public class PaymentsController : PensionerControllerBase
{
    public PaymentsController(AppDbContext db) : base(db) { }

    /// <summary>Monthly pension payments with search (reference/period), status and year filters.</summary>
    [HttpGet("payments")]
    public async Task<ActionResult<PagedResult<PaymentDto>>> Payments([FromQuery] PageQuery q, [FromQuery] int? year)
    {
        var p = await GetPensionerAsync();
        var query = Db.Payments.Where(x => x.PensionerId == p.Id);
        if (ParseEnum<PaymentStatus>(q.Status) is { } st) query = query.Where(x => x.Status == st);
        if (year is > 0) query = query.Where(x => x.Year == year);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(x => (x.Reference != null && x.Reference.Contains(s)) || (x.FailureReason != null && x.FailureReason.Contains(s)));
        }
        query = q.SortBy switch
        {
            "amount" => q.SortDesc ? query.OrderByDescending(x => x.Amount) : query.OrderBy(x => x.Amount),
            _ => q.SortDesc ? query.OrderByDescending(x => x.Year).ThenByDescending(x => x.Month) : query.OrderBy(x => x.Year).ThenBy(x => x.Month)
        };
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ToListAsync();
        return Ok(new PagedResult<PaymentDto>(items.Select(x => x.ToDto()).ToList(), total, q.Page, q.PageSize));
    }

    [HttpGet("payments/years")]
    public async Task<ActionResult<IEnumerable<int>>> Years()
    {
        var p = await GetPensionerAsync();
        return Ok(await Db.Payments.Where(x => x.PensionerId == p.Id).Select(x => x.Year).Distinct().OrderByDescending(y => y).ToListAsync());
    }

    [HttpGet("transactions")]
    public async Task<ActionResult<PagedResult<TransactionDto>>> Transactions([FromQuery] PageQuery q,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? type)
    {
        var p = await GetPensionerAsync();
        var query = Db.Transactions.Where(t => t.PensionerId == p.Id);
        if (ParseEnum<TransactionType>(type) is { } tt) query = query.Where(t => t.Type == tt);
        if (from.HasValue) query = query.Where(t => t.CreatedAt >= from.Value.Date);
        if (to.HasValue) query = query.Where(t => t.CreatedAt < to.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(t => t.Description.Contains(s) || (t.Reference != null && t.Reference.Contains(s)));
        }
        query = q.SortDesc ? query.OrderByDescending(t => t.CreatedAt) : query.OrderBy(t => t.CreatedAt);
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ToListAsync();
        return Ok(new PagedResult<TransactionDto>(items.Select(t => t.ToDto()).ToList(), total, q.Page, q.PageSize));
    }
}
