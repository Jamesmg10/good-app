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

**Where to put client settings (important):** Blazor WebAssembly loads configuration by requesting **`/appsettings.json`** from the **same origin** as the app (static files under `wwwroot`). The file **must** live at **`src/GoodApp.Client/wwwroot/appsettings.json`**. If `appsettings.json` sits only next to the `.csproj` or under `bin/`, the browser never receives `AzureAd` settings. MSAL.js then runs with no **`authority`**; its initializer calls `new URL(authority)` and the console shows **`Failed to construct 'URL': Invalid URL`**. That failure is **not** an Azure app registration or subscription problem—it is missing client config on the static site.

In [Microsoft Entra admin center](https://entra.microsoft.com) (or Azure Portal), open your **App registration** and set:

- **Application (client) ID** and **Directory (tenant) ID** → copy into `src/GoodApp.Client/wwwroot/appsettings.json` as `AzureAd:ClientId` and into `AzureAd:Authority` as `https://login.microsoftonline.com/{tenant-id}` (no `/v2.0` suffix).

Under **Authentication**, add a **Single-page application** platform (not “Web”) and register this **exact** redirect URI for local dev:

`https://localhost:7077/authentication/login-callback`

Optional logout redirect:

`https://localhost:7077/authentication/logout-callback`

Use the same scheme, host, and port in **`RedirectUri`** / **`PostLogoutRedirectUri`** in `wwwroot/appsettings.json` as in Entra (for local dev, full `https://localhost:7077/...` URLs match the SPA registration above). The origin must match how you open the app (**HTTPS** on **7077** when using the steps below).

To confirm the file is served, open **`https://localhost:7077/appsettings.json`** after starting the API; you should see JSON (without committing secrets you care about).

#### Social sign-in (Google, Facebook, Apple)

Workforce-only Entra (`login.microsoftonline.com/{tenant}`) does **not** expose Google/Facebook as first-class IdPs in the same way as **Microsoft Entra External Identities** user flows. To support **Continue with Google** (and similar) end-to-end, use a **customer** tenant with **External Identities** → identity providers and a **user flow**, assign your SPA app registration to that flow, and point `AzureAd:Authority` / `AzureAd:ClientId` at that tenant.

The login page passes optional `InteractiveRequestOptions` extras via `AzureAd:LoginQuery` in `wwwroot/appsettings.json` (for example `domainHint` and `idp`). Values must match how your tenant names providers; if a button still routes to the Microsoft account screen, confirm the provider identifier in Entra and adjust `LoginQuery` accordingly.

**Google Cloud Console (`redirect_uri_mismatch`):** When Google is federated through Entra, Google redirects to **Microsoft’s federation callback URL**, not `https://localhost:7077/...`. In **Google Cloud** → **Credentials** → your OAuth 2.0 client, add the **exact** redirect URI shown in **Entra → External Identities → All identity providers → Google** (copy/paste; no trailing slash mismatch). Do not list only the SPA localhost callback here—that URI is for Entra’s app registration, not for Google’s OAuth client in this flow.

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

`src/GoodApp.Client/wwwroot/appsettings.json` sets `ApiBaseUrl` to `https://localhost:7077/` so `HttpClient` calls the same host that serves the UI. Change it if you use a different port.

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
| `Failed to construct 'URL': Invalid URL` (console, `AuthenticationService.js` / MSAL `init`) | **`AzureAd:Authority` never reached the WASM app.** Blazor loads settings from **`/appsettings.json`** (a static file under **`wwwroot`**). If that file is missing from the served site, `authority` is empty and MSAL’s `new URL(authority)` throws. | **Fix:** keep **`src/GoodApp.Client/wwwroot/appsettings.json`** and verify **`https://localhost:7077/appsettings.json`** returns JSON when the API host is running. Do not rely on an `appsettings.json` that is only beside the `.csproj` or only under `bin/`. |
| Stuck on “Checking login state…” | MSAL redirect flow not completing; wrong or mismatched redirect URI; or stale browser storage. | Use **HTTPS** and the same origin as registered in Entra (for this repo: **7077** when using the API host). Register **SPA** redirect URIs, not “Web”. Clear site data / `msal` keys in **Application** storage after changing app registration. |
| `Failed to bind ... 7077: address already in use` | A previous **GoodApp.Api** instance is still running. | Stop the old process (**Ctrl+C**) or `kill` the PID holding the port. |
| `MSBUILD : error MSB1009: Project file does not exist` | `dotnet run --project` path was relative to the **wrong** working directory. | From repo root use `src/GoodApp.Api/GoodApp.Api.csproj`. From `src/GoodApp.Api` use `GoodApp.Api.csproj` or plain `dotnet run`. |
| `AADSTS50011` (in URL or network response) | Redirect URI in the request does not match Entra registration. | Must match **exactly** (scheme, host, port, path). |
| Google **Error 400: `redirect_uri_mismatch`** | The redirect URI sent to Google is not listed on the **Google Cloud** OAuth client used by Entra’s Google IdP. | Add the **Entra federation** redirect URI from the Google identity provider blade (not `localhost`). Use the same OAuth client ID/secret as configured in Entra. |

Earlier experiments (since reverted or superseded) included: copying `AuthenticationService.js` into `wwwroot/js`, dynamic script loading and `Blazor.start()` ordering, and chasing redirect URI / `HostEnvironment.BaseAddress` in code while **`appsettings.json` was not under `wwwroot`** (the actual cause of **`Invalid URL`** from MSAL—see table above). The **current** codebase uses **`wwwroot/appsettings.json`** plus a small, template-like setup and the **hosted** API project reference, which is the supported way to avoid the dev-server `_content` problem.

---

## Next steps

- JWT validation on the API for protected endpoints; attach tokens via `AuthorizationMessageHandler` on `HttpClient`
- PostgreSQL on Azure for opportunities and user data
- Azure Static Web Apps + App Service, Front Door, Application Insights
- **Map:** fix remaining map errors (Azure Maps control, `/api/maps/auth`, keys, or browser console issues) — track and resolve before treating the map experience as done.

### Authentication (follow-up)

- Confirm **`src/GoodApp.Client/wwwroot/appsettings.json`** uses the **Application (client) ID** and **Directory (tenant) ID** from the Entra app registration you intend (replace placeholders if you fork the repo).
- For **Google** sign-in: finish **Google Cloud** OAuth client setup so **Authorized redirect URIs** include Entra’s federation URL from **External Identities → All identity providers → Google**; resolve any `redirect_uri_mismatch` before testing again.
- For **Facebook** (and similar): add the provider in Entra, enable it on the same **user flow** as the SPA, and align `AzureAd:LoginQuery` if direct IdP routing is required.
- Prefer a **dev** customer tenant and app registration for local testing; keep production values out of shared branches if your policy requires it.
