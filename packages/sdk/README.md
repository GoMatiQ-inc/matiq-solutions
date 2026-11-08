# MatiQ tool SDK

A tool owns one repository. Its adapter is used by both its standalone Electron app and the MatiQ Solutions host. The suite repository stores marketplace metadata and shared packages; it does not contain tool implementation source.

## Create a tool

Install the SDK tarball from the matching `sdk-v<VERSION>` GitHub release, then run:

```sh
matiq-tool create my-canvas --id com.matiq.canvas --name "Canvas"
cd my-canvas
npm install
npm start
```

Use Node 22.12 or newer for the SDK CLI and build tooling. Generated repositories include the MatiQ source-available license and package it with the standalone app. Generated package dependencies use immutable versioned GitHub release tarballs. The generated document example saves locally and refuses to close over unsaved edits. Replace its workspace and adapter in this repository. The SDK release must exist before installing a scaffold's dependencies.

## Adapter contract

Export `activate(host)` from the manifest's adapter. It returns an instance with async `status()` and `dispose()`, plus optional `onVisibility(visible)`. See `index.d.ts`.

- Load the manifest's workspace into `host.view.webContents`. Use `host.window` only as the parent for native dialogs. The suite's window contains other tools.
- Register renderer commands through `host.handle(channel, handler)`; the runtime verifies the sender and local workspace. Choose a unique tool-prefixed channel.
- Save projects/settings under `host.dataDir` or an explicitly user-selected project directory. Preserve these on uninstall. Use `host.sharedModelRoot` when supplied; ask before downloading models.
- Return `busy: true` during recordings, inference, downloads, pending approvals, persistent writes and unsaved user edits. `reason` tells the user how to finish.
- `dispose()` must stop and await owned workers, hooks, timers and native windows. If cleanup fails, throw an actionable error. The host keeps the tool open for retry.
- `host.close()` schedules a close after the current command returns; it acknowledges a request rather than guaranteeing closure. Busy checks still apply.
- Hiding a view must preserve active work. `background: true` keeps the host alive when its main window is closed.
- Renderer permissions are denied by default. Adapters retain their own scoped OS/project approval flow. Capabilities in the manifest describe requirements; installing does not grant OS access.

The first-party adapter runs in Electron's main process and is privileged. Package signatures establish trust in its publisher; they are not a sandbox for untrusted third-party main-process code. Renderers remain sandboxed with context isolation.

## Release the same implementation twice

1. Set the package and tool manifest to the same release version. Pin the qualified Electron runtime. Build, sign, notarize and test the standalone app through its repository's native CI.
2. Package its already built resources:

```sh
matiq-tool pack-app --resources "/path/to/App.app/Contents/Resources" \
  --target darwin-arm64 --output tool-darwin-arm64.mqt \
  --url https://github.com/OWNER/REPO/releases/download/v1.0.0/tool-darwin-arm64.mqt
```

Use `--extra engine,native` for additional resource directories outside `app.asar`. Supply `MATIQ_TOOL_SIGNING_KEY` only through the protected release signing environment. The SDK extracts `app.asar` with its unpacked native files, verifies the app version, preserves native file bytes, narrows the manifest to the actual target, signs the tool inventory, and writes `<output>.release.json` with signed download metadata.

3. Test the signed package inside the suite on its native OS. Upload both files to the same immutable tool release only after acceptance passes. Register its repository in the marketplace registry; future tool releases update metadata without copying tool source or rebuilding the shell.
4. The marketplace verifies metadata and packages. Users explicitly install new tools. Updates apply only to installed IDs and remain staged until a safe restart. Permission increases require another review; incompatible data versions are rejected until a migration has been qualified.

`matiq-tool pack` packages explicitly included source directories for development fixtures and tools without external/native resources. Native releases should use `pack-app`.


## Shared native release identity

The shell package supplies the company wordmark, fonts and native app icons. Scaffolds reference those package assets rather than maintaining another copy. Hosted tool navigation keeps functional setup and settings controls visible.

