# MatiQ Solutions

Read docs/ARCHITECTURE.md before changing the tool contract.

- Tools own their source in separate repositories. Never copy tool implementations into this repo.
- A fresh suite contains no tools or models. Browse metadata; install only on explicit action. Update installed IDs only.
- Trusted first-party tool packages must be signed and hash-verified before loading any code. Keep renderers sandboxed and validate IPC sender/frame.
- Local projects and models live outside application bundles. Preserve work on update/uninstall; block restart while tools are busy.
- Keep inference local and retain per-tool action approvals. No arbitrary shell or unrestricted file tools.
- Record actual packaged native checks; mocks or another OS do not qualify a platform.
- Never commit credentials, models, generated dependencies or native build output.

## Prototype first

Before implementing UI changes, create or update the repository-owned prototype with the Solutions desktop SDK. Use the exact shared shell and existing renderer source. Do not maintain duplicate tool UI in the suite repository. Register/build it into the Solutions prototype, review standalone and hosted modes, and wait for explicit owner approval before applying the design. Saved feedback alone is not approval. Keep mock desktop bridges under prototype/, native code unchanged, and generated output/local registration ignored.
