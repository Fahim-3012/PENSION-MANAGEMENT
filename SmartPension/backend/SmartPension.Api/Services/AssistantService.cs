using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;

namespace SmartPension.Api.Services;

/// <summary>
/// Rule-based pension assistant (Bangla + English). It answers from the pensioner's REAL account data
/// using keyword intent matching. No external AI/LLM provider is configured in this project.
/// </summary>
public class AssistantService(AppDbContext db, PensionService pension, SettingsService settings)
{
    public const string Engine = "rule-based";

    private static readonly Dictionary<string, string[]> Intents = new()
    {
        ["greeting"] = new[] { "hello", "hi", "hey", "assalam", "salam", "হ্যালো", "আসসালামু", "সালাম", "নমস্কার" },
        ["balance"] = new[] { "balance", "how much", "amount", "pension amount", "monthly", "ব্যালেন্স", "কত টাকা", "পেনশনের পরিমাণ", "মাসিক", "টাকা কত" },
        ["withdraw"] = new[] { "withdraw", "withdrawal", "cash out", "উত্তোলন", "তুলতে", "টাকা তোলা", "উঠাতে", "তুলব" },
        ["next"] = new[] { "next", "when", "date", "পরবর্তী", "কবে", "তারিখ" },
        ["bank"] = new[] { "bank", "account number", "ব্যাংক", "অ্যাকাউন্ট", "একাউন্ট" },
        ["life"] = new[] { "life", "face", "alive", "verification", "verify", "selfie", "জীবিত", "যাচাই", "ভেরিফিকেশন", "মুখ", "ছবি" },
        ["payment"] = new[] { "payment", "paid", "credited", "history", "received", "পেমেন্ট", "জমা", "পেয়েছি", "ইতিহাস" },
        ["nominee"] = new[] { "nominee", "heir", "নমিনি", "উত্তরাধিকারী", "মনোনীত" },
        ["statement"] = new[] { "statement", "pdf", "report", "স্টেটমেন্ট", "বিবরণী", "রিপোর্ট" },
        ["support"] = new[] { "complain", "complaint", "help", "support", "problem", "অভিযোগ", "সাহায্য", "সমস্যা", "সহায়তা" },
        ["password"] = new[] { "password", "security", "পাসওয়ার্ড", "নিরাপত্তা" },
    };

