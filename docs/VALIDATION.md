# Validation

## Published suite 0.1.0

[Signed qualification run 42323282074](https://github.com/GoMatiQ-inc/matiq-solutions/actions/runs/42323282074) passed natively on Apple Silicon and Intel. The exact source is `dd10eb0a1d424cb98836f7e808787be4e87a411e`. It verifies:

- Existing company Developer ID, hardened runtime, library validation, absence of debug entitlement, notarization, stapled ticket and Gatekeeper acceptance.
- Exact update ZIP/DMG hashes and the signature of the application extracted from the ZIP.
- Launching the actual packaged app with an isolated profile, empty library, Marketplace, Settings and no automatic tool installation.
- A real newer signed/notarized suite download, native bundle replacement, automatic same-user relaunch and correct native architecture.
- Retention of an installed SDK-generated tool, saved document and download preference. After observing the automatic native launch, a controlled launch of the exact replacement verifies its UI and reopens the retained document. These are separate observations in the receipt.
- Independent owned-process and loopback-listener absence before cleanup succeeds.

[Publication run 42326208369](https://github.com/GoMatiQ-inc/matiq-solutions/actions/runs/42326208369) published those exact qualified artifacts. It requires signing/upgrade qualification on both architectures and successful three-platform native checks on the identical source tree in merged history. It verifies artifact receipts, source/tag identity and the actual updater architecture selector before publishing a combined Mac feed. Downloads are immutable.

The signed Apple Silicon release has also passed installed-app launch, empty-library, live Marketplace metadata, Settings, normal quit/relaunch, saved-preference persistence and public update-feed checks on a physical Mac. Its public release checksum matches the installed source. This is shell acceptance; Voice and Companion installed-tool acceptance is still pending.

## SDK 0.1.3 and desktop foundation

[SDK publication 42325494686](https://github.com/GoMatiQ-inc/matiq-solutions/actions/runs/42325494686) passed native qualification before publishing immutable shared package archives. [Foundation checks 42326033587](https://github.com/GoMatiQ-inc/matiq-solutions/actions/runs/42326033587) pass 43 contract/helper/publication checks and desktop/package journeys on macOS, Windows and Linux.

Coverage includes signed inventories, untrusted publishers, wrong targets, unsafe paths/symlinks/collisions, unlisted installed files, exact catalog consent, capability/data-version gates, bounded HTTPS downloads, failed writes, interrupted extraction, installed-only updates, pending activation, compatible rollback and uninstall data preservation. Catalog signatures, expiry, replay floors and overlapping settings/refresh writes are checked.

The desktop journey generates a tool outside the suite repository and exercises explicit Marketplace installation, local document saves, unsaved-work close refusal, download cancellation, a staged tool update and the actual Restart control. A distinct automatically relaunched process activates the staged version and preserves the document. Failed activation/disposal retries, a closing renderer and edits arriving during asynchronous shutdown status checks have regression coverage.

A fresh consumer of the published SDK 0.1.3 archive generated an independent tool repository, installed its versioned dependencies, built and ran its standalone app, saved locally, packaged the actual native app resources, installed that same payload through Marketplace and saved inside the suite. The fixture publisher is ephemeral and is never trusted by production installations. The example remains a document starter; it does not implement a canvas product.

Per-tool ownership leases prevent updated standalone and suite hosts from owning the same tool concurrently. Dead owners can be recovered; malformed records and abandoned recovery mutexes fail visibly. Older standalone versions without this lease protocol cannot participate: update those standalone apps before testing concurrent ownership.

Signing helpers preserve Apple API-key and pre-imported identity workflows. Apple-ID notarization owns a separate disposable keychain; credentials remain outside command arguments. Cleanup tests inject an actual TERM-resistant child and a failed normal close, verify bounded owned-process cleanup, and ensure an exited app handle cannot adopt an unrelated reused PID.

## Tool delivery qualification

Tool implementation stays in each tool repository. `pack-app` consumes the already packaged standalone, including signed unpacked native files and declared extra resources. It binds app and tool manifest versions, preserves native bytes/modes, narrows the target and writes a signed release descriptor. Hosted qualification uses the suite's production publisher trust; publication binds its proof to exact package and descriptor hashes.

Companion has 30 passing unit checks. Actual-source hosted installation, Settings/model navigation, isolated project creation, real local inference, switching/reopening and host-owned update behavior pass on the Linux development VM. Its current four-platform native source matrix and signed native tool delivery are still running.

Voice has 60 passing unit checks. Its native Mac/Windows source matrix and signed native hosted qualification are still running. Synthetic microphone/system-audio, keyboard-protocol and OAuth-provider fixtures do not establish real microphone, physical-key, live-call or real provider-consent acceptance. Native speech/speaker inference uses real models and WAV fixtures. Linux Voice native engines are unsupported and excluded from its tool targets.

The full build goal remains active until the actual released Voice and Companion payloads install and operate in the installed suite, their standalone applications are qualified, and task-owned temporary resources are cleaned up. Do not infer native platform support from another platform's fixtures.

## Reproduction

Use Node >=22.12 and the repository lockfile. Run `npm ci`, `npm test`, `npm run test:desktop`, `npm run package:dir` and `npm run test:packaged` on the intended OS; Linux desktop tests require an X server. Native signing and real updater qualification run only through the protected release workflow. Default-profile upgrade fixtures are restricted to fresh disposable GitHub-hosted Macs.

SDK archives come from `node scripts/package-sdk.cjs <output-directory>` and use versioned GitHub dependencies. The protected main-only catalog workflow signs metadata on the separate `catalog` branch every six hours or on demand, following registered repositories' latest stable tool releases. It never fetches tool source. Users explicitly install new tools; compatible updates apply only to installed IDs and activate after a safe restart.
