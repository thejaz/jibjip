const SITE_TOKEN = "4361015c39ec41d8b26cc3fde22ab7b9";
const CHOICE_KEY = "jibjip.website.statistics.v1";
const LEGACY_CHOICE_KEY = "jibjip.website.analytics.v1";

/** Optional homepage measurement; never renders UI or touches app persistence. */
export function setupHomepageAnalytics() {
  if (location.origin !== "https://jibjip.com" || location.pathname !== "/") return;
  let allowed = true;
  try {
    const saved = localStorage.getItem(CHOICE_KEY);
    if (saved !== null) allowed = saved === "granted";
    else allowed = localStorage.getItem(LEGACY_CHOICE_KEY) !== "denied";
  } catch { allowed = false; }
  // Retire only the former homepage tag's cookies.
  for (const item of document.cookie.split(";")) {
    const name = item.trim().split("=")[0];
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of ["", "; domain=jibjip.com", "; domain=.jibjip.com"]) {
      document.cookie = `${name}=; max-age=0; path=/${domain}; SameSite=Lax; Secure`;
    }
  }
  if (!allowed) return;
  const script = document.createElement("script");
  script.type = "module";
  script.async = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.referrerPolicy = "no-referrer";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: SITE_TOKEN, spa: false }));
  document.head.append(script);
  let blocked = false;
  // Honor withdrawal from an older open release without reloading any page.
  window.addEventListener("storage", event => {
    if (event.key !== CHOICE_KEY && event.key !== LEGACY_CHOICE_KEY && event.key !== null) return;
    if (event.newValue === "granted" || blocked) return;
    blocked = true;
    script.remove();
    const policy = document.createElement("meta");
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "connect-src 'self'";
    document.head.append(policy);
  });
}
