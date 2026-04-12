namespace GoodApp.Shared.Models;

public sealed class OpportunityDto
{
    public Guid Id { get; init; }
    public string Title { get; init; } = "";
    public string? Description { get; init; }
    public OpportunityType Type { get; init; }
    public double Latitude { get; init; }
    public double Longitude { get; init; }
    public string? OrganizationName { get; init; }
    public string? Address { get; init; }
}
