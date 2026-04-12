using GoodApp.Shared.Models;
using GoodApp.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<OpportunityStore>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", app = "Good" }));

app.MapGet("/api/maps/auth", (IConfiguration config) =>
{
    var key = config["AzureMaps:SubscriptionKey"];
    if (string.IsNullOrWhiteSpace(key))
    {
        return Results.Json(new MapAuthResponse { Error = "AzureMaps:SubscriptionKey is not configured." });
    }

    return Results.Json(new MapAuthResponse
    {
        AuthType = "subscriptionKey",
        SubscriptionKey = key
    });
});

app.MapGet("/api/opportunities", (OpportunityStore store, double? minLat, double? minLon, double? maxLat, double? maxLon) =>
{
    IEnumerable<OpportunityDto> list = store.All;

    if (minLat is not null && minLon is not null && maxLat is not null && maxLon is not null)
    {
        list = list.Where(o =>
            o.Latitude >= minLat && o.Latitude <= maxLat &&
            o.Longitude >= minLon && o.Longitude <= maxLon);
    }

    return Results.Json(list.ToList());
});

app.Run();
