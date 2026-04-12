using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Authentication;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);

builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

var apiBase = builder.Configuration["ApiBaseUrl"] ?? "https://localhost:7077/";
if (!apiBase.EndsWith('/'))
    apiBase += "/";

builder.Services.AddAuthorizationCore();
builder.Services.AddMsalAuthentication(options =>
{
    builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication);
    // Popup mode often hangs at "Checking login state" locally (blockers, storage). Redirect is reliable for SPA.
    options.ProviderOptions.LoginMode = "redirect";
    // Persist auth across full-page redirects; cookie flag helps some browsers (Safari / strict storage).
    options.ProviderOptions.Cache.CacheLocation = "localStorage";
    options.ProviderOptions.Cache.StoreAuthStateInCookie = true;
    options.ProviderOptions.DefaultAccessTokenScopes.Add("openid");
    options.ProviderOptions.DefaultAccessTokenScopes.Add("profile");
});

builder.Services.AddScoped(_ => new HttpClient { BaseAddress = new Uri(apiBase) });

await builder.Build().RunAsync();
