# Solutions UI prototype

This is the repository-owned source of the reviewed suite prototype: compact logo, full-width workspace, installed-app launcher, simple home, marketplace table and per-app management overview. It is a draft, not an approved change to the installed desktop application.

`tools.json` stores repository references only. Tool renderer implementations stay in their own repositories. `tools.local.json` maps those references to local checkouts and is ignored. The SDK exports renderer files into ignored `.prototype/` artifacts, just as a release packages code; these are not maintained source copies.

For each tool checkout, run `matiq-tool prototype build --suite <this-checkout> --shell <this-checkout>/packages/shell`. A missing tool prototype is initialized with `prototype init`. Creating a new tool with `matiq-tool create <directory> --suite <this-checkout>` creates its draft prototype and registers/builds the Solutions preview automatically. Set `MATIQ_SOLUTIONS_PROTOTYPE` to reuse the same local suite checkout.

To rebuild every registered prototype, run `matiq-tool prototype suite` from this repository. Serve the generated `.prototype/` directory through your approved preview service. `index.html` presents the suite; each tool has standalone and hosted modes. The exact shared desktop shell is copied from the pinned shell package. The prototype uses the tool's real HTML/CSS/renderer source and an explicitly declared simulated desktop bridge. Voice overrides only the generated capture module; original source remains untouched.

The published private review supplies durable comments, decisions, visible save errors and feedback export. The generic local export has an integration event for that host and does not pretend to save comments. Do not commit private review URLs, machine paths, credentials or user profiles.

After reviewing both modes, obtain explicit owner approval before implementation. `prototype approve` records the actual instruction and hashes the renderer, prototype bridge, manifest and shared shell. Changes invalidate approval. The SDK's packaging commands and new-tool start/package scripts reject missing or stale approval. These workflow checks do not establish human identity or replace repository review. The current suite design, Voice prototype and Companion prototype remain drafts.
