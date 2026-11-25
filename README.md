<p><a href="https://matiqinc.com"><img src="https://raw.githubusercontent.com/GoMatiQ-inc/matiq-solutions/main/packages/shell/assets/matiq-solutions-wordmark-dark.png" alt="MatiQ Solutions, part of MatiQ Inc" width="220"></a></p>

# MatiQ Solutions

[MatiQ Inc](https://matiqinc.com) · [Downloads](https://github.com/GoMatiQ-inc/matiq-solutions/releases) · [Documentation](docs/VALIDATION.md) · [Report an issue](https://github.com/GoMatiQ-inc/matiq-solutions/issues) · [License](LICENSE)

A desktop home for local tools by MatiQ Inc. Browse the Marketplace, install only the tools you choose, and receive updates for those installed tools. Each tool remains maintained in its own repository and can also ship as a standalone application.

## Download

[Download the signed Mac suite](https://github.com/GoMatiQ-inc/matiq-solutions/releases/latest): choose arm64 for Apple Silicon or x64 for Intel, macOS 14.2 or later. Open the DMG and copy MatiQ Solutions to Applications. No compiler, Node installation or paid account is required to run it.

The suite starts with no tools installed. Browse Marketplace and install the tools you want. Models download separately when you choose them. Updates apply to installed tools; new marketplace tools are never installed automatically.

Voice and Companion native tool delivery is undergoing final qualification. See [validation](docs/VALIDATION.md) for exact evidence and remaining limits.

## Useful software. Made by MatiQ.

Choose the tools that fit your working day. Each project has its own source, downloads and license terms.

| Project | What it helps you do | Get started |
|---|---|---|
| [MatiQ Voice](https://github.com/GoMatiQ-inc/matiq-voice) | Dictate English text and capture local meeting notes. | [Downloads and supported platforms](https://github.com/GoMatiQ-inc/matiq-voice#download-and-install) |
| [MatiQ Companion](https://github.com/GoMatiQ-inc/matiq-companion) | Chat with a local model, work with documents and choose tool permissions for each conversation. | [Installation and current status](https://github.com/GoMatiQ-inc/matiq-companion#current-status) |
| [MatiQ CopyCat](https://github.com/GoMatiQ-inc/matiq-copycat) | Turn a desktop or browser workflow into an editable illustrated guide. | [Downloads and current limits](https://github.com/GoMatiQ-inc/matiq-copycat#matiq-copycat) |

Personal and internal business use are permitted under each project's No-Sale License. These are source-available projects, not OSI-approved open source. Model weights and third-party components keep their own terms. Check each release for the actual installers and supported platforms.

## Part of MatiQ Inc

**Progress has a purpose.** We build businesses and technology for a better quality of life. Solutions is the software part of a wider family: Technologies works on software, AI and data; Studio connects brand, websites and marketing; Academy provides practical AI training; Books Plus helps small businesses keep clear financial records.

[Explore MatiQ Inc](https://matiqinc.com) · [Talk with us](mailto:hello@matiqinc.com)

## Develop

Use Node 22.12 or later and npm. Run `npm install`, `npm test`, and `npm start`. The desktop integration journey is `npm run test:desktop`; Linux requires an X server (for example `xvfb-run -a npm run test:desktop`). It uses an isolated profile and verifies its owned child-process/listener cleanup.

## Tool ownership

The SDK creates a tool directory with a manifest, standalone entrypoint, reusable tool implementation, sandboxed renderer and packaging commands. Keep that directory in its own repository. Publish a standalone installer and signed suite package from the same source. The suite catalog contains release metadata; it never contains the tool implementation. See [architecture](docs/ARCHITECTURE.md).

## License

Source-available under the MatiQ Solutions No-Sale License. Personal and internal business use is permitted, including paid work products. Paid redistribution, hosted access and inclusion in paid software/subscription bundles are prohibited. This is not an OSI-approved open-source license. Third-party dependencies retain their own terms; MatiQ names and wordmarks remain MatiQ Inc trademarks.
