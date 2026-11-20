using System.Globalization;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.Models;
using System.Security.Claims;

namespace SmartPension.Api.Services;

/// <summary>Business-rule violation that should be reported to the client.</summary>
public class AppException : Exception
{
    public int StatusCode { get; }
    public AppException(string message, int statusCode = 400) : base(message) => StatusCode = statusCode;
}

/// <summary>Adds audit entries to the current DbContext. Callers persist with SaveChangesAsync.</summary>
public class AuditService(AppDbContext db, IHttpContextAccessor http)
{
    public void Log(string action, string entityType, string? entityId = null, string? details = null,
        string? userId = null, string? userEmail = null)
    {
        var ctx = http.HttpContext;
        db.AuditLogs.Add(new AuditLog
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Details = details is { Length: > 1000 } ? details[..1000] : details,
            UserId = userId ?? ctx?.User.FindFirstValue(ClaimTypes.NameIdentifier),
            UserEmail = userEmail ?? ctx?.User.FindFirstValue(ClaimTypes.Email) ?? ctx?.User.FindFirstValue("email"),
            IpAddress = ctx?.Connection.RemoteIpAddress?.ToString(),
            CreatedAt = DateTime.UtcNow
        });
    }
}

/// <summary>Adds in-app notifications to the current DbContext (bilingual).</summary>
public class NotificationService(AppDbContext db)
{
    public void Notify(string userId, string title, string message, string? titleBn = null, string? messageBn = null,
        string type = "info", string? link = null)
    {
        db.Notifications.Add(new Notification
        {
            UserId = userId, Title = title, Message = message, TitleBn = titleBn, MessageBn = messageBn,
            Type = type, Link = link, CreatedAt = DateTime.UtcNow
        });
    }

    public async Task NotifyAdminsAsync(string title, string message, string? link = null)
    {
        var adminRoleIds = await db.Roles.Where(r => r.Name == Roles.Admin || r.Name == Roles.SuperAdmin)
            .Select(r => r.Id).ToListAsync();
        var adminIds = await db.UserRoles.Where(ur => adminRoleIds.Contains(ur.RoleId))
            .Select(ur => ur.UserId).Distinct().ToListAsync();
        foreach (var id in adminIds) Notify(id, title, message, null, null, "admin", link);
    }
}

public class SettingsService(AppDbContext db)
{
    public static readonly Dictionary<string, (string Value, string Description)> Defaults = new()
    {
        [SettingKeys.MinWithdrawalAmount] = ("500", "Minimum amount (BDT) per withdrawal request"),
        [SettingKeys.MaxWithdrawalsPerMonth] = ("1", "Maximum withdrawal requests per calendar month"),
        [SettingKeys.LifeVerificationValidityMonths] = ("12", "How many months an approved life verification stays valid"),
        [SettingKeys.SuggestedPensionRatePercent] = ("50", "Suggested monthly pension as % of last basic salary (shown to approvers)"),
        [SettingKeys.SupportPhone] = ("", "Support phone number shown to pensioners (leave empty to hide)"),
        [SettingKeys.SupportEmail] = ("", "Support email shown to pensioners (leave empty to hide)"),
        [SettingKeys.FaceMatchThreshold] = ("0.5", "AI face match: maximum face distance accepted (0.3 strict – 0.7 loose; face-api.js default 0.6)"),
    };

    public async Task<string> GetAsync(string key)
    {
        var s = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key);
        return s?.Value ?? (Defaults.TryGetValue(key, out var d) ? d.Value : string.Empty);
    }

    public async Task<decimal> GetDecimalAsync(string key, decimal fallback) =>
        decimal.TryParse(await GetAsync(key), NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : fallback;

    public async Task<int> GetIntAsync(string key, int fallback) =>
        int.TryParse(await GetAsync(key), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : fallback;
}

/// <summary>Validates and stores uploaded images outside the web root.</summary>
public class FileStorageService(IWebHostEnvironment env)
{
    private const long MaxBytes = 5 * 1024 * 1024;
    private static readonly Dictionary<string, string> Allowed = new()
    {
        ["image/jpeg"] = ".jpg", ["image/png"] = ".png", ["image/webp"] = ".webp"
    };

    private string Root => Path.Combine(env.ContentRootPath, "App_Data", "uploads");

    public async Task<(string RelativePath, string ContentType)> SaveImageAsync(IFormFile file, string folder)
    {
        if (file is null || file.Length == 0) throw new AppException("Please attach a photo.");
        if (file.Length > MaxBytes) throw new AppException("Photo must be smaller than 5 MB.");
        if (!Allowed.TryGetValue(file.ContentType.ToLowerInvariant(), out var ext))
            throw new AppException("Only JPG, PNG or WEBP images are allowed.");

        // Verify file signature (magic bytes) rather than trusting the client's content type.
        var header = new byte[12];
        await using (var s = file.OpenReadStream())
        {
            var read = await s.ReadAsync(header.AsMemory(0, header.Length));
            if (read < 4 || !SignatureMatches(header, ext)) throw new AppException("The uploaded file is not a valid image.");
        }

        var safeFolder = string.Concat(folder.Where(char.IsLetterOrDigit));
        var dir = Path.Combine(Root, safeFolder);
        Directory.CreateDirectory(dir);
        var name = $"{Guid.NewGuid():N}{ext}";
        await using (var target = File.Create(Path.Combine(dir, name)))
        await using (var source = file.OpenReadStream())
            await source.CopyToAsync(target);

        return (Path.Combine(safeFolder, name), file.ContentType.ToLowerInvariant());
    }

    public Stream? OpenRead(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(Root, relativePath));
        if (!full.StartsWith(Path.GetFullPath(Root), StringComparison.Ordinal) || !File.Exists(full)) return null;
        return File.OpenRead(full);
    }

    private static bool SignatureMatches(byte[] h, string ext) => ext switch
    {
        ".jpg" => h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF,
        ".png" => h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47,
        ".webp" => h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 && h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50,
        _ => false
    };
}
