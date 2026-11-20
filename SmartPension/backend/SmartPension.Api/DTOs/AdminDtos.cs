using System.ComponentModel.DataAnnotations;
using SmartPension.Api.Models;

namespace SmartPension.Api.DTOs;

public record AdminPensionerListItem(
    int Id, string? PensionId, string FullName, string Email, string Phone, PensionType PensionType,
    string FormerOrganization, decimal MonthlyPensionAmount, decimal Balance, PensionerStatus Status,
    string BankStatus, string LifeStatus, DateTime CreatedAt);

public record AdminPensionerDetail(
    int Id, string? PensionId, string FullName, string? FullNameBn, string Email, string NidNumber,
    DateTime DateOfBirth, Gender Gender, string Phone, string Address, PensionType PensionType,
    string FormerOrganization, string Designation, string? EmployeeId, DateTime RetirementDate,
    decimal LastBasicSalary, decimal MonthlyPensionAmount, decimal SuggestedPensionAmount, decimal Balance,
    PensionerStatus Status, string? StatusReason, DateTime? ApprovedAt, DateTime CreatedAt, DateTime? FaceEnrolledAt,
    IReadOnlyList<BankAccountDto> BankAccounts, IReadOnlyList<NomineeDto> Nominees,
    IReadOnlyList<LifeVerificationDto> LifeVerifications, IReadOnlyList<WithdrawalDto> Withdrawals,
    IReadOnlyList<PaymentDto> Payments);

public class UpdatePensionAmountRequest
{
    [Range(1, 10_000_000)] public decimal MonthlyPensionAmount { get; set; }
    [Required, StringLength(500, MinimumLength = 5)] public string Reason { get; set; } = string.Empty;
}

public record AdminBankAccountItem(
    int Id, int PensionerId, string? PensionId, string PensionerName, string BankName, string BranchName,
    string AccountHolderName, string AccountNumber, string? RoutingNumber, VerificationStatus Status,
    string? RejectionReason, DateTime CreatedAt, DateTime? VerifiedAt);

public record AdminWithdrawalItem(
    int Id, int PensionerId, string? PensionId, string PensionerName, decimal Amount, decimal PensionerBalance,
    WithdrawalStatus Status, string BankName, string AccountNumberMasked, string? Note, string? RejectionReason,
    string? Reference, DateTime RequestedAt, DateTime? ReviewStartedAt, DateTime? ReviewedAt, DateTime? PaidAt);

public class MarkPaidRequest
{
    [MaxLength(60)] public string? Reference { get; set; }
}

public record AdminPaymentItem(
    int Id, int PensionerId, string? PensionId, string PensionerName, int Year, int Month, decimal Amount,
    PaymentStatus Status, string? Reference, string? FailureReason, DateTime CreatedAt, DateTime? ProcessedAt);

public class PeriodRequest
{
    [Range(2000, 2100)] public int Year { get; set; }
    [Range(1, 12)] public int Month { get; set; }
}

public class FailPaymentRequest
{
    [Required, StringLength(500, MinimumLength = 5)] public string Reason { get; set; } = string.Empty;
}

public record BatchResult(int Processed, int Succeeded, int Failed, string Message);

public record AdminLifeItem(
    int Id, int PensionerId, string? PensionId, string PensionerName, LifeVerificationStatus Status,
    string? RejectionReason, DateTime SubmittedAt, DateTime? ReviewedAt, DateTime? ValidUntil, string Method,
    double? MatchDistance, bool? LivenessPassed);

public record AdminNomineeItem(
    int Id, int PensionerId, string? PensionId, string PensionerName, string FullName, string Relationship,
    string? NidNumber, string? Phone, decimal SharePercentage, DateTime CreatedAt);

public class RespondComplaintRequest
{
    [Required, StringLength(2000, MinimumLength = 5)] public string Response { get; set; } = string.Empty;
    [Required] public ComplaintStatus? Status { get; set; }
}

public record AuditLogDto(
    long Id, string? UserEmail, string Action, string EntityType, string? EntityId, string? Details,
    string? IpAddress, DateTime CreatedAt);

public record AdminDashboardDto(
    int TotalPensioners, int ActiveAccounts, int RegistryRecords, int UnclaimedRecords, int SuspendedAccounts,
    int PendingWithdrawals, int ApprovedAwaitingPayout, int SuccessfulPayments, decimal SuccessfulPaymentAmount,
    int FailedPayments, int PendingPayments, int PendingBankVerifications, int PendingLifeVerifications,
    int OpenComplaints, decimal DisbursedThisMonth, decimal TotalBalanceHeld,
    IReadOnlyList<AdminWithdrawalItem> RecentWithdrawals, IReadOnlyList<AdminPensionerListItem> RecentRegistrations);

