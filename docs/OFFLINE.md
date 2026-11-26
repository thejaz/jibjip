# Installation, offline use, and updates

JIBJIP is a browser app with a Web App Manifest and service worker. No store,
account, backend, push service, or extra dependency is needed. Open **Install**
on the homepage, in setup, or at the bottom of app navigation (**App status**
after installation is detected).

## Browser compatibility

Both builds and the independent core consumer use `scripts/browser-targets.mjs`,
including Safari 15.4. Keep `build.target` and `build.cssTarget` aligned: newer
minifier defaults can rewrite mobile breakpoints into range syntax that needs
[Safari 16.4](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/).
Viewport-based layouts and font/color fallbacks keep Safari 15 usable without
container queries or container units. Preserve these fallbacks when changing
the enhanced layouts. The built-CSS regression check covers both build stages;
a phone-sized Chromium check is not a Safari test.

Optional APIs remain feature-detected. Browsers without compression streams
export ordinary JSON backups; compressed restore explains how to extract JSON.
Do not add user-agent redirects, force desktop mode, clear data, or add a second
app to work around browser compatibility. Physical-device checks remain separate.

## Install and use

- **Android Chrome:** use the Install button when offered, or the browser's
  Install app / Add to Home screen menu.
- **iPhone and iPad:** open the site in Safari, choose Share, then Add to Home
  Screen. Keep Open as Web App enabled when that option is shown.
- **Desktop Chrome and Edge:** use the Install button or address-bar app icon.
- **Safari on Mac:** use File > Add to Dock when available.
- Other browsers may provide a shortcut rather than an installed app. Ordinary
  browser use remains supported; private browsing and managed-browser policies
  may restrict installation, storage, or offline use.

Wait for **Ready to use offline** before relying on a disconnected launch.
The green check indicates a downloaded, activated offline release; it does not
mean the app is installed. Installation is optional. The native Install button
appears only after the browser offers `beforeinstallprompt`, is consumed once,
and reports cancellation or failure without claiming success. Otherwise, show
browser-menu instructions; absence of a prompt does not prove installation.
The update panel distinguishes checking, downloading, a completed check, failure,
offline status, and a downloaded update waiting for windows to close. Its progress
indicator is indeterminate: the browser does not expose download percentages.
When an update is waiting, the navigation/footer control reads **Update ready**
and the dialog opens with restart instructions, including homepage tabs.
Server no-cache headers and `updateViaCache: "none"` keep checks fresh; they do
not override the waiting lifecycle or make a refresh equivalent to closing tabs.
Render the dialog in the document body so switching to a narrow layout cannot
hide an open modal inside the desktop sidebar; retain native modal focus behavior.
The public homepage downloads the full app, including the reference-only setup
seed, so setup can subsequently run offline. Initial download and new rates or
updates require connectivity. Saved financial records and rates work offline.
Installation requires a reachable HTTPS site; localhost is supported only on
the device running the local server. Opening a computer's localhost on a phone
does not reach the computer. An installed personal app opened while its local
server is stopped runs its cached release and cannot see updates; start it with
**Open jibjip.cmd**, which starts the server, after a restart or rebuild.

Installation artwork uses transparent general-purpose icons, a separate maskable
icon for adaptive launchers, and an opaque Apple touch icon. Phone and Mac launchers
may still apply their own tile/mask; a transparent source cannot override that.
Icon references carry content fingerprints, but an existing installation's icon
refresh is controlled by the browser/OS and may lag behind an app update. Do not
clear site data or uninstall as an icon-refresh procedure: protect saved records.

## Update contract

The portable build gives each release a content fingerprint and exact Fetch
SHA-256 integrity values for all three HTML pages, all generated JavaScript and CSS,
brand artwork, icons, font, chick sound, license, and the public reference seed. The fingerprint
also includes worker source. Files download into a separate cache. Missing files,
changed bytes, redirects, authentication pages, or failed requests reject the new
installation and retain the previous release. Upload assets and HTML before the
worker; keep old hashed assets available. A repaired deployment is retried on the
next update check.

A controlled window serves its entire immutable release from its own cache.
Language, artwork, and launcher query hints do not bypass that cache. No network
HTML replaces cached HTML under an older worker. Only allowlisted public files
are cached; other data, financial records, writes, health checks, and remote rate
requests are excluded. Activation removes only obsolete JIBJIP release caches.

Checks run on startup, reconnect, foreground/focus, and every 15 minutes while
visible, with a one-minute throttle for foreground checks. A manual check is
available. The browser may suspend a background or closed app, and a fully offline
device cannot discover a new release.

Downloaded updates use the standard **waiting** service-worker lifecycle.
There is no forced activation, client claiming, automatic reload, or custom
cross-tab coordination. Save work and close **every JIBJIP tab and installed
window in that browser storage context**, including the homepage. The downloaded
update applies automatically on the next opening, even offline. A refresh alone
does not necessarily activate it. This keeps open forms and shared-database
readers on one version. Versions predating this mechanism acquire it on their
first complete upgrade; they cannot be given draft protection retroactively.

## Records and storage

App updates do not clear IndexedDB, replace records with defaults, or sync records
to a server. Devices, browsers, profiles, and origins have separate financial
databases; some platforms also isolate installed-app storage from browser storage.
Use full backup and restore to move records. Do not promise that installation
copies the current browser database.

