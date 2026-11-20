using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Data;

/// <summary>Creates/migrates the database and seeds roles, default settings and the first super admin.</summary>
public static class DbInitializer
{
    public static async Task InitializeAsync(IServiceProvider services, IConfiguration config, ILogger logger)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        if (db.Database.GetMigrations().Any())
            await db.Database.MigrateAsync();
        else
            await db.Database.EnsureCreatedAsync();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles.All)
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new IdentityRole(role));

        foreach (var (key, (value, description)) in SettingsService.Defaults)
            if (!await db.SystemSettings.AnyAsync(s => s.Key == key))
                db.SystemSettings.Add(new SystemSetting { Key = key, Value = value, Description = description });
        await db.SaveChangesAsync();

        await SeedRegistryAsync(scope.ServiceProvider, db, config, logger);

        // The first super admin is created ONLY from configuration (user-secrets / environment variables).
        var email = config["Seed:AdminEmail"];
        var password = config["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Seed:AdminEmail / Seed:AdminPassword not configured – no admin account was seeded.");
            return;
        }

        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await userManager.FindByEmailAsync(email) != null) return;

        var admin = new ApplicationUser
        {
            UserName = email, Email = email, EmailConfirmed = true,
            FullName = config["Seed:AdminName"] ?? "System Administrator"
        };
        var result = await userManager.CreateAsync(admin, password);
        if (!result.Succeeded)
        {
            logger.LogError("Could not seed admin: {Errors}", string.Join("; ", result.Errors.Select(e => e.Description)));
            return;
        }
        await userManager.AddToRolesAsync(admin, new[] { Roles.SuperAdmin, Roles.Admin });
        logger.LogInformation("Seeded super admin {Email}", email);
    }

    /// <summary>
    /// Development convenience: when Seed:RegistryCsv points to a CSV file and the registry is empty,
    /// the file is imported with the same validation as the admin "Import" button.
    /// </summary>
    private static async Task SeedRegistryAsync(IServiceProvider sp, AppDbContext db, IConfiguration config, ILogger logger)
    {
        var relative = config["Seed:RegistryCsv"];
        if (string.IsNullOrWhiteSpace(relative) || await db.PensionRecords.AnyAsync()) return;
        var env = sp.GetRequiredService<IWebHostEnvironment>();
        var path = Path.GetFullPath(Path.Combine(env.ContentRootPath, relative));
        if (!File.Exists(path))
        {
            logger.LogWarning("Seed:RegistryCsv file not found: {Path}", path);
            return;
        }
        var registry = sp.GetRequiredService<RegistryService>();
        await using var stream = File.OpenRead(path);
        var result = await registry.ImportAsync(stream, dryRun: false, Path.GetFileName(path));
        logger.LogInformation("Registry seeded from {File}: {Created} records, {Errors} rows with problems",
            Path.GetFileName(path), result.Created, result.WithErrors);
    }
}
