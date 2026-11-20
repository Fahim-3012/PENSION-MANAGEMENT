using Microsoft.EntityFrameworkCore;
using SmartPension.Api.Services;

namespace SmartPension.Api.Middleware;

/// <summary>Converts exceptions into consistent JSON error responses: { "message": "..." }.</summary>
public class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger, IHostEnvironment env)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            await WriteAsync(context, ex.StatusCode, ex.Message);
        }
        catch (DbUpdateConcurrencyException)
        {
            await WriteAsync(context, StatusCodes.Status409Conflict,
                "This record was changed by another action. Please refresh and try again.");
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Database update failed");
            await WriteAsync(context, StatusCodes.Status409Conflict,
                env.IsDevelopment() ? ex.InnerException?.Message ?? ex.Message : "The data could not be saved. It may conflict with an existing record.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception for {Path}", context.Request.Path);
            await WriteAsync(context, StatusCodes.Status500InternalServerError,
                env.IsDevelopment() ? ex.Message : "An unexpected error occurred. Please try again later.");
        }
    }

    private static Task WriteAsync(HttpContext context, int status, string message)
    {
        if (context.Response.HasStarted) return Task.CompletedTask;
        context.Response.Clear();
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new { message });
    }
}

public class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        var h = context.Response.Headers;
        h["X-Content-Type-Options"] = "nosniff";
        h["X-Frame-Options"] = "DENY";
        h["Referrer-Policy"] = "no-referrer";
        return next(context);
    }
}
