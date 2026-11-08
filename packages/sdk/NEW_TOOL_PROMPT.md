# Paste-ready prompt for a new MatiQ Solutions tool

Use everything I write after this prompt as the brief for a new MatiQ Solutions tool. Choose a sensible short name and repository name from that brief. Make reasonable implementation decisions and ask only when missing information genuinely blocks progress. Build only the requested scope.

Use the current qualified MatiQ Solutions desktop SDK. Start here: https://github.com/GoMatiQ-inc/matiq-solutions/blob/main/packages/sdk/README.md. This is the desktop SDK, not the Go MatiQ platform feature SDK.

Keep the tool in its own repository with ONE implementation that produces both a standalone app and an installable Solutions package. Never copy its implementation into the Solutions repository. Keep core processing and data local, with no required subscription or cloud account. Tools and models install only by explicit user choice. Use the existing marketplace and independent installed-tool update mechanisms; preserve user data and active work.

Prototype first. Reuse the exact current SDK standalone shell and Solutions shell, branding, compact navigation and unified settings. Use short app names without repeating MatiQ. Hosted app navigation belongs in the top bar; its gear opens that app’s section of Solutions Settings. Reuse the actual renderer with a simulated native bridge. Create or update the repository-owned prototype, register it in the existing Solutions prototype, and show me working standalone and hosted previews through the existing private review service. Save prototype source in Git and keep generated exports ignored. Wait for my explicit approval before applying the design or implementing production behavior. Feedback alone is not approval.

After approval, build in small, complete vertical slices. Make one useful workflow work end to end before expanding. Inspect relevant existing code and helpers, give a brief plan and acceptance checks, then execute. Avoid speculative abstractions, optional features, unrelated refactors and new infrastructure.

Debug quickly: reproduce each defect with the smallest relevant test, fix it, then run affected regressions. Use headless Linux tests for compatible work and the existing isolated native VM/CI for OS-specific checks. Targeted tests should run only their required fixtures and integrations. Reuse verified dependencies and unchanged artifacts. Do not repeatedly sign, notarize, rebuild installers or run unrelated browser/export/platform matrices while debugging small changes.

Package coherent passing slices. Once the requested workflows pass, complete required release qualification on the final artifacts in both standalone and suite forms. Do not skip required checks, reuse stale evidence for changed code, invent success or silently reduce scope. Keep updates concise: working behavior, current blocker and next check. Follow existing machine, storage, credential, service and release policies without inventing extra approval gates.

Deliver the prototype first. After approval, deliver the real app, suite package, source, reusable prototype, test evidence and exact remaining limitations. Finish authorized work through installation and verification on the agreed target. Do not declare completion from scaffolding, mocks or a signed build alone.

My tool brief follows:
