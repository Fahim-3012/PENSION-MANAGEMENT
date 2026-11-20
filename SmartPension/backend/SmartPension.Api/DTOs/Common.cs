using System.ComponentModel.DataAnnotations;

namespace SmartPension.Api.DTOs;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public class PageQuery
{
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 10;
    [MaxLength(100)] public string? Search { get; set; }
    [MaxLength(30)] public string? Status { get; set; }
    [MaxLength(30)] public string? SortBy { get; set; }
    public bool SortDesc { get; set; } = true;
}

public class ReasonRequest
{
    [Required(ErrorMessage = "A reason is required.")]
    [StringLength(500, MinimumLength = 5, ErrorMessage = "Reason must be between 5 and 500 characters.")]
    public string Reason { get; set; } = string.Empty;
}

public record MessageResponse(string Message);

public static class Mask
{
    public static string Tail(string? value, int visible = 4)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (value.Length <= visible) return new string('•', value.Length);
        return new string('•', Math.Min(value.Length - visible, 8)) + value[^visible..];
    }
}
