using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;

namespace SmartPension.Api.Services;

/// <summary>PDF generation with QuestPDF (Community license). Text is English to avoid font-embedding issues.</summary>
public class PdfService
{
    private const string Primary = "#103C35";
    private const string Accent = "#D9AA55";
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    private static string Money(decimal v) => "BDT " + v.ToString("N2", Inv);
    private static string Date(DateTime d) => d.ToString("dd MMM yyyy", Inv);

    private static IContainer HeadCell(IContainer c) =>
        c.Background(Primary).PaddingVertical(5).PaddingHorizontal(6).DefaultTextStyle(x => x.FontColor(Colors.White).SemiBold());

    private static IContainer BodyCell(IContainer c) =>
        c.BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).PaddingVertical(4).PaddingHorizontal(6);

    private static void Header(IContainer c, string title, string subtitle)
    {
        c.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.RelativeItem().Column(inner =>
                {
                    inner.Item().Text("Smart Pension Management System").FontSize(16).Bold().FontColor(Primary);
                    inner.Item().Text(title).FontSize(12).SemiBold();
                    inner.Item().Text(subtitle).FontSize(9).FontColor(Colors.Grey.Darken1);
                });
                row.ConstantItem(140).AlignRight().Text($"Generated {DateTime.UtcNow.ToString("dd MMM yyyy HH:mm", Inv)} UTC")
                    .FontSize(8).FontColor(Colors.Grey.Darken1);
            });
            col.Item().PaddingTop(6).LineHorizontal(2).LineColor(Accent);
        });
    }

    private static void Footer(IContainer c) => c.AlignCenter().Text(t =>
    {
        t.DefaultTextStyle(x => x.FontSize(8).FontColor(Colors.Grey.Darken1));
        t.Span("Page ");
        t.CurrentPageNumber();
        t.Span(" of ");
        t.TotalPages();
    });

    public byte[] Statement(Pensioner p, StatementDto s)
    {
        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(36);
            page.DefaultTextStyle(x => x.FontSize(9.5f));
            page.Header().Element(c => Header(c, "Pension Account Statement", $"{Date(s.From)} – {Date(s.To)}"));
            page.Content().PaddingVertical(12).Column(col =>
            {
                col.Spacing(10);
                col.Item().Row(r =>
                {
                    r.RelativeItem().Column(c =>
                    {
                        c.Item().Text($"Name: {p.FullName}");
                        c.Item().Text($"Pension ID: {p.PensionId}");
                        c.Item().Text($"Organization: {p.FormerOrganization}");
                    });
                    r.RelativeItem().Column(c =>
                    {
                        c.Item().AlignRight().Text($"Opening balance: {Money(s.OpeningBalance)}");
                        c.Item().AlignRight().Text($"Total credited: {Money(s.TotalCredit)}");
                        c.Item().AlignRight().Text($"Total debited: {Money(s.TotalDebit)}");
                        c.Item().AlignRight().Text($"Closing balance: {Money(s.ClosingBalance)}").Bold();
                    });
                });

                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(cd =>
                    {
                        cd.ConstantColumn(70); cd.RelativeColumn(3); cd.RelativeColumn(2);
                        cd.RelativeColumn(1.5f); cd.RelativeColumn(1.5f); cd.RelativeColumn(1.6f);
                    });
                    t.Header(h =>
                    {
                        h.Cell().Element(HeadCell).Text("Date");
                        h.Cell().Element(HeadCell).Text("Description");
                        h.Cell().Element(HeadCell).Text("Reference");
                        h.Cell().Element(HeadCell).AlignRight().Text("Credit");
                        h.Cell().Element(HeadCell).AlignRight().Text("Debit");
                        h.Cell().Element(HeadCell).AlignRight().Text("Balance");
                    });
                    if (s.Transactions.Count == 0)
                    {
                        t.Cell().ColumnSpan(6).Element(BodyCell).AlignCenter().Text("No transactions in this period.");
                    }
                    foreach (var tx in s.Transactions)
                    {
                        t.Cell().Element(BodyCell).Text(Date(tx.CreatedAt));
                        t.Cell().Element(BodyCell).Text(tx.Description);
                        t.Cell().Element(BodyCell).Text(tx.Reference ?? "-");
                        t.Cell().Element(BodyCell).AlignRight().Text(tx.Type == TransactionType.Credit ? Money(tx.Amount) : "");
                        t.Cell().Element(BodyCell).AlignRight().Text(tx.Type == TransactionType.Debit ? Money(tx.Amount) : "");
                        t.Cell().Element(BodyCell).AlignRight().Text(Money(tx.BalanceAfter));
                    }
                });
                col.Item().PaddingTop(10).Text("This statement is system generated and does not require a signature.")
                    .FontSize(8).Italic().FontColor(Colors.Grey.Darken1);
            });
            page.Footer().Element(Footer);
        })).GeneratePdf();
    }

    public byte[] AdminReport(ReportSummaryDto summary, IReadOnlyList<AdminPaymentItem> payments,
        IReadOnlyList<AdminWithdrawalItem> withdrawals)
    {
        return Document.Create(doc => doc.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(32);
            page.DefaultTextStyle(x => x.FontSize(9));
            page.Header().Element(c => Header(c, "Administrative Report", $"{Date(summary.From)} – {Date(summary.To)}"));
            page.Content().PaddingVertical(12).Column(col =>
            {
                col.Spacing(12);
                col.Item().Text("Summary").FontSize(11).Bold().FontColor(Primary);
                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(cd => { cd.RelativeColumn(3); cd.RelativeColumn(2); });
                    void Row(string k, string v)
                    {
                        t.Cell().Element(BodyCell).Text(k);
                        t.Cell().Element(BodyCell).AlignRight().Text(v).SemiBold();
                    }
                    Row("New registrations", summary.NewRegistrations.ToString(Inv));
                    Row("Registrations approved", summary.Approvals.ToString(Inv));
                    Row("Successful payments", summary.PaymentsSucceeded.ToString(Inv));
                    Row("Amount disbursed", Money(summary.AmountDisbursed));
                    Row("Failed payments", summary.PaymentsFailed.ToString(Inv));
                    Row("Withdrawals approved", summary.WithdrawalsApproved.ToString(Inv));
                    Row("Amount withdrawn", Money(summary.AmountWithdrawn));
                    Row("Withdrawals rejected", summary.WithdrawalsRejected.ToString(Inv));
                    Row("Life verifications approved", summary.LifeVerificationsApproved.ToString(Inv));
                    Row("Complaints received", summary.ComplaintsReceived.ToString(Inv));
                });

                col.Item().Text($"Payments ({payments.Count})").FontSize(11).Bold().FontColor(Primary);
                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(cd => { cd.RelativeColumn(1.4f); cd.RelativeColumn(2.6f); cd.RelativeColumn(1.2f); cd.RelativeColumn(1.5f); cd.RelativeColumn(1.2f); });
                    t.Header(h =>
                    {
                        h.Cell().Element(HeadCell).Text("Pension ID");
                        h.Cell().Element(HeadCell).Text("Name");
                        h.Cell().Element(HeadCell).Text("Period");
                        h.Cell().Element(HeadCell).AlignRight().Text("Amount");
                        h.Cell().Element(HeadCell).Text("Status");
                    });
                    foreach (var p in payments)
                    {
                        t.Cell().Element(BodyCell).Text(p.PensionId ?? "-");
                        t.Cell().Element(BodyCell).Text(p.PensionerName);
                        t.Cell().Element(BodyCell).Text($"{p.Month:D2}/{p.Year}");
                        t.Cell().Element(BodyCell).AlignRight().Text(Money(p.Amount));
                        t.Cell().Element(BodyCell).Text(p.Status.ToString());
                    }
                });

                col.Item().Text($"Withdrawals ({withdrawals.Count})").FontSize(11).Bold().FontColor(Primary);
                col.Item().Table(t =>
                {
                    t.ColumnsDefinition(cd => { cd.RelativeColumn(1.4f); cd.RelativeColumn(2.6f); cd.RelativeColumn(1.4f); cd.RelativeColumn(1.5f); cd.RelativeColumn(1.2f); });
                    t.Header(h =>
                    {
                        h.Cell().Element(HeadCell).Text("Pension ID");
                        h.Cell().Element(HeadCell).Text("Name");
                        h.Cell().Element(HeadCell).Text("Requested");
                        h.Cell().Element(HeadCell).AlignRight().Text("Amount");
                        h.Cell().Element(HeadCell).Text("Status");
                    });
                    foreach (var w in withdrawals)
                    {
                        t.Cell().Element(BodyCell).Text(w.PensionId ?? "-");
                        t.Cell().Element(BodyCell).Text(w.PensionerName);
                        t.Cell().Element(BodyCell).Text(Date(w.RequestedAt));
                        t.Cell().Element(BodyCell).AlignRight().Text(Money(w.Amount));
                        t.Cell().Element(BodyCell).Text(w.Status.ToString());
                    }
                });
            });
            page.Footer().Element(Footer);
        })).GeneratePdf();
    }
}
