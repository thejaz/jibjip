// Android shortcuts need their own inset artwork; desktop and Apple keep theirs.
if (/Android/i.test(navigator.userAgent)) {
  document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute("href", "/manifest-android.webmanifest");
}
