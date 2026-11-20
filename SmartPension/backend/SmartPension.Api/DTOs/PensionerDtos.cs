using System.ComponentModel.DataAnnotations;
using SmartPension.Api.Models;

namespace SmartPension.Api.DTOs;

public record PensionerProfileDto(
    int Id, string? PensionId, string FullName, string? FullNameBn, string Email, string NidMasked,
    DateTime DateOfBirth, Gender Gender, string Phone, string Address, PensionType PensionType,
    string FormerOrganization, string Designation, string? EmployeeId, DateTime RetirementDate,
    decimal LastBasicSalary, decimal MonthlyPensionAmount, decimal Balance, PensionerStatus Status,
    string? StatusReason, DateTime? ApprovedAt, DateTime CreatedAt);

public class UpdateProfileRequest
{
    [Required, RegularExpression(@"^(\+?880)?01[3-9]\d{8}$", ErrorMessage = "Enter a valid Bangladeshi mobile number.")]
    public string Phone { get; set; } = string.Empty;
    [Required, StringLength(300, MinimumLength = 5)] public string Address { get; set; } = string.Empty;
    [MaxLength(150)] public string? FullNameBn { get; set; }
}

public record BankAccountDto(
    int Id, string BankName, string BranchName, string AccountHolderName, string AccountNumberMasked,
    string? RoutingNumber, bool IsPrimary, VerificationStatus Status, string? RejectionReason,
    DateTime? VerifiedAt, DateTime CreatedAt);

public class NomineeRequest
{
    [Required, StringLength(150, MinimumLength = 3)] public string FullName { get; set; } = string.Empty;
    [Required, StringLength(50, MinimumLength = 2)] public string Relationship { get; set; } = string.Empty;
    [RegularExpression(@"^(\d{10}|\d{13}|\d{17})$", ErrorMessage = "NID must be 10, 13 or 17 digits.")]
    public string? NidNumber { get; set; }
    [RegularExpression(@"^(\+?880)?01[3-9]\d{8}$", ErrorMessage = "Enter a valid Bangladeshi mobile number.")]
    public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    [Range(0.01, 100, ErrorMessage = "Share must be between 0.01 and 100 percent.")]
    public decimal SharePercentage { get; set; }
}

public record NomineeDto(
    int Id, string FullName, string Relationship, string? NidMasked, string? Phone,
    DateTime? DateOfBirth, decimal SharePercentage, DateTime CreatedAt);

public record PaymentDto(
    int Id, int Year, int Month, decimal Amount, PaymentStatus Status, string? Reference,
    string? FailureReason, DateTime CreatedAt, DateTime? ProcessedAt);

public record TransactionDto(
    int Id, TransactionType Type, decimal Amount, decimal BalanceAfter, string Description,
    string? Reference, DateTime CreatedAt);

public class CreateWithdrawalRequest
{
    [Range(1, 10_000_000, ErrorMessage = "Enter a valid amount.")] public decimal Amount { get; set; }
    [Range(1, int.MaxValue, ErrorMessage = "Select a bank account.")] public int BankAccountId { get; set; }
    [MaxLength(300)] public string? Note { get; set; }
}

public record WithdrawalDto(
    int Id, decimal Amount, WithdrawalStatus Status, string? Note, string? RejectionReason,
    string? Reference, string BankName, string AccountNumberMasked, DateTime RequestedAt,
    DateTime? ReviewStartedAt, DateTime? ReviewedAt, DateTime? PaidAt, DateTime? CancelledAt);

public record WithdrawalEligibility(
    bool Eligible, IReadOnlyList<string> Reasons, decimal AvailableBalance, decimal MinAmount,
    DateTime? NextEligibleDate, bool HasVerifiedBank, bool LifeVerified, DateTime? LifeValidUntil,
    bool AccountActive);

public record LifeVerificationDto(
    int Id, LifeVerificationStatus Status, string? RejectionReason, DateTime SubmittedAt,
    DateTime? ReviewedAt, DateTime? ValidUntil, string Method, double? MatchDistance, bool? LivenessPassed);

public record LifeStatusDto(
    string State, DateTime? ValidUntil, LifeVerificationDto? Latest, IReadOnlyList<LifeVerificationDto> History,
    bool FaceEnrolled, DateTime? FaceEnrolledAt, double FaceMatchThreshold);

/// <summary>Multipart fields sent with the photo by the AI face check.</summary>
public class FaceVerifyForm
{
    /// <summary>JSON array of 128 numbers produced by face-api.js (FaceRecognitionNet).</summary>
    [Required, StringLength(4000, MinimumLength = 200)] public string Descriptor { get; set; } = string.Empty;
    [MaxLength(100)] public string? Challenge { get; set; }
    public bool LivenessPassed { get; set; }
}

/// <summary>Outcome: Enrolled | Verified | NotMatched | LivenessFailed.</summary>
public record FaceResultDto(string Outcome, double? Distance, double Threshold, string Message, LifeVerificationDto Record);

public record ChartPoint(string Label, int Year, int Month, decimal Credited, decimal Withdrawn);

public record DashboardDto(
    PensionerProfileDto Profile,
    WithdrawalEligibility Eligibility,
    string BankStatus,
    BankAccountDto? PrimaryBank,
    string LifeStatus,
    DateTime? LifeValidUntil,
    IReadOnlyList<TransactionDto> RecentTransactions,
    WithdrawalDto? LatestWithdrawal,
    int UnreadNotifications,
    int NomineeCount,
    decimal TotalReceivedThisYear,
    IReadOnlyList<ChartPoint> Chart);

public record StatementDto(
    DateTime From, DateTime To, decimal OpeningBalance, decimal TotalCredit, decimal TotalDebit,
    decimal ClosingBalance, IReadOnlyList<TransactionDto> Transactions);

public class ComplaintRequest
{
    [Required, MaxLength(50)] public string Category { get; set; } = "General";
    [Required, StringLength(150, MinimumLength = 5)] public string Subject { get; set; } = string.Empty;
    [Required, StringLength(2000, MinimumLength = 10)] public string Message { get; set; } = string.Empty;
}

public record ComplaintDto(
    int Id, string Category, string Subject, string Message, ComplaintStatus Status,
    string? AdminResponse, DateTime CreatedAt, DateTime UpdatedAt, string? PensionerName = null,
    string? PensionId = null);

public record NotificationDto(
    int Id, string Title, string Message, string? TitleBn, string? MessageBn, string Type,
    string? Link, bool IsRead, DateTime CreatedAt);

public class AssistantRequest
{
    [Required, StringLength(500, MinimumLength = 1)] public string Message { get; set; } = string.Empty;
    [RegularExpression("^(en|bn)$")] public string Language { get; set; } = "en";
}

public record AssistantReply(string Reply, string Intent, IReadOnlyList<AssistantAction> Actions, string Engine);
public record AssistantAction(string Label, string Link);