    public async Task<AssistantReply> ReplyAsync(string userId, string message, string lang)
    {
        var bn = lang == "bn";
        var p = await db.Pensioners.Include(x => x.BankAccounts).FirstOrDefaultAsync(x => x.UserId == userId)
            ?? throw new AppException("Pensioner profile not found.", 404);
        var text = message.Trim().ToLowerInvariant();
        var intent = Detect(text);
        var bnCulture = new CultureInfo("bn-BD");
        string Money(decimal v) => bn ? "৳" + v.ToString("N2", bnCulture) : "BDT " + v.ToString("N2", CultureInfo.InvariantCulture);
        string Date(DateTime d) => bn ? d.ToString("d MMMM yyyy", bnCulture) : d.ToString("d MMMM yyyy", CultureInfo.InvariantCulture);
        var actions = new List<AssistantAction>();

        string reply;
        switch (intent)
        {
            case "greeting":
                reply = bn
                    ? $"আসসালামু আলাইকুম, {p.FullNameBn ?? p.FullName}! আমি আপনার পেনশন সহকারী। আপনি ব্যালেন্স, উত্তোলন, ব্যাংক, জীবিত যাচাই বা পেমেন্ট সম্পর্কে জিজ্ঞাসা করতে পারেন।"
                    : $"Hello, {p.FullName}! I'm your pension assistant. Ask me about your balance, withdrawals, bank account, life verification or payments.";
                break;

            case "balance":
                reply = p.Status != PensionerStatus.Active
                    ? (bn ? $"আপনার অ্যাকাউন্টের অবস্থা: {StatusBn(p.Status)}। অনুমোদনের পর মাসিক পেনশনের পরিমাণ নির্ধারণ করা হবে।"
                          : $"Your account status is {p.Status}. Your monthly pension amount is set once your registration is approved.")
                    : (bn ? $"আপনার মাসিক পেনশন {Money(p.MonthlyPensionAmount)}। বর্তমান পেনশন অ্যাকাউন্ট ব্যালেন্স {Money(p.Balance)}।"
                          : $"Your monthly pension is {Money(p.MonthlyPensionAmount)}. Your current pension account balance is {Money(p.Balance)}.");
                actions.Add(new(bn ? "ড্যাশবোর্ড দেখুন" : "Open dashboard", "/app/dashboard"));
                break;

            case "withdraw":
            case "next":
            {
                var e = await pension.CheckEligibilityAsync(p);
                if (e.Eligible)
                    reply = bn
                        ? $"আপনি এখন উত্তোলনের যোগ্য। সর্বোচ্চ {Money(e.AvailableBalance)} পর্যন্ত (ন্যূনতম {Money(e.MinAmount)}) উত্তোলন করতে পারবেন।"
                        : $"You are eligible to withdraw now — up to {Money(e.AvailableBalance)} (minimum {Money(e.MinAmount)}).";
                else
                {
                    var reasons = string.Join(bn ? "; " : "; ", e.Reasons.Select(r => ReasonText(r, bn)));
                    reply = bn ? $"এই মুহূর্তে উত্তোলন সম্ভব নয়: {reasons}।" : $"You can't withdraw right now: {reasons}.";
                    if (e.NextEligibleDate is { } d)
                        reply += bn ? $" পরবর্তী সম্ভাব্য তারিখ: {Date(d)}।" : $" Next eligible date: {Date(d)}.";
                }
                actions.Add(new(bn ? "উত্তোলন পাতা" : "Go to withdrawals", "/app/withdrawals"));
                break;
            }

            case "bank":
            {
                var state = PensionService.GetBankState(p.BankAccounts);
                reply = state switch
                {
                    "Verified" => bn ? "আপনার ব্যাংক অ্যাকাউন্ট যাচাই করা হয়েছে।" : "Your bank account is verified.",
                    "Pending" => bn ? "আপনার ব্যাংক অ্যাকাউন্ট যাচাইয়ের অপেক্ষায় আছে। প্রশাসক শীঘ্রই পর্যালোচনা করবেন।" : "Your bank account is waiting for verification by an administrator.",
                    "Rejected" => bn ? "আপনার ব্যাংক অ্যাকাউন্ট প্রত্যাখ্যাত হয়েছে। সঠিক তথ্য দিয়ে নতুন অ্যাকাউন্ট যোগ করুন।" : "Your bank account was rejected. Please add an account with correct details.",
                    _ => bn ? "আপনি এখনও কোনো ব্যাংক অ্যাকাউন্ট যোগ করেননি।" : "You haven't added a bank account yet."
                };
                actions.Add(new(bn ? "ব্যাংক অ্যাকাউন্ট" : "Bank accounts", "/app/bank-accounts"));
                break;
            }

            case "life":
            {
                var (state, until) = await pension.GetLifeStateAsync(p.Id);
                reply = state switch
                {
                    "Verified" => bn ? $"আপনার জীবিত যাচাই বৈধ আছে {Date(until!.Value)} পর্যন্ত।" : $"Your life verification is valid until {Date(until!.Value)}.",
                    "Pending" => bn ? "আপনার জীবিত যাচাই পর্যালোচনার অপেক্ষায় আছে।" : "Your life verification is waiting for review.",
                    "Rejected" => bn ? "আপনার সর্বশেষ জীবিত যাচাই প্রত্যাখ্যাত হয়েছে। অনুগ্রহ করে আবার ছবি জমা দিন।" : "Your last life verification was rejected. Please submit a new photo.",
                    "Expired" => bn ? "আপনার জীবিত যাচাইয়ের মেয়াদ শেষ। পেনশন পেতে আবার যাচাই করুন।" : "Your life verification has expired. Please verify again to keep receiving pension.",
                    _ => bn ? "আপনি এখনও জীবিত যাচাই করেননি। ক্যামেরা দিয়ে একটি ছবি জমা দিন।" : "You haven't completed life verification yet. Submit a camera photo to start."
                };
                actions.Add(new(bn ? "জীবিত যাচাই" : "Life verification", "/app/life-verification"));
                break;
            }

            case "payment":
            {
                var last = await db.Payments.Where(x => x.PensionerId == p.Id)
                    .OrderByDescending(x => x.Year).ThenByDescending(x => x.Month).FirstOrDefaultAsync();
                if (last == null)
                    reply = bn ? "এখনও কোনো পেনশন পেমেন্ট রেকর্ড নেই।" : "There are no pension payment records yet.";
                else
                {
                    var period = new DateTime(last.Year, last.Month, 1);
                    var periodText = bn ? period.ToString("MMMM yyyy", bnCulture) : period.ToString("MMMM yyyy", CultureInfo.InvariantCulture);
                    reply = bn
                        ? $"সর্বশেষ পেমেন্ট: {periodText}, পরিমাণ {Money(last.Amount)}, অবস্থা: {PaymentBn(last.Status)}।"
                        : $"Latest payment: {periodText}, amount {Money(last.Amount)}, status: {last.Status}.";
                    if (last.Status == PaymentStatus.Failed && last.FailureReason != null)
                        reply += bn ? $" কারণ: {last.FailureReason}" : $" Reason: {last.FailureReason}";
                }
                actions.Add(new(bn ? "পেমেন্ট ইতিহাস" : "Payment history", "/app/payments"));
                break;
            }

            case "nominee":
            {
                var count = await db.Nominees.CountAsync(n => n.PensionerId == p.Id);
                var total = await db.Nominees.Where(n => n.PensionerId == p.Id).SumAsync(n => (decimal?)n.SharePercentage) ?? 0;
                reply = bn
                    ? $"আপনার {count} জন নমিনি আছে, মোট অংশ {total:0.##}%।" + (total < 100 ? " মোট অংশ ১০০% করতে নমিনি হালনাগাদ করুন।" : "")
                    : $"You have {count} nominee(s) with a total share of {total:0.##}%." + (total < 100 ? " Update nominees so the total reaches 100%." : "");
                actions.Add(new(bn ? "নমিনি ব্যবস্থাপনা" : "Manage nominees", "/app/nominees"));
                break;
            }

            case "statement":
                reply = bn ? "স্টেটমেন্ট পাতায় তারিখ বেছে নিয়ে PDF ডাউনলোড করতে পারবেন।" : "Open the Statements page, choose a date range and download the PDF.";
                actions.Add(new(bn ? "স্টেটমেন্ট" : "Statements", "/app/statements"));
                break;

            case "support":
            {
                var phone = await settings.GetAsync(SettingKeys.SupportPhone);
                reply = bn ? "সহায়তা পাতায় অভিযোগ জমা দিতে পারেন; প্রশাসক উত্তর দেবেন।" : "You can submit a complaint on the Support page and an administrator will respond.";
                if (!string.IsNullOrWhiteSpace(phone)) reply += bn ? $" ফোন: {phone}" : $" Phone: {phone}";
                actions.Add(new(bn ? "সহায়তা" : "Support", "/app/support"));
                break;
            }

            case "password":
                reply = bn ? "প্রোফাইল ও নিরাপত্তা পাতায় গিয়ে পাসওয়ার্ড পরিবর্তন করতে পারবেন। কাউকে পাসওয়ার্ড বা OTP জানাবেন না।" : "You can change your password from Profile & Security. Never share your password or OTP with anyone.";
                actions.Add(new(bn ? "প্রোফাইল" : "Profile", "/app/profile"));
                break;

            default:
                reply = bn
                    ? "দুঃখিত, আমি প্রশ্নটি বুঝতে পারিনি। আপনি জিজ্ঞাসা করতে পারেন: \"আমার ব্যালেন্স কত?\", \"কবে টাকা তুলতে পারব?\", \"ব্যাংক যাচাই হয়েছে?\""
                    : "Sorry, I didn't understand. Try asking: \"What is my balance?\", \"When can I withdraw?\", \"Is my bank verified?\"";
                intent = "unknown";
                break;
        }

        return new AssistantReply(reply, intent, actions, Engine);
    }

