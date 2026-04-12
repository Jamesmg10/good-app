using GoodApp.Shared.Models;

namespace GoodApp.Api.Services;

/// <summary>
/// In-memory sample data (Seattle area). Replace with database + geospatial queries later.
/// </summary>
public sealed class OpportunityStore
{
    public IReadOnlyList<OpportunityDto> All { get; }

    public OpportunityStore()
    {
        All =
        [
            new OpportunityDto
            {
                Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
                Title = "Community food bank — sorting",
                Description = "Help sort donations for evening distribution.",
                Type = OpportunityType.Volunteer,
                Latitude = 47.6062,
                Longitude = -122.3321,
                OrganizationName = "Pike Market Food Bank",
                Address = "Seattle, WA"
            },
            new OpportunityDto
            {
                Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
                Title = "Winter coat drive",
                Description = "Drop off gently used coats at the community center.",
                Type = OpportunityType.Donation,
                Latitude = 47.6205,
                Longitude = -122.3493,
                OrganizationName = "Belltown Neighbors",
                Address = "Belltown, Seattle, WA"
            },
            new OpportunityDto
            {
                Id = Guid.Parse("33333333-3333-3333-3333-333333333333"),
                Title = "Park cleanup morning",
                Description = "Volunteer shift 9am–12pm; tools provided.",
                Type = OpportunityType.Event,
                Latitude = 47.6301,
                Longitude = -122.3032,
                OrganizationName = "Volunteer Park Alliance",
                Address = "Volunteer Park, Seattle, WA"
            }
        ];
    }
}
