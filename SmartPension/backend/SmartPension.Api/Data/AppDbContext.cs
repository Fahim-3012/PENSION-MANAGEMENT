using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Models;

namespace SmartPension.Api.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Pensioner> Pensioners => Set<Pensioner>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<Nominee> Nominees => Set<Nominee>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Withdrawal> Withdrawals => Set<Withdrawal>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<LifeVerification> LifeVerifications => Set<LifeVerification>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Complaint> Complaints => Set<Complaint>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<PensionRecord> PensionRecords => Set<PensionRecord>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Store every enum as a readable string column.
        configurationBuilder.Properties<Enum>().HaveConversion<string>().HaveMaxLength(30);
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // Pomelo gives Guid (char(36)) columns the 'ascii_general_ci' collation, which TiDB Cloud rejects
        // ("Unsupported collation when new collation is enabled"). An empty value leaves the column on the
        // database default collation, which works on MySQL, MariaDB and TiDB.
        b.UseGuidCollation(string.Empty);

        b.Entity<Pensioner>(e =>
        {
            e.HasOne(p => p.User).WithOne(u => u.Pensioner)
                .HasForeignKey<Pensioner>(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(p => p.UserId).IsUnique();
            e.HasIndex(p => p.NidNumber).IsUnique();
            e.HasIndex(p => p.PensionId).IsUnique();
            e.HasIndex(p => p.Status);
        });

        b.Entity<BankAccount>(e =>
        {
            e.HasOne(x => x.Pensioner).WithMany(p => p.BankAccounts)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.Status);
        });

        b.Entity<Nominee>(e =>
            e.HasOne(x => x.Pensioner).WithMany(p => p.Nominees)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade));

        b.Entity<Payment>(e =>
        {
            e.HasOne(x => x.Pensioner).WithMany(p => p.Payments)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.PensionerId, x.Year, x.Month }).IsUnique();
            e.HasIndex(x => x.Status);
        });

        b.Entity<Withdrawal>(e =>
        {
            e.HasOne(x => x.Pensioner).WithMany(p => p.Withdrawals)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.BankAccount).WithMany()
                .HasForeignKey(x => x.BankAccountId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.Status);
        });

        b.Entity<Transaction>(e =>
        {
            e.HasOne(x => x.Pensioner).WithMany(p => p.Transactions)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.PensionerId, x.CreatedAt });
        });

        b.Entity<LifeVerification>(e =>
        {
            e.HasOne(x => x.Pensioner).WithMany(p => p.LifeVerifications)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.Status);
        });

        b.Entity<Complaint>(e =>
            e.HasOne(x => x.Pensioner).WithMany(p => p.Complaints)
                .HasForeignKey(x => x.PensionerId).OnDelete(DeleteBehavior.Cascade));

        b.Entity<PensionRecord>(e =>
        {
            e.HasIndex(x => x.PensionId).IsUnique();
            e.HasIndex(x => x.NidNumber).IsUnique();
            e.HasIndex(x => x.ClaimedByPensionerId);
        });

        b.Entity<Notification>(e => e.HasIndex(x => new { x.UserId, x.IsRead }));
        b.Entity<AuditLog>(e => { e.HasIndex(x => x.CreatedAt); e.HasIndex(x => x.Action); });
    }
}
