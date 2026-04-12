namespace GoodApp.Shared.Models;

/// <summary>
/// Credentials for the Azure Maps Web SDK. Prefer Entra ID or short-lived SAS in production.
/// </summary>
public sealed class MapAuthResponse
{
    public string AuthType { get; init; } = "subscriptionKey";
    public string? SubscriptionKey { get; init; }
    public string? Error { get; init; }
}
