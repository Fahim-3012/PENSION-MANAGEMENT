using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace SmartPension.Api.Models;

public class ApplicationUser : IdentityUser
{
    [MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [MaxLength(5)] public string PreferredLanguage { get; set; } = "en";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public Pensioner? Pensioner { get; set; }
}

public class Pensioner
{
    public int Id { get; set; }
    [MaxLength(255)] public string UserId { get; set; } = string.Empty;
    public ApplicationUser? User { get; set; }

    /// <summary>Public pension identifier, e.g. SPM-2026-000012. Assigned after first save.</summary>
    [MaxLength(30)] public string? PensionId { get; set; }

    [MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [MaxLength(150)] public string? FullNameBn { get; set; }
    [MaxLength(17)] public string NidNumber { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    [MaxLength(20)] public string Phone { get; set; } = string.Empty;
    [MaxLength(300)] public string Address { get; set; } = string.Empty;

    public PensionType PensionType { get; set; }
    [MaxLength(150)] public string FormerOrganization { get; set; } = string.Empty;
    [MaxLength(100)] public string Designation { get; set; } = string.Empty;
    [MaxLength(50)] public string? EmployeeId { get; set; }
    public DateTime RetirementDate { get; set; }

    [Precision(18, 2)] public decimal LastBasicSalary { get; set; }
    [Precision(18, 2)] public decimal MonthlyPensionAmount { get; set; }
    [Precision(18, 2)] public decimal Balance { get; set; }

    public PensionerStatus Status { get; set; } = PensionerStatus.Pending;
    [MaxLength(500)] public string? StatusReason { get; set; }
    public DateTime? ApprovedAt { get; set; }
    [MaxLength(255)] public string? ApprovedById { get; set; }

    /// <summary>Optimistic concurrency token – regenerated whenever the balance changes.</summary>
    [ConcurrencyCheck] public Guid ConcurrencyStamp { get; set; } = Guid.NewGuid();

    /// <summary>Enrolled face: 128-number face-api.js descriptor (JSON array), used for AI matching.</summary>
    [MaxLength(4000)] public string? FaceDescriptor { get; set; }
    public DateTime? FaceEnrolledAt { get; set; }
    [MaxLength(300)] public string? FacePhotoPath { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<BankAccount> BankAccounts { get; set; } = new List<BankAccount>();
    public ICollection<Nominee> Nominees { get; set; } = new List<Nominee>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<Withdrawal> Withdrawals { get; set; } = new List<Withdrawal>();
    public ICollection<LifeVerification> LifeVerifications { get; set; } = new List<LifeVerification>();
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<Complaint> Complaints { get; set; } = new List<Complaint>();
}

public class BankAccount
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    [MaxLength(120)] public string BankName { get; set; } = string.Empty;
    [MaxLength(120)] public string BranchName { get; set; } = string.Empty;
    [MaxLength(150)] public string AccountHolderName { get; set; } = string.Empty;
    [MaxLength(30)] public string AccountNumber { get; set; } = string.Empty;
    [MaxLength(20)] public string? RoutingNumber { get; set; }
    public bool IsPrimary { get; set; }
    public VerificationStatus Status { get; set; } = VerificationStatus.Pending;
    [MaxLength(500)] public string? RejectionReason { get; set; }
    public DateTime? VerifiedAt { get; set; }
    [MaxLength(255)] public string? VerifiedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Nominee
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    [MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [MaxLength(50)] public string Relationship { get; set; } = string.Empty;
    [MaxLength(17)] public string? NidNumber { get; set; }
    [MaxLength(20)] public string? Phone { get; set; }
    public DateTime? DateOfBirth { get; set; }
    [Precision(5, 2)] public decimal SharePercentage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>A monthly pension disbursement for a given period.</summary>
public class Payment
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    public int Year { get; set; }
    public int Month { get; set; }
    [Precision(18, 2)] public decimal Amount { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    [MaxLength(60)] public string? Reference { get; set; }
    [MaxLength(500)] public string? FailureReason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
    [MaxLength(255)] public string? ProcessedById { get; set; }
}

public class Withdrawal
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    public int BankAccountId { get; set; }
    public BankAccount? BankAccount { get; set; }
    [Precision(18, 2)] public decimal Amount { get; set; }
    public WithdrawalStatus Status { get; set; } = WithdrawalStatus.Pending;
    [MaxLength(300)] public string? Note { get; set; }
    [MaxLength(500)] public string? RejectionReason { get; set; }
    [MaxLength(60)] public string? Reference { get; set; }
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewStartedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    [MaxLength(255)] public string? ReviewedById { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}

/// <summary>Ledger entry for the pensioner's pension account.</summary>
public class Transaction
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    public TransactionType Type { get; set; }
    [Precision(18, 2)] public decimal Amount { get; set; }
    [Precision(18, 2)] public decimal BalanceAfter { get; set; }
    [MaxLength(200)] public string Description { get; set; } = string.Empty;
    [MaxLength(60)] public string? Reference { get; set; }
    public int? PaymentId { get; set; }
    public int? WithdrawalId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class LifeVerification
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    [MaxLength(300)] public string PhotoPath { get; set; } = string.Empty;
    [MaxLength(50)] public string PhotoContentType { get; set; } = "image/jpeg";
    public LifeVerificationStatus Status { get; set; } = LifeVerificationStatus.Pending;
    [MaxLength(500)] public string? RejectionReason { get; set; }
    /// <summary>Manual (photo reviewed by an admin), AI-Enrollment, AI (face match passed) or AI-Failed.</summary>
    [MaxLength(30)] public string Method { get; set; } = "Manual";
    /// <summary>Euclidean distance between the live face and the enrolled face (lower = more similar).</summary>
    public double? MatchDistance { get; set; }
    public bool? LivenessPassed { get; set; }
    [MaxLength(100)] public string? LivenessChallenge { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAt { get; set; }
    [MaxLength(255)] public string? ReviewedById { get; set; }
    public DateTime? ValidUntil { get; set; }
}

public class Notification
{
    public int Id { get; set; }
    [MaxLength(255)] public string UserId { get; set; } = string.Empty;
    [MaxLength(150)] public string Title { get; set; } = string.Empty;
    [MaxLength(500)] public string Message { get; set; } = string.Empty;
    [MaxLength(150)] public string? TitleBn { get; set; }
    [MaxLength(500)] public string? MessageBn { get; set; }
    [MaxLength(30)] public string Type { get; set; } = "info";
    [MaxLength(200)] public string? Link { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public long Id { get; set; }
    [MaxLength(255)] public string? UserId { get; set; }
    [MaxLength(256)] public string? UserEmail { get; set; }
    [MaxLength(100)] public string Action { get; set; } = string.Empty;
    [MaxLength(60)] public string EntityType { get; set; } = string.Empty;
    [MaxLength(60)] public string? EntityId { get; set; }
    [MaxLength(1000)] public string? Details { get; set; }
    [MaxLength(64)] public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Complaint
{
    public int Id { get; set; }
    public int PensionerId { get; set; }
    public Pensioner? Pensioner { get; set; }
    [MaxLength(50)] public string Category { get; set; } = "General";
    [MaxLength(150)] public string Subject { get; set; } = string.Empty;
    [MaxLength(2000)] public string Message { get; set; } = string.Empty;
    public ComplaintStatus Status { get; set; } = ComplaintStatus.Open;
    [MaxLength(2000)] public string? AdminResponse { get; set; }
    [MaxLength(255)] public string? RespondedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class SystemSetting
{
    [Key, MaxLength(80)] public string Key { get; set; } = string.Empty;
    [MaxLength(500)] public string Value { get; set; } = string.Empty;
    [MaxLength(200)] public string? Description { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Master pensioner list imported by the office (CSV). A person can register only when their
/// Pension ID, NID and date of birth match an active, unclaimed record. No admin approval step.
/// </summary>
public class PensionRecord
{
    public int Id { get; set; }
    [MaxLength(30)] public string PensionId { get; set; } = string.Empty;
    [MaxLength(150)] public string FullName { get; set; } = string.Empty;
    [MaxLength(150)] public string? FullNameBn { get; set; }
    [MaxLength(17)] public string NidNumber { get; set; } = string.Empty;
    public DateTime DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public PensionType PensionType { get; set; }
    [MaxLength(150)] public string FormerOrganization { get; set; } = string.Empty;
    [MaxLength(100)] public string Designation { get; set; } = string.Empty;
    [MaxLength(50)] public string? EmployeeId { get; set; }
    public DateTime RetirementDate { get; set; }
    [Precision(18, 2)] public decimal LastBasicSalary { get; set; }
    [Precision(18, 2)] public decimal MonthlyPensionAmount { get; set; }
    [MaxLength(20)] public string? Phone { get; set; }
    public bool IsActive { get; set; } = true;
    public int? ClaimedByPensionerId { get; set; }
    public DateTime? ClaimedAt { get; set; }
    [MaxLength(60)] public string? ImportBatch { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