public record AnalyticsPoint(string Label, decimal Disbursed, decimal Withdrawn, int FailedPayments, int NewPensioners);
public record CountItem(string Name, int Value);
public record AnalyticsDto(
    string Range, IReadOnlyList<AnalyticsPoint> Series, IReadOnlyList<CountItem> PensionersByStatus,
    IReadOnlyList<CountItem> WithdrawalsByStatus, IReadOnlyList<CountItem> PensionersByType);

public record ReportSummaryDto(
    DateTime From, DateTime To, int NewRegistrations, int Approvals, int PaymentsSucceeded, decimal AmountDisbursed,
    int PaymentsFailed, int WithdrawalsApproved, decimal AmountWithdrawn, int WithdrawalsRejected,
    int LifeVerificationsApproved, int ComplaintsReceived);

public record SettingDto(string Key, string Value, string? Description, DateTime UpdatedAt);

public class UpdateSettingsRequest
{
    [Required] public Dictionary<string, string> Values { get; set; } = new();
}

public record AdminUserDto(string Id, string Email, string FullName, IList<string> Roles, bool IsActive, DateTime CreatedAt, DateTime? LastLoginAt);

public class CreateAdminRequest
{
    [Required, EmailAddress] public string Email { get; set; } = string.Empty;
    [Required, StringLength(150, MinimumLength = 3)] public string FullName { get; set; } = string.Empty;
    [Required, StringLength(100, MinimumLength = 8)] public string Password { get; set; } = string.Empty;
    [Required, RegularExpression("^(Admin|SuperAdmin)$")] public string Role { get; set; } = Roles.Admin;
}

// ---------- Pensioner registry (master list) ----------
public record ImportError(int Line, string PensionId, string Message);

public record ImportResult(bool DryRun, int Rows, int Created, int Updated, int Unchanged, int WithErrors,
    IReadOnlyList<ImportError> Errors);

public record PensionRecordDto(
    int Id, string PensionId, string FullName, string? FullNameBn, string NidNumber, DateTime DateOfBirth, Gender Gender,
    PensionType PensionType, string FormerOrganization, string Designation, string? EmployeeId, DateTime RetirementDate,
    decimal LastBasicSalary, decimal MonthlyPensionAmount, string? Phone, bool IsActive, int? ClaimedByPensionerId,
    DateTime? ClaimedAt, string? ImportBatch, DateTime UpdatedAt);

/// <summary>Single add/edit. Same rules as a CSV row (see RegistryService.Apply).</summary>
public class PensionRecordRequest
{
    [Required] public string PensionId { get; set; } = string.Empty;
    [Required] public string FullName { get; set; } = string.Empty;
    public string? FullNameBn { get; set; }
    [Required] public string NidNumber { get; set; } = string.Empty;
    [Required] public string DateOfBirth { get; set; } = string.Empty;
    [Required] public string Gender { get; set; } = string.Empty;
    [Required] public string PensionType { get; set; } = string.Empty;
    [Required] public string FormerOrganization { get; set; } = string.Empty;
    [Required] public string Designation { get; set; } = string.Empty;
    public string? EmployeeId { get; set; }
    [Required] public string RetirementDate { get; set; } = string.Empty;
    public string? LastBasicSalary { get; set; }
    [Required] public string MonthlyPensionAmount { get; set; } = string.Empty;
    public string? Phone { get; set; }

    public Dictionary<string, string> ToValues() => new(StringComparer.OrdinalIgnoreCase)
    {
        ["PensionId"] = PensionId, ["FullName"] = FullName, ["FullNameBn"] = FullNameBn ?? "", ["NidNumber"] = NidNumber,
        ["DateOfBirth"] = DateOfBirth, ["Gender"] = Gender, ["PensionType"] = PensionType,
        ["FormerOrganization"] = FormerOrganization, ["Designation"] = Designation, ["EmployeeId"] = EmployeeId ?? "",
        ["RetirementDate"] = RetirementDate, ["LastBasicSalary"] = LastBasicSalary ?? "",
        ["MonthlyPensionAmount"] = MonthlyPensionAmount, ["Phone"] = Phone ?? "",
    };
}

public record RegistryStats(int Total, int Claimed, int Unclaimed, int Inactive, DateTime? LastImportAt);
