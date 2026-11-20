namespace SmartPension.Api.Models;

public enum PensionerStatus { Pending, Active, Rejected, Suspended }

public enum VerificationStatus { Pending, Verified, Rejected }

public enum LifeVerificationStatus { Pending, Approved, Rejected }

public enum PaymentStatus { Pending, Success, Failed }

public enum WithdrawalStatus { Pending, UnderReview, Approved, Paid, Rejected, Cancelled }

public enum TransactionType { Credit, Debit }

public enum ComplaintStatus { Open, InProgress, Resolved, Closed }

public enum PensionType { Government, Autonomous, Private, Military, OldAge }

public enum Gender { Male, Female, Other }

public static class Roles
{
    public const string Pensioner = "Pensioner";
    public const string Admin = "Admin";
    public const string SuperAdmin = "SuperAdmin";
    public static readonly string[] All = { Pensioner, Admin, SuperAdmin };
}

public static class Policies
{
    public const string AdminOnly = "AdminOnly";
    public const string SuperAdminOnly = "SuperAdminOnly";
    public const string PensionerOnly = "PensionerOnly";
}

public static class SettingKeys
{
    public const string MinWithdrawalAmount = "MinWithdrawalAmount";
    public const string MaxWithdrawalsPerMonth = "MaxWithdrawalsPerMonth";
    public const string LifeVerificationValidityMonths = "LifeVerificationValidityMonths";
    public const string SuggestedPensionRatePercent = "SuggestedPensionRatePercent";
    public const string SupportPhone = "SupportPhone";
    public const string SupportEmail = "SupportEmail";
    public const string FaceMatchThreshold = "FaceMatchThreshold";
}
