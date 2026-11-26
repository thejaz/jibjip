# @jibjip/core

The complete JIBJIP local-first application, including its default introduction,
finance workspace, English/Persian interface, browser persistence, Clarity,
backup/CSV support, and approved offline assets. MIT licensed, except the JIBJIP name, logo, and sound (see the repository's
`TRADEMARKS.md`). The package is not published to npm; build it from this repository.

```ts
import { mountJibjip } from "@jibjip/core";
import "@jibjip/core/style.css";

const unmount = await mountJibjip({
  container: document.getElementById("root")!,
  view: "application",
  profile: "public",
});
// Call unmount() when the host removes this view.
```

Views are `introduction` and `application`. Profiles are `development`,
`personal`, and `public`. Choose the profile explicitly before persistence loads;
a document cannot switch profiles. Development uses its separate empty database.
Personal and public use origin-bound `mwatch-local-v1` with reference-only setup.

Use one mount per container and await its result. Importing the package does not
open IndexedDB. The introduction loads without financial initialization.
Application startup, setup, and existing preferences remain owned by the core.

The host serves the package's `assets/` at its origin root, including the starter
at `/data/jibjip-starter-seed.json`, and supplies `/` and `/app/` entries. It copies
the package license to `/LICENSE.txt` and stamps the service-worker integrity
manifest after building **all** JavaScript/CSS chunks. The workspace's browser
shell is the reference implementation. Keep these paths when consuming a packed
release. Local assets and reference data are not a personal database.

Build with the root `build:core` command. A local `npm pack ./packages/core`
produces a reviewable archive; it does not publish. Consumers supply the declared
React peers. Use the public mounting, stylesheet, and asset exports; internal
modules are not a supported external API. See the repository documentation for
the complete product, offline, and version contracts.
