using System.ComponentModel.DataAnnotations;
using SmartPension.Api.Models;

namespace SmartPension.Api.DTOs;

public class LoginRequest
{
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = string.Empty;
    [Required, MaxLength(100)] public string Password { get; set; } = string.Empty;
}

public class BankAccountInput
{
    [Required, StringLength(120, MinimumLength = 2)] public string BankName { get; set; } = string.Empty;
    [Required, StringLength(120, MinimumLength = 2)] public string BranchName { get; set; } = string.Empty;
    [Required, StringLength(150, MinimumLength = 2)] public string AccountHolderName { get; set; } = string.Empty;
    [Required, RegularExpression(@"^\d{8,20}$", ErrorMessage = "Account number must be 8–20 digits.")]
    public string AccountNumber { get; set; } = string.Empty;
    [RegularExpression(@"^\d{9}$", ErrorMessage = "Routing number must be 9 digits.")]
    public string? RoutingNumber { get; set; }
}

/// <summary>Identifies a person against the imported master list (PensionRecords).</summary>
public class VerifyRecordRequest
{
    [Required, RegularExpression(@"^[A-Za-z0-9-]{4,30}$", ErrorMessage = "Enter your Pension ID as printed on your pension documents.")]
    public string PensionId { get; set; } = string.Empty;
    [Required, RegularExpression(@"^(\d{10}|\d{13}|\d{17})$", ErrorMessage = "NID must be 10, 13 or 17 digits.")]
    public string NidNumber { get; set; } = string.Empty;
    [Required] public DateTime? DateOfBirth { get; set; }
}

/// <summary>What the person sees after a successful match, so they can confirm it is their record.</summary>
public record RecordPreview(
    string PensionId, string FullName, string? FullNameBn, Gender Gender, PensionType PensionType,
    string FormerOrganization, string Designation, DateTime RetirementDate, decimal MonthlyPensionAmount, string? Phone);

public class RegisterRequest : VerifyRecordRequest
{
    // Account
    [Required, EmailAddress, MaxLength(256)] public string Email { get; set; } = string.Empty;
    [Required, StringLength(100, MinimumLength = 8)] public string Password { get; set; } = string.Empty;
    [Required, Compare(nameof(Password), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;
    [Required, RegularExpression(@"^(\+?880)?01[3-9]\d{8}$", ErrorMessage = "Enter a valid Bangladeshi mobile number.")]
    public string Phone { get; set; } = string.Empty;

    // Personal details not held in the master list
    [Required, StringLength(300, MinimumLength = 5)] public string Address { get; set; } = string.Empty;
    [MaxLength(150)] public string? FullNameBn { get; set; }

    // Bank (optional, can be added later)
    public BankAccountInput? BankAccount { get; set; }

    [Range(typeof(bool), "true", "true", ErrorMessage = "You must accept the Terms and Privacy Policy.")]
    public bool AcceptedTerms { get; set; }

    [MaxLength(5)] public string? PreferredLanguage { get; set; }
}

public class ChangePasswordRequest
{
    [Required] public string CurrentPassword { get; set; } = string.Empty;
    [Required, StringLength(100, MinimumLength = 8)] public string NewPassword { get; set; } = string.Empty;
    [Required, Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class PreferencesRequest
{
    [Required, RegularExpression("^(en|bn)$")] public string Language { get; set; } = "en";
}

public record UserDto(
    string Id, string Email, string FullName, IList<string> Roles, string PreferredLanguage,
    int? PensionerId, string? PensionId, string? PensionerStatus, DateTime? LastLoginAt);

public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);
