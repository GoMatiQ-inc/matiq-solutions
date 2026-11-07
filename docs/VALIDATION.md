# Validation

## Foundation slice — November 6, 2026

- 17 Node contract/security tests pass: package signatures, exact hash inventory, untrusted publisher, wrong target, unsafe paths/symlinks/collisions, installed-only updates, staged activation, compatible recovery, schema/capability gates, data preservation, changed installed files, filesystem failure, partial-extraction recovery and catalog-consent races.
- A bounded Linux Electron journey generates a tool outside this source repository, packages/signs it with a disposable fixture identity, explicitly installs it through Marketplace, saves a local document, stages an update, manually restarts into it and verifies retained data, then uninstalls while preserving that document. It also rejects close/uninstall during unsaved editing. Owned processes and captured listeners are independently verified absent in finally cleanup.
- Source was independently reviewed for documented standards/security and specification behavior. Findings were corrected with regression coverage. Fixture identities are not production signing identities.

## Remaining qualification

The journey above does not yet prove the actual Restart control or signed whole-app replacement. Native signed external-package loading, native inference/capture/input, actual standalone/suite Voice and Companion behavior, supported target installers and Mac installed-app acceptance remain unqualified. Do not infer native support from Linux fixtures or this source inspection.


## SDK delivery and ownership qualification

The current foundation has 28 contract tests. Added checks bind packaged application manifests to the suite package, preserve signed native resource bytes and executable flags, reject output overwrite, authenticate independent release descriptors, and serialize per-tool ownership across hosts. A dead-process ownership record can be recovered; damaged records and abandoned recovery mutexes fail visibly.

The SDK archives are produced by `node scripts/package-sdk.cjs <output-directory>`. Shared dependencies and generated repositories use versioned GitHub release archives, not an unpublished npm namespace. Publication runs native foundation qualification before attaching archives to an `sdk-v*` prerelease. The protected `catalog-signing` environment publishes only signed metadata on the separate `catalog` branch, following each registered tool's latest stable release every six hours. No tool source is fetched by catalog generation.

The Linux desktop journey passed after the ownership and shared-shell changes, including generated standalone and hosted workspace behavior. The updated journey presses the real Restart control, observes a distinct automatically relaunched PID with the staged tool activated, then verifies owned processes and captured listeners have stopped. It also injects failed activation/disposal and a broken status renderer to verify cleanup retry. A deterministic two-tool regression preserves an edit made during another tool's asynchronous status check. A real release-feed app update, actual Voice/Companion standalone ownership participation, and native package loading remain release acceptance requirements.


## SDK 0.1.1 patch qualification

The generated standalone host now freezes editing before its final status snapshot and restores editing after a refused close. The desktop journey injects an edit between status collection and shutdown, verifies the window/document survive, then saves and closes normally. Generated repositories carry the intended source-available license. Archive tooling uses @electron/asar 4.3.1 with an explicit Node >=22.12 requirement; native file and manifest-binding checks remain green.


## Native release candidate work

The current candidate has 37 contract/helper tests. Added checks cover concurrent close requests and safe status while a renderer closes, temporary signing-keychain cleanup, notarization profile environment restoration, and password-free command arguments/diagnostics. Linux tests exercise the secure terminal prompt with a local fixture; the native Apple workflow must validate it against the real existing account.

The desktop journey additionally cancels an in-progress download without registering a tool, and overlaps a held preference write with a signed catalog refresh to preserve the latest replay-protection sequence. The packaged suite launches from a built app with an isolated standard user-data directory, empty library, marketplace and settings. Generic CI now packages and launches on each desktop runner. Signed Mac qualification uses existing company identities, verifies hardened runtime, library validation, notarization, Gatekeeper and exact ZIP hashes, and then runs the packaged journey. Actual signed runs, release-feed application upgrade, real signed Voice/Companion suite artifacts and final Mac mini acceptance remain required.
