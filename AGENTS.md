# MatiQ Solutions

Read docs/ARCHITECTURE.md before changing the tool contract.

- Tools own their source in separate repositories. Never copy tool implementations into this repo.
- A fresh suite contains no tools or models. Browse metadata; install only on explicit action. Update installed IDs only.
- Trusted first-party tool packages must be signed and hash-verified before loading any code. Keep renderers sandboxed and validate IPC sender/frame.
- Local projects and models live outside application bundles. Preserve work on update/uninstall; block restart while tools are busy.
- Keep inference local and retain per-tool action approvals. No arbitrary shell or unrestricted file tools.
- Record actual packaged native checks; mocks or another OS do not qualify a platform.
- Never commit credentials, models, generated dependencies or native build output.
