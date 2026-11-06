# Standalone tools and suite packages

The suite owns the shell, SDK, package verification/installation, Marketplace and host lifecycle. A tool's own repository owns its interface, behavior, workers and native resources. One tool release builds a standalone installer and a signed suite package from the same implementation. Catalog metadata points to immutable release assets; adding a conforming tool does not change suite runtime code.

A fresh suite has zero tools installed. Marketplace refresh fetches only metadata. Install is explicit; model downloads and OS grants remain separate choices. Update checks/downloads cover installed IDs only, with activation at an explicit safe restart.

Only reviewed first-party publisher-signed packages are supported. Trusted backend adapters may access main-process Electron; signatures and worker isolation are not a hostile-plugin sandbox. Tool renderers have isolated sessions, no Node integration and narrow checked IPC.

Executable packages, tool-private profiles and shared model artifacts are separate stores. Standalone profiles stay untouched; imports are explicit. Never activate old code against an incompatible migrated schema.

Build in order: signed native package proof; Companion vertical slice; Voice vertical slice; update/recovery and migration qualification; independent non-AI SDK template and release matrix. Tests must demonstrate interrupted/tampered installs preserve the active version, only installed tools update, and user work survives actual restart.
