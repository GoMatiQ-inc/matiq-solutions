# Validation

## Foundation slice — November 6, 2026

- 17 Node contract/security tests pass: package signatures, exact hash inventory, untrusted publisher, wrong target, unsafe paths/symlinks/collisions, installed-only updates, staged activation, compatible recovery, schema/capability gates, data preservation, changed installed files, filesystem failure, partial-extraction recovery and catalog-consent races.
- A bounded Linux Electron journey generates a tool outside this source repository, packages/signs it with a disposable fixture identity, explicitly installs it through Marketplace, saves a local document, stages an update, manually restarts into it and verifies retained data, then uninstalls while preserving that document. It also rejects close/uninstall during unsaved editing. Owned processes and captured listeners are independently verified absent in finally cleanup.
- Source was independently reviewed for documented standards/security and specification behavior. Findings were corrected with regression coverage. Fixture identities are not production signing identities.

## Remaining qualification

The journey above does not yet prove the actual Restart control or signed whole-app replacement. Native signed external-package loading, native inference/capture/input, actual standalone/suite Voice and Companion behavior, supported target installers and Mac installed-app acceptance remain unqualified. Do not infer native support from Linux fixtures or this source inspection.


## SDK delivery and ownership qualification

The current foundation has 26 contract tests. Added checks bind packaged application manifests to the suite package, preserve signed native resource bytes and executable flags, reject output overwrite, authenticate independent release descriptors, and serialize per-tool ownership across hosts. A dead-process ownership record can be recovered; damaged records and abandoned recovery mutexes fail visibly.

The SDK archives are produced by `node scripts/package-sdk.cjs <output-directory>`. Shared dependencies and generated repositories use versioned GitHub release archives, not an unpublished npm namespace. Publication runs native foundation qualification before attaching archives to an `sdk-v*` prerelease. The protected `catalog-signing` environment publishes only signed metadata on the separate `catalog` branch, following each registered tool's latest stable release every six hours. No tool source is fetched by catalog generation.

The Linux desktop journey passed after the ownership and shared-shell changes, including generated standalone and hosted workspace behavior. This journey still uses an explicit harness relaunch; it does not qualify the installed application's Restart control or a real release-feed app update. Those remain release acceptance requirements, along with actual Voice/Companion standalone ownership participation and native package loading.
