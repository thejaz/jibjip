declare const __JIBJIP_BRAND_VERSION__: string;

export const APP_CREATOR = { name: "THEJAZ", url: "https://github.com/thejaz" } as const;

export function brandWordmarkUrl(locale: string): string {
  const wordmarkLocale = locale === "fa" ? "fa" : "en";
  return `/brand/jibjip-type-${wordmarkLocale}.svg?v=${__JIBJIP_BRAND_VERSION__}`;
}
