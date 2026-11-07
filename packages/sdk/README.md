# MatiQ tool SDK

A tool owns one repository. Its adapter is used by both its standalone Electron app and the MatiQ Solutions host. The suite repository stores marketplace metadata and shared packages; it does not contain tool implementation source.

## Create a tool

Install the SDK tarball from the matching `sdk-v<VERSION>` GitHub release, then run:

```sh
matiq-tool create my-canvas --id com.matiq.canvas --name "MatiQ Canvas"
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
