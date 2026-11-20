using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers;

[Route("api/auth")]
public class AuthController : ApiControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly SignInManager<ApplicationUser> _signIn;
    private readonly TokenService _tokens;
    private readonly AuditService _audit;
    private readonly NotificationService _notify;
    private readonly RegistryService _registry;

    public AuthController(AppDbContext db, UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn,
        TokenService tokens, AuditService audit, NotificationService notify, RegistryService registry)
    {
        _db = db; _users = users; _signIn = signIn; _tokens = tokens; _audit = audit; _notify = notify; _registry = registry;
    }

    /// <summary>Step 1 of sign-up: checks Pension ID + NID + date of birth against the master list.</summary>
    [HttpPost("verify-record")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<RecordPreview>> VerifyRecord(VerifyRecordRequest req)
    {
        var record = await _registry.MatchAsync(req.PensionId, req.NidNumber, req.DateOfBirth!.Value);
        return Ok(RegistryService.Preview(record));
    }

    /// <summary>
    /// Creates an ACTIVE account for a person found in the master list. There is no admin approval:
    /// name, NID, date of birth, pension type, organisation and monthly amount come from the record.
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req)
    {
        var record = await _registry.MatchAsync(req.PensionId, req.NidNumber, req.DateOfBirth!.Value);

        var email = req.Email.Trim().ToLowerInvariant();
        if (await _users.FindByEmailAsync(email) != null)
            return ValidationField(nameof(req.Email), "An account with this email already exists.");
        if (await _db.Pensioners.AnyAsync(p => p.Phone == req.Phone))
            return ValidationField(nameof(req.Phone), "This mobile number is already used by another account.");
        if (await _db.Pensioners.AnyAsync(p => p.NidNumber == record.NidNumber))
            throw new AppException("An account already exists for this NID. Please sign in.", StatusCodes.Status409Conflict);
        if (req.BankAccount is { } bank &&
            !string.Equals(string.Join(' ', bank.AccountHolderName.Split(' ', StringSplitOptions.RemoveEmptyEntries)),
                string.Join(' ', record.FullName.Split(' ', StringSplitOptions.RemoveEmptyEntries)), StringComparison.OrdinalIgnoreCase))
            return ValidationField("AccountHolderName", "Account holder name must match the name on your pension record.");

        await using var tx = await _db.Database.BeginTransactionAsync();

        var user = new ApplicationUser
        {
            UserName = email, Email = email, FullName = record.FullName, PhoneNumber = req.Phone,
            PreferredLanguage = req.PreferredLanguage == "bn" ? "bn" : "en"
        };
        var created = await _users.CreateAsync(user, req.Password);
        if (!created.Succeeded)
        {
            foreach (var e in created.Errors) ModelState.AddModelError(nameof(req.Password), e.Description);
            return ValidationProblem(ModelState);
        }
        await _users.AddToRoleAsync(user, Roles.Pensioner);

        var now = DateTime.UtcNow;
        var pensioner = new Pensioner
        {
            UserId = user.Id, PensionId = record.PensionId, FullName = record.FullName,
            FullNameBn = string.IsNullOrWhiteSpace(req.FullNameBn) ? record.FullNameBn : req.FullNameBn.Trim(),
            NidNumber = record.NidNumber, DateOfBirth = record.DateOfBirth, Gender = record.Gender, Phone = req.Phone,
            Address = req.Address.Trim(), PensionType = record.PensionType, FormerOrganization = record.FormerOrganization,
            Designation = record.Designation, EmployeeId = record.EmployeeId, RetirementDate = record.RetirementDate,
            LastBasicSalary = record.LastBasicSalary, MonthlyPensionAmount = record.MonthlyPensionAmount,
            Status = PensionerStatus.Active, ApprovedAt = now
        };
        _db.Pensioners.Add(pensioner);
        await _db.SaveChangesAsync();

        record.ClaimedByPensionerId = pensioner.Id;
        record.ClaimedAt = now;

        if (req.BankAccount is { } b)
        {
            _db.BankAccounts.Add(new BankAccount
            {
                PensionerId = pensioner.Id, BankName = b.BankName.Trim(), BranchName = b.BranchName.Trim(),
                AccountHolderName = b.AccountHolderName.Trim(), AccountNumber = b.AccountNumber,
                RoutingNumber = b.RoutingNumber, IsPrimary = true
            });
            await _notify.NotifyAdminsAsync("Bank verification needed", $"{pensioner.FullName} ({pensioner.PensionId}) added a bank account.", "/admin/bank-verifications");
        }

        _notify.Notify(user.Id, "Welcome to Smart Pension",
            $"Your account is active. Monthly pension: BDT {pensioner.MonthlyPensionAmount:N2}. Next: verify your bank account and complete life verification.",
            "স্মার্ট পেনশনে স্বাগতম",
            $"আপনার অ্যাকাউন্ট সক্রিয়। মাসিক পেনশন: BDT {pensioner.MonthlyPensionAmount:N2}। এরপর ব্যাংক অ্যাকাউন্ট যাচাই ও জীবিত যাচাই সম্পন্ন করুন।",
            "success", "/app/dashboard");
        _audit.Log("Pensioner.Registered", nameof(Pensioner), pensioner.Id.ToString(), $"{pensioner.PensionId} (matched registry record {record.Id})", user.Id, email);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(await BuildAuthResponse(user));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await _users.FindByEmailAsync(email);
        if (user == null)
            throw new AppException("Invalid email or password.", StatusCodes.Status401Unauthorized);
        if (!user.IsActive)
            throw new AppException("This account has been deactivated. Please contact support.", StatusCodes.Status403Forbidden);

        var result = await _signIn.CheckPasswordSignInAsync(user, req.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            _audit.Log("Auth.LockedOut", "User", user.Id, null, user.Id, email);
            await _db.SaveChangesAsync();
            throw new AppException("Too many failed attempts. Your account is locked for 15 minutes.", StatusCodes.Status423Locked);
        }
        if (!result.Succeeded)
        {
            _audit.Log("Auth.LoginFailed", "User", user.Id, null, user.Id, email);
            await _db.SaveChangesAsync();
            throw new AppException("Invalid email or password.", StatusCodes.Status401Unauthorized);
        }

        user.LastLoginAt = DateTime.UtcNow;
        await _users.UpdateAsync(user);
        _audit.Log("Auth.Login", "User", user.Id, null, user.Id, email);
        await _db.SaveChangesAsync();
        return Ok(await BuildAuthResponse(user));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserDto>> Me()
    {
        var user = await _users.FindByIdAsync(CurrentUserId)
            ?? throw new AppException("User not found.", StatusCodes.Status401Unauthorized);
        if (!user.IsActive) throw new AppException("This account has been deactivated.", StatusCodes.Status401Unauthorized);
        return Ok(await BuildUserDto(user));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult<MessageResponse>> ChangePassword(ChangePasswordRequest req)
    {
        var user = await _users.FindByIdAsync(CurrentUserId) ?? throw new AppException("User not found.", 404);
        var result = await _users.ChangePasswordAsync(user, req.CurrentPassword, req.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var e in result.Errors)
                ModelState.AddModelError(e.Code == "PasswordMismatch" ? nameof(req.CurrentPassword) : nameof(req.NewPassword),
                    e.Code == "PasswordMismatch" ? "Current password is incorrect." : e.Description);
            return ValidationProblem(ModelState);
        }
        _audit.Log("Auth.PasswordChanged", "User", user.Id);
        _notify.Notify(user.Id, "Password changed", "Your password was changed. If this wasn't you, contact support immediately.",
            "পাসওয়ার্ড পরিবর্তন হয়েছে", "আপনার পাসওয়ার্ড পরিবর্তন করা হয়েছে। এটি আপনি না করে থাকলে এখনই সহায়তায় যোগাযোগ করুন।", "warning");
        await _db.SaveChangesAsync();
        return Ok(new MessageResponse("Password changed successfully."));
    }

    [HttpPut("preferences")]
    [Authorize]
    public async Task<ActionResult<UserDto>> UpdatePreferences(PreferencesRequest req)
    {
        var user = await _users.FindByIdAsync(CurrentUserId) ?? throw new AppException("User not found.", 404);
        user.PreferredLanguage = req.Language;
        await _users.UpdateAsync(user);
        return Ok(await BuildUserDto(user));
    }

    private ActionResult ValidationField(string field, string message)
    {
        ModelState.AddModelError(field, message);
        return ValidationProblem(ModelState);
    }

    private async Task<UserDto> BuildUserDto(ApplicationUser user)
    {
        var roles = await _users.GetRolesAsync(user);
        var p = await _db.Pensioners.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == user.Id);
        return new UserDto(user.Id, user.Email ?? string.Empty, user.FullName, roles, user.PreferredLanguage,
            p?.Id, p?.PensionId, p?.Status.ToString(), user.LastLoginAt);
    }

    private async Task<AuthResponse> BuildAuthResponse(ApplicationUser user)
    {
        var (token, expires) = await _tokens.CreateTokenAsync(user);
        return new AuthResponse(token, expires, await BuildUserDto(user));
    }
}
