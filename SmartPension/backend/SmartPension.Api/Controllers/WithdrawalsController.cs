using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers;

[Route("api/withdrawals")]
[Authorize(Policy = Policies.PensionerOnly)]
public class WithdrawalsController : PensionerControllerBase
{
    private readonly PensionService _pension;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;

    public WithdrawalsController(AppDbContext db, PensionService pension, AuditService audit, NotificationService notify) : base(db)
    {
        _pension = pension; _audit = audit; _notify = notify;
    }

    [HttpGet("eligibility")]
    public async Task<ActionResult<WithdrawalEligibility>> Eligibility()
        => Ok(await _pension.CheckEligibilityAsync(await GetPensionerAsync()));

    [HttpGet]
    public async Task<ActionResult<PagedResult<WithdrawalDto>>> List([FromQuery] PageQuery q)
    {
        var p = await GetPensionerAsync();
        var query = Db.Withdrawals.Include(w => w.BankAccount).Where(w => w.PensionerId == p.Id);
        if (ParseEnum<WithdrawalStatus>(q.Status) is { } st) query = query.Where(w => w.Status == st);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            query = query.Where(w => (w.Reference != null && w.Reference.Contains(s)) || (w.Note != null && w.Note.Contains(s)));
        }
        query = q.SortDesc ? query.OrderByDescending(w => w.RequestedAt) : query.OrderBy(w => w.RequestedAt);
        var total = await query.CountAsync();
        var (skip, take) = Paging(q);
        var items = await query.Skip(skip).Take(take).ToListAsync();
        return Ok(new PagedResult<WithdrawalDto>(items.Select(w => w.ToDto()).ToList(), total, q.Page, q.PageSize));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WithdrawalDto>> Get(int id)
    {
        var p = await GetPensionerAsync();
        var w = await Db.Withdrawals.Include(x => x.BankAccount).FirstOrDefaultAsync(x => x.Id == id && x.PensionerId == p.Id)
            ?? throw new AppException("Withdrawal request not found.", 404);
        return Ok(w.ToDto());
    }

    [HttpPost]
    public async Task<ActionResult<WithdrawalDto>> Create(CreateWithdrawalRequest req)
    {
        var p = await GetPensionerAsync();
        var e = await _pension.CheckEligibilityAsync(p);
        if (!e.Eligible)
            throw new AppException("You are not eligible to withdraw right now: " + string.Join(", ", e.Reasons));

        var amount = Math.Round(req.Amount, 2);
        if (amount < e.MinAmount)
        {
            ModelState.AddModelError(nameof(req.Amount), $"Minimum withdrawal amount is BDT {e.MinAmount:N2}.");
            return ValidationProblem(ModelState);
        }
        if (amount > p.Balance)
        {
            ModelState.AddModelError(nameof(req.Amount), $"Amount exceeds your available balance of BDT {p.Balance:N2}.");
            return ValidationProblem(ModelState);
        }

        var bank = await Db.BankAccounts.FirstOrDefaultAsync(b => b.Id == req.BankAccountId && b.PensionerId == p.Id);
        if (bank == null || bank.Status != VerificationStatus.Verified)
        {
            ModelState.AddModelError(nameof(req.BankAccountId), "Select one of your verified bank accounts.");
            return ValidationProblem(ModelState);
        }

        var w = new Withdrawal
        {
            PensionerId = p.Id, BankAccountId = bank.Id, Amount = amount,
            Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim(), Status = WithdrawalStatus.Pending
        };
        Db.Withdrawals.Add(w);
        await Db.SaveChangesAsync();

        _audit.Log("Withdrawal.Requested", nameof(Withdrawal), w.Id.ToString(), $"BDT {amount:N2}");
        _notify.Notify(p.UserId, "Withdrawal request submitted",
            $"Your request to withdraw BDT {amount:N2} was submitted and is waiting for review.",
            "উত্তোলনের অনুরোধ জমা হয়েছে", $"BDT {amount:N2} উত্তোলনের অনুরোধ জমা হয়েছে এবং পর্যালোচনার অপেক্ষায় আছে।",
            "info", $"/app/withdrawals/{w.Id}");
        await _notify.NotifyAdminsAsync("New withdrawal request", $"{p.FullName} requested BDT {amount:N2}.", "/admin/withdrawals");
        await Db.SaveChangesAsync();

        w.BankAccount = bank;
        return Ok(w.ToDto());
    }

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<WithdrawalDto>> Cancel(int id)
    {
        var p = await GetPensionerAsync();
        var w = await Db.Withdrawals.Include(x => x.BankAccount).FirstOrDefaultAsync(x => x.Id == id && x.PensionerId == p.Id)
            ?? throw new AppException("Withdrawal request not found.", 404);
        if (w.Status != WithdrawalStatus.Pending)
            throw new AppException("Only requests that are still pending can be cancelled.");
        w.Status = WithdrawalStatus.Cancelled;
        w.CancelledAt = DateTime.UtcNow;
        _audit.Log("Withdrawal.Cancelled", nameof(Withdrawal), w.Id.ToString());
        await Db.SaveChangesAsync();
        return Ok(w.ToDto());
    }
}
