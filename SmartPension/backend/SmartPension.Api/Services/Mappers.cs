using SmartPension.Api.DTOs;
using SmartPension.Api.Models;

namespace SmartPension.Api.Services;

public static class Mappers
{
    public static PensionerProfileDto ToProfileDto(this Pensioner p, string email) => new(
        p.Id, p.PensionId, p.FullName, p.FullNameBn, email, Mask.Tail(p.NidNumber, 3), p.DateOfBirth, p.Gender,
        p.Phone, p.Address, p.PensionType, p.FormerOrganization, p.Designation, p.EmployeeId, p.RetirementDate,
        p.LastBasicSalary, p.MonthlyPensionAmount, p.Balance, p.Status, p.StatusReason, p.ApprovedAt, p.CreatedAt);

    public static BankAccountDto ToDto(this BankAccount b) => new(
        b.Id, b.BankName, b.BranchName, b.AccountHolderName, Mask.Tail(b.AccountNumber), b.RoutingNumber,
        b.IsPrimary, b.Status, b.RejectionReason, b.VerifiedAt, b.CreatedAt);

    public static NomineeDto ToDto(this Nominee n) => new(
        n.Id, n.FullName, n.Relationship, string.IsNullOrEmpty(n.NidNumber) ? null : Mask.Tail(n.NidNumber, 3),
        n.Phone, n.DateOfBirth, n.SharePercentage, n.CreatedAt);

    public static PaymentDto ToDto(this Payment p) => new(
        p.Id, p.Year, p.Month, p.Amount, p.Status, p.Reference, p.FailureReason, p.CreatedAt, p.ProcessedAt);

    public static TransactionDto ToDto(this Transaction t) => new(
        t.Id, t.Type, t.Amount, t.BalanceAfter, t.Description, t.Reference, t.CreatedAt);

    public static WithdrawalDto ToDto(this Withdrawal w) => new(
        w.Id, w.Amount, w.Status, w.Note, w.RejectionReason, w.Reference,
        w.BankAccount?.BankName ?? string.Empty, Mask.Tail(w.BankAccount?.AccountNumber),
        w.RequestedAt, w.ReviewStartedAt, w.ReviewedAt, w.PaidAt, w.CancelledAt);

    public static LifeVerificationDto ToDto(this LifeVerification l) => new(
        l.Id, l.Status, l.RejectionReason, l.SubmittedAt, l.ReviewedAt, l.ValidUntil, l.Method, l.MatchDistance, l.LivenessPassed);

    public static NotificationDto ToDto(this Notification n) => new(
        n.Id, n.Title, n.Message, n.TitleBn, n.MessageBn, n.Type, n.Link, n.IsRead, n.CreatedAt);

    public static ComplaintDto ToDto(this Complaint c) => new(
        c.Id, c.Category, c.Subject, c.Message, c.Status, c.AdminResponse, c.CreatedAt, c.UpdatedAt,
        c.Pensioner?.FullName, c.Pensioner?.PensionId);
}
