# JIBJIP direction and roadmap

## Product model

Maintain one complete open-source core for personal use and the official website.
It includes the interface, finance, reports, backups, localization, offline use,
and local Clarity. The personal installation adds private records/settings.
The website can later add an optional commercial layer consuming a pinned core
release. Core use remains account-free and independent of that service.

Core source is MIT licensed and publicly credited to THEJAZ. Financial data,
private notes, credentials, and private Git history never become public source.
Frontend code is inspectable in the browser; secrets belong outside it.

## Local shared-core foundation

The workspace separates the reusable application package from its thin browser
shell, uses one Vite frontend path, and maintains source/package/public privacy
checks. [ARCHITECTURE.md](ARCHITECTURE.md) owns the implementation map.
Acceptance requires package consumption, both builds, financial/Clarity/offline
regression checks, and verification of the everyday personal installation.

Keep source, package, and website candidates local. No remote, upload, deployment,
account, sync, payment, or online-reward work is authorized by this foundation.
Keep recorded verification distinct from pending physical-device/host checks.

## Public source

This repository is the shared home of the core. Its public history starts fresh
from the reviewed source; earlier private history is not published. Reviewed
improvements reach the website and personal installations through versioned
releases ([RELEASING.md](RELEASING.md)).

## Official website

Use the same tested core and a separately verified public artifact. Preserve the
permanent origin, homepage/app entries, legacy About redirect, reference-only starter, offline lifecycle,
backups, and rollback. The sole deployment identity and operational procedure
remain in the maintainer's private deployment guide, including the selected public/private
access setting, completed hosted checks, and remaining platform checks. A source update does
not establish a new hosted release.

## Optional commercial layer

Merchandise, support, paid sync, payment/crypto integrations, or gamification
services are possibilities, not committed implementations or prerequisites.
Choose a real service before creating a separate commercial project. Give it its
own release identity and pin the compatible core release. Keep a small backend
until measured traffic, latency, storage, or service requirements justify more.

Accounts and paid privileges require server-side authorization and payment
verification. Browser code and private repository visibility cannot protect a
frontend secret. Core finance remains usable when optional services are absent.

Sync needs its own consent, encryption/key recovery, conflict resolution, stable
IDs, decimal/rate-history fidelity, export/deletion/retention, and tested recovery
model before implementation. Do not introduce it just to connect installations.

Local Clarity is self-reported personal progress. Its clock/storage can be edited.
Competitive or redeemable points need independently verified eligibility and a
service-owned ledger; local totals cannot be converted into trusted rewards.
Financial records must not be uploaded merely to populate a leaderboard.

## Release readiness

- Shared core: coherent version, tests, reviewed diff, local runtime verification.
- Public source: privacy-checked commits and a build that CI reproduces from a clean clone.
- Website: authorized upload, hosted browser/offline/data checks, and rollback.
- Commercial services: explicit product/privacy decision, service tests, and measured capacity.

Record hosted browser checks separately from physical-device installation tests.
Only mark each check complete after performing it; keep measured limitations and
unresolved defects visible.
