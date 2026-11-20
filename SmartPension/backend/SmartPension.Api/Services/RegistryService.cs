using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;

namespace SmartPension.Api.Services;

/// <summary>
/// Master pensioner list: matching at sign-up and CSV import/validation.
/// Replaces the admin approval step — a person whose details match an active record is activated at once.
/// </summary>
public class RegistryService(AppDbContext db, AuditService audit, NotificationService notify)
{
    public const int MaxRows = 20000;
    public static readonly string[] RequiredColumns =
        { "PensionId", "FullName", "NidNumber", "DateOfBirth", "Gender", "PensionType", "FormerOrganization", "Designation", "RetirementDate", "MonthlyPensionAmount" };
    public static readonly string[] OptionalColumns = { "FullNameBn", "EmployeeId", "LastBasicSalary", "Phone" };

    private static readonly Regex PensionIdRx = new(@"^[A-Z0-9-]{4,30}$", RegexOptions.Compiled);
    private static readonly Regex NidRx = new(@"^(\d{10}|\d{13}|\d{17})$", RegexOptions.Compiled);
    private static readonly Regex PhoneRx = new(@"^(\+?880)?01[3-9]\d{8}$", RegexOptions.Compiled);
    private static readonly string[] DateFormats = { "yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "yyyy/MM/dd", "M/d/yyyy" };

    public static string NormalizeId(string? id) => (id ?? string.Empty).Trim().ToUpperInvariant();

    /// <summary>Finds the active record matching all three details. Same message for every mismatch, so nothing leaks.</summary>
    public async Task<PensionRecord> MatchAsync(string pensionId, string nid, DateTime dob)
    {
        var id = NormalizeId(pensionId);
        var record = await db.PensionRecords.FirstOrDefaultAsync(r => r.PensionId == id);
        if (record == null || !record.IsActive || record.NidNumber != nid.Trim() || record.DateOfBirth.Date != dob.Date)
            throw new AppException("We could not find a pension record with these details. Check your Pension ID, NID and date of birth, or contact the pension office.");
        if (record.ClaimedByPensionerId != null)
            throw new AppException("An account already exists for this pension record. Please sign in, or contact the pension office if this was not you.", StatusCodes.Status409Conflict);
        return record;
    }

    public static RecordPreview Preview(PensionRecord r) => new(
        r.PensionId, r.FullName, r.FullNameBn, r.Gender, r.PensionType, r.FormerOrganization, r.Designation,
        r.RetirementDate, r.MonthlyPensionAmount, string.IsNullOrEmpty(r.Phone) ? null : Mask.Tail(r.Phone, 3));

    // ---------------- Validation shared by import and single add/edit ----------------

    /// <summary>Validates raw values and fills `target`. Returns the first error or null.</summary>
    public static string? Apply(IReadOnlyDictionary<string, string> v, PensionRecord target)
    {
        string Get(string k) => v.TryGetValue(k, out var x) ? x.Trim() : string.Empty;

        var id = NormalizeId(Get("PensionId"));
        if (!PensionIdRx.IsMatch(id)) return "PensionId must be 4–30 letters, digits or hyphens.";
        var name = Get("FullName");
        if (name.Length is < 3 or > 150) return "FullName must be 3–150 characters.";
        var nid = Get("NidNumber");
        if (!NidRx.IsMatch(nid)) return "NidNumber must be 10, 13 or 17 digits.";
        if (!TryDate(Get("DateOfBirth"), out var dob)) return "DateOfBirth is not a valid date (use YYYY-MM-DD).";
        if (!TryDate(Get("RetirementDate"), out var ret)) return "RetirementDate is not a valid date (use YYYY-MM-DD).";
        var today = DateTime.UtcNow.Date;
        if (dob > today.AddYears(-18)) return "DateOfBirth is not valid for a pensioner.";
        if (ret > today.AddYears(1)) return "RetirementDate is too far in the future.";
        if (ret < dob.AddYears(18)) return "RetirementDate must be at least 18 years after DateOfBirth.";
        if (nid.Length == 17 && nid[..4] != dob.Year.ToString(CultureInfo.InvariantCulture))
            return "A 17-digit NID must start with the birth year.";
        if (!TryGender(Get("Gender"), out var gender)) return "Gender must be Male, Female or Other.";
        if (!Enum.TryParse<PensionType>(Get("PensionType").Replace(" ", ""), true, out var type) || !Enum.IsDefined(type))
            return "PensionType must be one of: " + string.Join(", ", Enum.GetNames<PensionType>()) + ".";
        var org = Get("FormerOrganization");
        if (org.Length is < 2 or > 150) return "FormerOrganization is required.";
        var des = Get("Designation");
        if (des.Length is < 2 or > 100) return "Designation is required.";
        if (!TryMoney(Get("MonthlyPensionAmount"), out var monthly) || monthly <= 0 || monthly > 10_000_000)
            return "MonthlyPensionAmount must be a number greater than 0.";
        decimal basic = 0;
        var basicRaw = Get("LastBasicSalary");
        if (basicRaw.Length > 0 && (!TryMoney(basicRaw, out basic) || basic < 0)) return "LastBasicSalary must be a number.";
        var phone = Get("Phone");
        if (phone.Length > 0 && !PhoneRx.IsMatch(phone)) return "Phone must be a Bangladeshi mobile number.";
        var bn = Get("FullNameBn");
        var emp = Get("EmployeeId");

        target.PensionId = id;
        target.FullName = name;
        target.FullNameBn = bn.Length == 0 ? null : bn[..Math.Min(bn.Length, 150)];
        target.NidNumber = nid;
        target.DateOfBirth = dob;
        target.Gender = gender;
        target.PensionType = type;
        target.FormerOrganization = org;
        target.Designation = des;
        target.EmployeeId = emp.Length == 0 ? null : emp[..Math.Min(emp.Length, 50)];
        target.RetirementDate = ret;
        target.MonthlyPensionAmount = Math.Round(monthly, 2);
        target.LastBasicSalary = Math.Round(basic, 2);
        target.Phone = phone.Length == 0 ? null : phone;
        target.UpdatedAt = DateTime.UtcNow;
        return null;
    }

    private static bool TryDate(string s, out DateTime d) =>
        DateTime.TryParseExact(s, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out d);

    private static bool TryMoney(string s, out decimal m) =>
        decimal.TryParse(s.Replace(",", "").Replace("৳", "").Replace("BDT", "").Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out m);

    private static bool TryGender(string s, out Gender g)
    {
        switch (s.Trim().ToLowerInvariant())
        {
            case "m": case "male": case "পুরুষ": g = Gender.Male; return true;
            case "f": case "female": case "নারী": case "মহিলা": g = Gender.Female; return true;
            case "o": case "other": case "অন্যান্য": g = Gender.Other; return true;
            default: g = Gender.Other; return false;
        }
    }

    // ---------------- CSV import ----------------

    public async Task<ImportResult> ImportAsync(Stream csv, bool dryRun, string fileName)
    {
        var rows = ParseCsv(csv);
        if (rows.Count == 0) throw new AppException("The file is empty.");
        var header = rows[0].Select(h => h.Trim().TrimStart('﻿')).ToList();
        var index = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < header.Count; i++) if (header[i].Length > 0) index.TryAdd(header[i], i);
        var missing = RequiredColumns.Where(c => !index.ContainsKey(c)).ToList();
        if (missing.Count > 0) throw new AppException("Missing column(s): " + string.Join(", ", missing) + ". Download the template to see the expected header.");
        if (rows.Count - 1 > MaxRows) throw new AppException($"A file can contain at most {MaxRows:N0} records.");

        var existing = await db.PensionRecords.ToListAsync();
        var byId = existing.ToDictionary(r => r.PensionId);
        var nidOwner = existing.ToDictionary(r => r.NidNumber, r => r.PensionId);
        var seenIds = new HashSet<string>();
        var seenNids = new HashSet<string>();
        var errors = new List<ImportError>();
        int created = 0, updated = 0, unchanged = 0;
        var batch = $"{DateTime.UtcNow:yyyyMMddHHmmss}";
        var amountChanges = new List<(int PensionerId, decimal Old, decimal New)>();

        for (var line = 1; line < rows.Count; line++)
        {
            var cells = rows[line];
            if (cells.All(string.IsNullOrWhiteSpace)) continue;
            var values = index.ToDictionary(kv => kv.Key, kv => kv.Value < cells.Count ? cells[kv.Value] : string.Empty, StringComparer.OrdinalIgnoreCase);
            var rawId = NormalizeId(values.GetValueOrDefault("PensionId"));
            void Fail(string m) { if (errors.Count < 500) errors.Add(new ImportError(line + 1, rawId, m)); }

            var candidate = new PensionRecord();
            var err = Apply(values, candidate);
            if (err != null) { Fail(err); continue; }
            if (!seenIds.Add(candidate.PensionId)) { Fail("PensionId appears more than once in this file."); continue; }
            if (!seenNids.Add(candidate.NidNumber)) { Fail("NidNumber appears more than once in this file."); continue; }
            if (nidOwner.TryGetValue(candidate.NidNumber, out var owner) && owner != candidate.PensionId)
            { Fail($"NidNumber already belongs to record {owner}."); continue; }

            if (byId.TryGetValue(candidate.PensionId, out var current))
            {
                if (current.ClaimedByPensionerId != null &&
                    (current.NidNumber != candidate.NidNumber || current.DateOfBirth != candidate.DateOfBirth || current.FullName != candidate.FullName))
                { Fail("This record already has an account; name, NID and date of birth cannot be changed by import."); continue; }

                if (SameData(current, candidate)) { unchanged++; continue; }
                if (current.ClaimedByPensionerId is int pid && current.MonthlyPensionAmount != candidate.MonthlyPensionAmount)
                    amountChanges.Add((pid, current.MonthlyPensionAmount, candidate.MonthlyPensionAmount));
                if (!dryRun) CopyEditable(candidate, current, current.ClaimedByPensionerId != null);
                updated++;
            }
            else
            {
                candidate.ImportBatch = batch;
                if (!dryRun) db.PensionRecords.Add(candidate);
                nidOwner[candidate.NidNumber] = candidate.PensionId;
                created++;
            }
        }

        var skipped = errors.Count;
        if (!dryRun && (created + updated) > 0)
        {
            await using var tx = await db.Database.BeginTransactionAsync();
            foreach (var (pid, oldAmount, newAmount) in amountChanges)
            {
                var p = await db.Pensioners.FirstAsync(x => x.Id == pid);
                p.MonthlyPensionAmount = newAmount;
                p.UpdatedAt = DateTime.UtcNow;
                notify.Notify(p.UserId, "Monthly pension updated", $"Your monthly pension is now BDT {newAmount:N2}.",
                    "মাসিক পেনশন হালনাগাদ", $"আপনার মাসিক পেনশন এখন BDT {newAmount:N2}।", "info", "/app/dashboard");
                audit.Log("Pensioner.PensionAmountChanged", nameof(Pensioner), pid.ToString(), $"BDT {oldAmount:N2} -> BDT {newAmount:N2} (registry import)");
            }
            audit.Log("Registry.Imported", nameof(PensionRecord), batch, $"{fileName}: {created} created, {updated} updated, {unchanged} unchanged, {skipped} with errors");
            await db.SaveChangesAsync();
            await tx.CommitAsync();
        }

        return new ImportResult(dryRun, rows.Count - 1, created, updated, unchanged, skipped, errors);
    }

