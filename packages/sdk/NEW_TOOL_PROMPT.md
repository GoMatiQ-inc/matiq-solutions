# Prompt for a new MatiQ Solutions tool

Build [TOOL NAME]: [PURPOSE AND REQUIRED WORKFLOWS]. Use the current qualified MatiQ Solutions desktop SDK, not the Go MatiQ platform feature SDK.

Start with the smallest useful end-to-end prototype. Keep one renderer and implementation in the tool’s own repository. Reuse the exact shared standalone and Solutions shells, brand assets, compact hosted toolbar, launcher and unified settings. Use short tool names (Canvas, Voice), without repeating MatiQ. Tool pages belong in the top toolbar; use a gear for settings. Hosted settings belong in the tool’s section of Solutions Settings. Never copy the tool implementation into the suite repo.

Create a repository-owned prototype if missing, register it in the existing Solutions prototype and show both standalone and hosted views. Save prototype source and reproduction steps in Git; keep exports and machine-local paths ignored. Simulate native operations in the prototype bridge. Wait for my explicit approval before applying the design or implementing production behavior. Feedback is not approval. An explicit implementation instruction for the reviewed design is approval; do not ask again.

Build quickly and simply:
- Inspect the relevant existing SDK example and tool code once. State a short plan with concrete acceptance checks, then build. Do not turn setup into a research project or write an exhaustive plan before a usable slice exists.
- Implement ONE complete workflow at a time. Make the first workflow usable before expanding to the rest. For a capture tool: start → capture one meaningful action → stop → save → reopen.
- Reproduce a defect with the smallest relevant test. Fix and rerun that test until it passes, then run the affected regression group. Use fast headless tests for logic and renderer work; use the existing native VM/CI only for OS-dependent behavior.
- Do not sign, notarize, rebuild installers or run the whole browser/platform/export matrix for every small edit. Debug before packaging. Reuse verified dependencies, browser installs and unchanged candidate artifacts; a changed product requires a new candidate, not relabelled old evidence.
- A targeted native test runs only the app, browser and fixtures it needs. Do not make a Stop test unpack unrelated browsers or export PDFs first. Run independent work while an existing build runs; do not start duplicate builds.
- Once a coherent slice is green, run its packaged standalone and suite check. After all required slices pass, run the full required release qualification on the final source/artifacts. Retain unaffected evidence only when its source and artifact inputs are unchanged.
- No speculative abstractions, optional AI, new infrastructure, unrelated refactors, repeated audits or cosmetic expansion. Use existing release/test helpers. Add only what the requested workflow needs.
- Test proportional to risk: real persistence, lifecycle, integration and failure behavior matter; avoid tests that merely mirror styling or implementation. Stop repeating a passing check unless a relevant input changed.
- Keep a brief status of working behavior, current failure, next check and actual elapsed time. Give evidence-based estimates; flag deadline risk promptly. Never invent a multi-day estimate or silently drop requirements to meet a deadline.

Keep core operation and data local, installation opt-in, and updates limited to installed tools. Use the SDK’s trusted packaging and lifecycle; preserve busy work, project data and permissions. Follow existing host placement, storage, credential and service-lifecycle rules without inventing extra approval gates. Never replace native qualification with mock success.

Deliver the working prototype first. After approval, deliver the real standalone app and suite package from the same implementation, required test evidence and exact remaining blockers. Preserve the source and reusable prototype in the repository. Do not claim completion from scaffolding or a signed build alone.
