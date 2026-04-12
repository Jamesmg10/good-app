# Good (The Good App)

Web-first **Blazor WebAssembly** UI plus **ASP.NET Core** API. Local development follows the **hosted Blazor WebAssembly** pattern from [Microsoft Learn](https://learn.microsoft.com/aspnet/core/blazor/host-and-deploy/webassembly-hosted): the API project references the client, serves the WASM shell (`index.html`, `_framework/*`), and exposes REST endpoints under `/api/*`. That way NuGet static files such as `_content/Microsoft.Authentication.WebAssembly.Msal/AuthenticationService.js` are served the same way as in the official templates.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- An [Azure Maps](https://azure.microsoft.com/products/azure-maps) subscription key (for the map page)
- A **Microsoft Entra ID** app registration configured for a **Single-page application** (see below)

## Solution layout

| Project | Role |
|--------|------|
| `GoodApp.Shared` | DTOs shared by API and client |
| `GoodApp.Api` | Host: static Blazor WASM files + REST API (`/api/*`) |
| `GoodApp.Client` | Blazor WASM UI, MSAL sign-in, Azure Maps |

## Run the application locally (recommended)

Use **one** process: the API host. Do **not** start a second copy on the same HTTPS port (you will see “address already in use”).

### 1. Configure the API (Azure Maps)

From the repository root:

```bash
cd src/GoodApp.Api
dotnet user-secrets set "AzureMaps:SubscriptionKey" "YOUR_PRIMARY_KEY"
```

Alternatively, set the key in `appsettings.Development.json` locally (do not commit real keys).

### 2. Configure Entra ID for the Blazor SPA

In [Microsoft Entra admin center](https://entra.microsoft.com) (or Azure Portal), open your **App registration** and set:

- **Application (client) ID** and **Directory (tenant) ID** → copy into `src/GoodApp.Client/appsettings.json` as `AzureAd:ClientId` and into `AzureAd:Authority` as `https://login.microsoftonline.com/{tenant-id}` (no `/v2.0` suffix).

Under **Authentication**, add a **Single-page application** platform (not “Web”) and register this **exact** redirect URI for local dev:

`https://localhost:7077/authentication/login-callback`

Optional logout redirect:

`https://localhost:7077/authentication/logout-callback`

`appsettings.json` uses path-style values (`/authentication/login-callback`); MSAL combines them with the site origin. The origin must match how you open the app (**HTTPS** on **7077** when using the steps below).

### 3. Start the host

From the **repository root** (`good-app`):

```bash
dotnet run --project src/GoodApp.Api/GoodApp.Api.csproj
```

Or, if your current directory is already `src/GoodApp.Api`:

```bash
dotnet run
```

The API listens on **https://localhost:7077** and **http://localhost:5077** (see `src/GoodApp.Api/Properties/launchSettings.json`). Open:

**https://localhost:7077/**

You should see the sign-in page. After sign-in, use **Map** for Azure Maps and sample opportunities.

### 4. If the port is already in use

Error: `Failed to bind to address https://127.0.0.1:7077: address already in use`.

Another `GoodApp.Api` (or other process) is still listening. Stop the previous `dotnet run` with **Ctrl+C**, or find and end the process, for example:

```bash
lsof -nP -iTCP:7077 -sTCP:LISTEN
kill <PID>
```

### 5. API base URL

`src/GoodApp.Client/appsettings.json` sets `ApiBaseUrl` to `https://localhost:7077/` so `HttpClient` calls the same host that serves the UI. Change it if you use a different port.

---

## Optional: run the Blazor dev server only (`GoodApp.Client`)

```bash
cd src/GoodApp.Client
dotnet run
```

This typically opens **https://localhost:7273**. The WASM dev host **does not reliably serve** all NuGet `_content/...` paths; **MSAL’s `AuthenticationService.js` may not load**, which breaks sign-in. For auth troubleshooting, prefer the **API host on 7077** above. If you use the client-only server for UI work, add `https://localhost:7273` to Entra redirect URIs and to `Cors:AllowedOrigins` in the API when the API still runs separately on 7077.

---

## `index.html` and MSAL (documentation alignment)

`wwwroot/index.html` includes the script tags described for Blazor WASM + MSAL:

```html
<script src="_content/Microsoft.Authentication.WebAssembly.Msal/AuthenticationService.js"></script>
<script src="_framework/blazor.webassembly.js"></script>
```

With **hosted** deployment via `GoodApp.Api`, those URLs are served by Kestrel together with the rest of the WASM assets.

---

## Security note

`GET /api/maps/auth` returns an Azure Maps subscription key for the map control. For production, restrict this endpoint, store the key in **Azure Key Vault**, and prefer stronger patterns described in [Azure Maps authentication](https://learn.microsoft.com/azure/azure-maps/how-to-manage-authentication).

---

## Troubleshooting history (what we tried and what went wrong)

This section records issues seen during development so future debugging starts from facts rather than guesses.

| Symptom | Likely cause | Notes |
|--------|----------------|-------|
| `Could not find 'AuthenticationService.init' ('AuthenticationService' was undefined)` | The MSAL JavaScript file never ran, so `window.AuthenticationService` was missing. | Often happened when running **`dotnet run` on `GoodApp.Client` only**: the WASM **dev server** frequently does **not** serve `_content/Microsoft.Authentication.WebAssembly.Msal/AuthenticationService.js` correctly. **Fix:** host the client from **`GoodApp.Api`** (`UseBlazorFrameworkFiles`, `UseStaticFiles`, `MapFallbackToFile`) so behavior matches [hosted Blazor WebAssembly](https://learn.microsoft.com/aspnet/core/blazor/host-and-deploy/webassembly-hosted). Also ensure `index.html` contains the `<script src="_content/.../AuthenticationService.js">` tag (as in the official templates). |
| Stuck on “Checking login state…” | MSAL redirect flow not completing; wrong or mismatched redirect URI; or stale browser storage. | Use **HTTPS** and the same origin as registered in Entra (for this repo: **7077** when using the API host). Register **SPA** redirect URIs, not “Web”. Clear site data / `msal` keys in **Application** storage after changing app registration. |
| `Failed to bind ... 7077: address already in use` | A previous **GoodApp.Api** instance is still running. | Stop the old process (**Ctrl+C**) or `kill` the PID holding the port. |
| `MSBUILD : error MSB1009: Project file does not exist` | `dotnet run --project` path was relative to the **wrong** working directory. | From repo root use `src/GoodApp.Api/GoodApp.Api.csproj`. From `src/GoodApp.Api` use `GoodApp.Api.csproj` or plain `dotnet run`. |
| `AADSTS50011` (in URL or network response) | Redirect URI in the request does not match Entra registration. | Must match **exactly** (scheme, host, port, path). |

Earlier experiments (since reverted or superseded) included: copying `AuthenticationService.js` into `wwwroot/js`, dynamic script loading and `Blazor.start()` ordering, `appsettings.Development.json` with absolute redirect URIs, extra MSAL cache flags, custom `Authentication.razor` fragments, and verbose auth logging. The **current** codebase is reduced to a small, template-like setup plus the **hosted** API project reference, which is the supported way to avoid the dev-server `_content` problem.

---

## Next steps

- JWT validation on the API for protected endpoints; attach tokens via `AuthorizationMessageHandler` on `HttpClient`
- PostgreSQL on Azure for opportunities and user data
- Azure Static Web Apps + App Service, Front Door, Application Insights
