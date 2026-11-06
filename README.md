# MatiQ Solutions

A desktop home for local tools by MatiQ Inc. Browse the Marketplace, install only the tools you choose, and receive updates for those installed tools. Each tool remains maintained in its own repository and can also ship as a standalone application.

## Development status

The foundation implements a shared shell, SDK scaffolder, authenticated tool packages, installed-tool registry and isolated tool workspaces. Native signed distribution and Voice/Companion integration are in progress; see [validation](docs/VALIDATION.md). This source is not a claim of completed customer qualification.

## Develop

Use Node 22 or later and npm. Run `npm install`, `npm test`, and `npm start`. The desktop integration journey is `npm run test:desktop`; Linux requires an X server (for example `xvfb-run -a npm run test:desktop`). It uses an isolated profile and verifies its owned child-process/listener cleanup.

## Tool ownership

The SDK creates a tool directory with a manifest, standalone entrypoint, reusable tool implementation, sandboxed renderer and packaging commands. Keep that directory in its own repository. Publish a standalone installer and signed suite package from the same source. The suite catalog contains release metadata; it never contains the tool implementation. See [architecture](docs/ARCHITECTURE.md).

## License

Source-available under the MatiQ Solutions No-Sale License. Personal and internal business use is permitted, including paid work products. Paid redistribution, hosted access and inclusion in paid software/subscription bundles are prohibited. This is not an OSI-approved open-source license. Third-party dependencies retain their own terms; MatiQ names and wordmarks remain MatiQ Inc trademarks.