    private static string Detect(string text)
    {
        // Prefer more specific intents first.
        string[] order = { "withdraw", "life", "bank", "nominee", "statement", "payment", "password", "support", "balance", "next", "greeting" };
        foreach (var key in order)
            if (Intents[key].Any(k => text.Contains(k))) return key;
        return "unknown";
    }

    private static string ReasonText(string code, bool bn) => code switch
    {
        "ACCOUNT_NOT_ACTIVE" => bn ? "অ্যাকাউন্ট সক্রিয় নয়" : "your account is not active",
        "NO_VERIFIED_BANK" => bn ? "যাচাইকৃত ব্যাংক অ্যাকাউন্ট নেই" : "no verified bank account",
        "LIFE_VERIFICATION_REQUIRED" => bn ? "বৈধ জীবিত যাচাই নেই" : "life verification is missing or expired",
        "OPEN_REQUEST_EXISTS" => bn ? "একটি অনুরোধ ইতিমধ্যে প্রক্রিয়াধীন" : "another request is already in progress",
        "MONTHLY_LIMIT_REACHED" => bn ? "এই মাসের উত্তোলন সীমা শেষ" : "this month's withdrawal limit is reached",
        "INSUFFICIENT_BALANCE" => bn ? "পর্যাপ্ত ব্যালেন্স নেই" : "balance is below the minimum amount",
        _ => code
    };

    private static string StatusBn(PensionerStatus s) => s switch
    {
        PensionerStatus.Pending => "অনুমোদনের অপেক্ষায়",
        PensionerStatus.Active => "সক্রিয়",
        PensionerStatus.Rejected => "প্রত্যাখ্যাত",
        _ => "স্থগিত"
    };

    private static string PaymentBn(PaymentStatus s) => s switch
    {
        PaymentStatus.Success => "সফল",
        PaymentStatus.Failed => "ব্যর্থ",
        _ => "প্রক্রিয়াধীন"
    };
}
