# MatiQ Solutions

A desktop home for local tools by MatiQ Inc. Browse the Marketplace, install only the tools you choose, and receive updates for those installed tools. Each tool remains maintained in its own repository and can also ship as a standalone application.

## Download

[Download the signed Mac suite](https://github.com/GoMatiQ-inc/matiq-solutions/releases/latest): choose arm64 for Apple Silicon or x64 for Intel, macOS 14.2 or later. Open the DMG and copy MatiQ Solutions to Applications. No compiler, Node installation or paid account is required to run it.

The suite starts with no tools installed. Browse Marketplace and install the tools you want. Models download separately when you choose them. Updates apply to installed tools; new marketplace tools are never installed automatically.

Voice and Companion native tool delivery is undergoing final qualification. See [validation](docs/VALIDATION.md) for exact evidence and remaining limits.

## Develop

Use Node 22.12 or later and npm. Run `npm install`, `npm test`, and `npm start`. The desktop integration journey is `npm run test:desktop`; Linux requires an X server (for example `xvfb-run -a npm run test:desktop`). It uses an isolated profile and verifies its owned child-process/listener cleanup.

## Tool ownership

The SDK creates a tool directory with a manifest, standalone entrypoint, reusable tool implementation, sandboxed renderer and packaging commands. Keep that directory in its own repository. Publish a standalone installer and signed suite package from the same source. The suite catalog contains release metadata; it never contains the tool implementation. See [architecture](docs/ARCHITECTURE.md).

## License

Source-available under the MatiQ Solutions No-Sale License. Personal and internal business use is permitted, including paid work products. Paid redistribution, hosted access and inclusion in paid software/subscription bundles are prohibited. This is not an OSI-approved open-source license. Third-party dependencies retain their own terms; MatiQ names and wordmarks remain MatiQ Inc trademarks.