For company Mac releases, use `withMacKeychain` from `@matiq-solutions/sdk/mac-keychain.cjs` and call `withNotaryProfile` from `@matiq-solutions/sdk/notary-profile.cjs` inside its operation. Build configuration is validated before entering the credential wrappers. The existing P12 credentials are imported into a temporary keychain; notarization uses a short-lived profile in that same keychain. Passwords travel through protected stdin/secure terminal prompts, not command arguments. Both wrappers restore their environment in `finally`, and the outer wrapper removes the temporary keychain. DMG/ZIP callers pass `{requireInstaller:false}`; PKG callers retain the default requirement for both identities. These are release-time helpers, not end-user runtime requirements.

## Prototype-first workflow (SDK 0.1.5)

Use the MatiQ Solutions desktop SDK, not the separate Go MatiQ platform feature SDK. A new tool starts as a repository-owned draft prototype. Reuse the exact shared standalone shell and hosted shell; use real renderer source with a simulated desktop bridge. Never duplicate maintained tool UI in the suite repository.

```sh
matiq-tool create my-canvas --id com.matiq.canvas --name "Canvas" --suite ../matiq-solutions
# Existing tool without a prototype:
matiq-tool prototype init --suite ../matiq-solutions
# Rebuild this tool and the suite preview after an edit:
matiq-tool prototype build --suite ../matiq-solutions
# After explicit owner approval of both standalone and hosted views only:
matiq-tool prototype approve --by "Owner" --approval-text "Actual explicit owner instruction"
matiq-tool prototype check
```

Set `MATIQ_SOLUTIONS_PROTOTYPE` to the local suite checkout instead of repeating `--suite`. Without a suite checkout, create still makes a draft prototype; registration remains required before approval. `prototype/manifest.json`, `bridge.js`, explicit mock module overrides and the approval record belong in the tool repo. `prototype/tools.json` belongs in the suite and contains repository metadata only; local checkout paths and generated `.prototype/` output are ignored. `prototype build --suite` automatically registers the tool and rebuilds the suite artifact. Do not commit export copies.

Feedback is not permission to implement. Only record approval after the owner explicitly requests application of the reviewed design. Changed renderer, bridge, manifest or shared-shell files invalidate that approval. `pack` and `pack-app`, and the generated tool's prestart/prepackage checks, require current approval. This is an auditable workflow gate, not an identity or authorization service. Existing signed releases remain unchanged. Browser prototype tests do not qualify native capture, inference, installers or OS grants.

### Prompt for a new tool build

Use [NEW_TOOL_PROMPT.md](NEW_TOOL_PROMPT.md), replacing the tool name, purpose and required workflows. It requires fast vertical slices, focused regressions before packaging, and full final qualification without repeating unrelated checks during debugging.

### Compact suite navigation (SDK 0.1.6)

The suite owns the compact top bar, installed-app launcher and unified Solutions Settings tabs. Tool names in that bar omit the MatiQ prefix. Keep native page buttons inside `.sidebar nav`; the suite connects those existing controls to its top bar. Mark non-sidebar controls with `data-matiq-nav`. Mark the tool’s settings control `data-matiq-settings` (existing `data-page="settings"`, `#settings-nav` and Settings-labelled sidebar buttons remain compatible). Page buttons should reflect selection with `.active` or `aria-current="page"`. Do not create a second tool UI or replace its narrow IPC API. The shell’s `navigation.cjs` validates navigation indices and invokes only existing controls. Hosted gear navigation opens the real settings page inside the tool’s Solutions Settings section. Tools without settings receive an explicit empty state. Standalone shell behavior stays available for independent use.

SDK 0.1.5 also adds the generated-output and local-registration ignore rules automatically for new and initialized tools, and protects the suite’s local checkout map. Existing approved source and prototype bridges are not overwritten. Use the same explicit shared-shell path when building/checking an existing tool against a different installed shell version. CI packaging must restore the matching registered suite checkout before checking an existing approval; never synthesize an owner approval in CI.
