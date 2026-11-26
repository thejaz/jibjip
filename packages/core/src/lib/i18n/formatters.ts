// Cache formatter configuration, never formatted records or personal text.
// Bound each cache so arbitrary user-defined currency codes cannot grow it forever.
function cachedFormatter<T, O extends object>(create: (locale: string, options: O) => T) {
  const cache = new Map<string, T>();
  return (locale: string, options: O): T => {
    const key = JSON.stringify([locale, Object.entries(options).sort(([a], [b]) => a.localeCompare(b))]);
    let formatter = cache.get(key);
    if (!formatter) {
      formatter = create(locale, options);
      if (cache.size >= 64) cache.delete(cache.keys().next().value!);
      cache.set(key, formatter);
    }
    return formatter;
  };
}

export const numberFormatter = cachedFormatter((locale: string, options: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, options));
export const dateFormatter = cachedFormatter((locale: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options));
export const pluralFormatter = cachedFormatter((locale: string, options: Intl.PluralRulesOptions) => new Intl.PluralRules(locale, options));
