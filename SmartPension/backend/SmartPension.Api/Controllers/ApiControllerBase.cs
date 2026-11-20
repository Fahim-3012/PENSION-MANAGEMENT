using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Data;
using SmartPension.Api.DTOs;
using SmartPension.Api.Models;
using SmartPension.Api.Services;

namespace SmartPension.Api.Controllers;

[ApiController]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    protected string CurrentUserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub")
        ?? throw new AppException("Not authenticated.", StatusCodes.Status401Unauthorized);

    protected static (int Skip, int Take) Paging(PageQuery q) => ((q.Page - 1) * q.PageSize, q.PageSize);

    protected static TEnum? ParseEnum<TEnum>(string? value) where TEnum : struct, Enum =>
        !string.IsNullOrWhiteSpace(value) && Enum.TryParse<TEnum>(value, true, out var v) ? v : null;
}

/// <summary>Base for endpoints used by the signed-in pensioner (always scoped to their own data).</summary>
public abstract class PensionerControllerBase : ApiControllerBase
{
    protected readonly AppDbContext Db;
    protected PensionerControllerBase(AppDbContext db) => Db = db;

    protected async Task<Pensioner> GetPensionerAsync() =>
        await Db.Pensioners.FirstOrDefaultAsync(p => p.UserId == CurrentUserId)
        ?? throw new AppException("Pensioner profile not found.", StatusCodes.Status404NotFound);
}
