// Compatibility for old bookmarks: About now exists only inside the app.
const destination = new URL("/", location.origin);
const language = new URLSearchParams(location.search).get("lang");
if (language === "en" || language === "fa") destination.searchParams.set("lang", language);
location.replace(destination.href);
