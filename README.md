# Good (The Good App)

Web-first **Blazor WebAssembly** client plus **ASP.NET Core** API, structured for Azure (Static Web Apps + App Service) and a future **.NET MAUI Blazor Hybrid** app sharing this codebase.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- An [Azure Maps](https://azure.microsoft.com/products/azure-maps) subscription key (for the map page)

## Local development

1. **Configure the API** — set your Azure Maps key (prefer user secrets over committing keys):

   ```bash
   cd src/GoodApp.Api
   dotnet user-secrets set "AzureMaps:SubscriptionKey" "YOUR_PRIMARY_KEY"
   ```

   Alternatively, edit `appsettings.Development.json` locally (do not commit real keys).

2. **Run the API** (HTTPS on port 7077):

   ```bash
   cd src/GoodApp.Api
   dotnet run
   ```

3. **Run the Blazor client** (in another terminal):

   ```bash
   cd src/GoodApp.Client
   dotnet run
   ```

   Open the URL shown (typically `https://localhost:7273`). You land on **Sign in** first; after authentication, open **Map** for Azure Maps and sample opportunities.

4. **API base URL** — the client reads `ApiBaseUrl` from `src/GoodApp.Client/appsettings.json`. Change it if your API uses a different port.

5. **Sign-in (Microsoft Entra / External ID)** — edit `src/GoodApp.Client/appsettings.json` (or user-specific overrides) with your SPA registration:

   - `AzureAd:ClientId` — application (client) ID  
   - `AzureAd:Authority` — for single-tenant work accounts use `https://login.microsoftonline.com/{tenantId}` (no `/v2.0` suffix; MSAL adds the correct endpoints). External ID uses the authority string from that product’s docs.  

   Under **Authentication** for that app registration, add a **Single-page application** redirect URI (type must be **SPA**, not “Web”):

   - `https://localhost:7273/authentication/login-callback`

   The client uses **redirect** login (not popup) so sign-in completes reliably in the browser.

   **If sign-in hangs on “Checking login state”:** confirm the redirect URI matches exactly, clear site data for `localhost`, try a private window, and check the browser console / Network tab for `AADSTS` errors (e.g. `AADSTS50011` = redirect URI mismatch).

## Solution layout

| Project | Role |
|--------|------|
| `GoodApp.Shared` | DTOs shared by API and client |
| `GoodApp.Api` | REST API: `GET /api/opportunities`, `GET /api/maps/auth`, `GET /api/health` |
| `GoodApp.Client` | Blazor WASM UI + Azure Maps Web SDK (JS module) |

## Security note

`GET /api/maps/auth` returns a subscription key for the Azure Maps control. For production, restrict this endpoint (authenticated users only), move the key to **Azure Key Vault**, and prefer **Microsoft Entra ID** or short-lived tokens as described in [Azure Maps authentication](https://learn.microsoft.com/azure/azure-maps/how-to-manage-authentication).

## Next steps

- JWT validation on the API for protected endpoints; attach tokens from the Blazor `AuthorizationMessageHandler` to `HttpClient`
- PostgreSQL on Azure for opportunities and user contribution records
- Azure Static Web Apps + App Service, Front Door, and Application Insights