    private static bool SameData(PensionRecord a, PensionRecord b) =>
        a.FullName == b.FullName && a.FullNameBn == b.FullNameBn && a.NidNumber == b.NidNumber && a.DateOfBirth == b.DateOfBirth
        && a.Gender == b.Gender && a.PensionType == b.PensionType && a.FormerOrganization == b.FormerOrganization
        && a.Designation == b.Designation && a.EmployeeId == b.EmployeeId && a.RetirementDate == b.RetirementDate
        && a.MonthlyPensionAmount == b.MonthlyPensionAmount && a.LastBasicSalary == b.LastBasicSalary && a.Phone == b.Phone;

    /// <summary>Copies fields; for a claimed record the identity fields are kept.</summary>
    public static void CopyEditable(PensionRecord from, PensionRecord to, bool claimed)
    {
        if (!claimed)
        {
            to.FullName = from.FullName;
            to.NidNumber = from.NidNumber;
            to.DateOfBirth = from.DateOfBirth;
        }
        to.FullNameBn = from.FullNameBn;
        to.Gender = from.Gender;
        to.PensionType = from.PensionType;
        to.FormerOrganization = from.FormerOrganization;
        to.Designation = from.Designation;
        to.EmployeeId = from.EmployeeId;
        to.RetirementDate = from.RetirementDate;
        to.MonthlyPensionAmount = from.MonthlyPensionAmount;
        to.LastBasicSalary = from.LastBasicSalary;
        to.Phone = from.Phone;
        to.UpdatedAt = DateTime.UtcNow;
    }

    public static string TemplateCsv()
    {
        var sb = new StringBuilder();
        sb.AppendLine(string.Join(",", RequiredColumns.Concat(OptionalColumns)));
        return sb.ToString();
    }

    /// <summary>RFC 4180-style parser: quoted fields, escaped quotes, commas and line breaks inside quotes.</summary>
    public static List<List<string>> ParseCsv(Stream stream)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var text = reader.ReadToEnd();
        var rows = new List<List<string>>();
        var row = new List<string>();
        var field = new StringBuilder();
        var inQuotes = false;
        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"') { field.Append('"'); i++; }
                    else inQuotes = false;
                }
                else field.Append(c);
                continue;
            }
            switch (c)
            {
                case '"': inQuotes = true; break;
                case ',': row.Add(field.ToString()); field.Clear(); break;
                case '\r': break;
                case '\n': row.Add(field.ToString()); field.Clear(); rows.Add(row); row = new List<string>(); break;
                default: field.Append(c); break;
            }
        }
        if (field.Length > 0 || row.Count > 0) { row.Add(field.ToString()); rows.Add(row); }
        return rows;
    }
}
