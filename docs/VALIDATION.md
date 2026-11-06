# Validation

## Foundation slice — November 6, 2026

- 17 Node contract/security tests pass: package signatures, exact hash inventory, untrusted publisher, wrong target, unsafe paths/symlinks/collisions, installed-only updates, staged activation, compatible recovery, schema/capability gates, data preservation, changed installed files, filesystem failure, partial-extraction recovery and catalog-consent races.
- A bounded Linux Electron journey generates a tool outside this source repository, packages/signs it with a disposable fixture identity, explicitly installs it through Marketplace, saves a local document, stages an update, manually restarts into it and verifies retained data, then uninstalls while preserving that document. It also rejects close/uninstall during unsaved editing. Owned processes and captured listeners are independently verified absent in finally cleanup.
- Source was independently reviewed for documented standards/security and specification behavior. Findings were corrected with regression coverage. Fixture identities are not production signing identities.

## Remaining qualification

The journey above does not yet prove the actual Restart control or signed whole-app replacement. Native signed external-package loading, native inference/capture/input, actual standalone/suite Voice and Companion behavior, supported target installers and Mac installed-app acceptance remain unqualified. Do not infer native support from Linux fixtures or this source inspection.