Optional **Request storage protection** uses StorageManager.persist(). The browser
may decline it. Even protected storage can be removed by explicit browser cleanup,
uninstallation, device loss, or platform policy. Keep independent full backups.
Offline downloads can also fail because of insufficient space, disabled browser
storage, authentication, or an unreachable host; the status panel exposes failure
and allows retry. Never clear site data to repair an update.

## Validation

Run `npm run test:offline`, `npm run test:release-cache`, lint, type checking, and
the public build/verifier. Tests cover interrupted or mismatched installation,
offline routing and setup references, release isolation, cache ownership,
reconnection/retry, installation events, and denied storage protection.

After `npm run build:public`, run
`node --experimental-strip-types tests/offline-browser-fixture.mjs`. This serves
synthetic releases at `http://localhost:4326` with separate storage from the daily
app. Choose `A`, `broken-B`, or `B` in `work/offline-qa/control.json`. Never use
personal data in this fixture.

Browser regression sequence:

1. Open A's homepage, verify install eligibility and offline readiness. Confirm
   that the homepage did not open IndexedDB.
2. Disconnect the network. Open the app, complete setup, save a synthetic
   transaction, and reload. Verify the saved record and reference rates.
3. Reconnect. Keep two app windows open and leave an unsaved form in one.
   Serve broken-B and check for updates. Confirm A and its data still work.
4. Serve B and check again. Confirm B is waiting, both windows still execute A,
   and the draft is unchanged. A new window must also execute A.
5. Save or discard the draft. Close all fixture windows, reopen offline, and
   verify B, saved records, and cleanup of only owned obsolete caches.
6. Check English/Farsi, keyboard dismissal/focus return, narrow/wide layouts,
   and large text. Test actual OS installation, standalone relaunch, suspended
   app recovery, and storage behavior on each target platform before claiming
   device coverage.

Physical Android/iOS devices, Safari, and Edge need their own checks; Chromium
device-size emulation is not equivalent to them. Keep hosted verification results
with the deployment operator's release and rollback records.

Shared-core verification on 2026-10-17 used Chrome with isolated synthetic
origins and the rebuilt personal installation. The full failed/waiting/offline
update sequence was repeated on 2026-10-18, including exact preservation of all
seven stores and an unrelated cache. The personal installation also activated
the final release normally with unchanged stores. Viewport checks covered 320,
390 and 1440 px with large text in English/Persian; the earlier pass included 768 px.

| Check | Result |
| --- | --- |
| Native installation prompt becomes available | Earlier desktop check passed; prompt not repeated for the shared-core build; OS installation remains unverified |
| Homepage leaves IndexedDB unopened; app setup works offline with saved references | Passed |
| Offline transaction save, reload, and cold launch with server stopped | Passed |
| Damaged update rejected; complete update waits across two windows and a new window | Passed |
| Unsaved form survives; saved stores unchanged after activation | Passed |
| Owned obsolete caches removed; unrelated cache preserved | Passed |
| Clean first download and manual update check finish without a stuck status | Passed |
| English/Farsi layouts, large text, form validation, keyboard save, and nested Escape | Passed in Chrome |
| Personal update through normal waiting activation | Passed; all seven stores matched the pre-update fingerprints |
| Android/iPhone installation, offline use, and update checklist | Maintainer reported working on 2026-10-18; phone/browser versions and per-step evidence not recorded |
| Safari/Edge independent installation and lifecycle coverage | Pending separate browser checks |

The automated lifecycle/worker/integrity checks supplement these browser tests.
The packed core also renders both views in an independent consumer. These checks
do not establish physical-device coverage or guarantee browser storage retention.

The maintainer's phone report is separate from automated and emulated checks. The
logo-hold sound works on Android. After reporting silence in the installed app,
Safari and Chrome on iPhone, the maintainer confirmed playback after turning Silent
Mode off, removing the installed app, and reopening in Safari/Chrome. Those
simultaneous changes do not isolate the cause; no playback patch was shipped.
Web Audio on iPhone normally respects Silent Mode: check that mode, media volume,
and a normal close/reopen first. Do not clear records or reinstall to diagnose
this Easter egg; removal can erase device-local records. Keep full backups.

Hosted desktop Chrome checks on 2026-10-18 passed anonymous first download,
homepage storage isolation, setup, synthetic transaction persistence, reload with
network requests blocked, and V2 backup export/restore with all seven stores.
English/Persian homepage checks included desktop and 390 px viewport emulation.
Release identity and evidence locations belong to those deployment records.

The 0.11.6 Install UI was checked in isolated Chrome contexts on 2026-10-18:
English/Persian at 320, 390, and 1440 px, large text, resizing an open dialog,
nested Escape/focus restoration, visible check progress/completion, offline
status, and a reload with network requests blocked. Synthetic financial stores
were unchanged, and the fresh homepage opened no IndexedDB. Prompt-event doubles
verified the conditional button and cancellation; native OS installation remains
unverified. Automated lifecycle tests also cover prompt failure and download completion.

Standards and platform references:

- [Service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing)
- [Fetch integrity](https://developer.mozilla.org/en-US/docs/Web/API/Request/integrity)
- [Storage persistence](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- [iPhone web apps](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios)

The cached release also contains the legacy `/about/` compatibility redirect,
both platform manifests, and Android
shortcut icons. Installation artwork updates may require the platform's normal
refresh or re-adding a shortcut; never clear browser data to refresh an icon.
