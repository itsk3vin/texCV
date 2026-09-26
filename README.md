# TexCV

A private, local-only LaTeX workspace for editing one-page resumes. It combines a
file explorer, a CodeMirror LaTeX editor, and a live US Letter PDF preview in one
browser window.

## Requirements

- macOS and Node.js 20 or newer
- [Tectonic](https://tectonic-typesetting.github.io/) for PDF compilation

```sh
brew install tectonic
```

## Install and run

```sh
npm install
npm run build
npm link
texcv /path/to/resume-folder
```

During development, use `npm run dev -- /path/to/resume-folder`. The editor binds
only to `127.0.0.1`; resume content is read and written directly in the selected
folder.

## Desktop app

Run the Electron desktop app locally and choose a workspace folder when prompted:

```sh
npm run desktop
```

You can also pass a workspace directly with `npm run desktop -- /path/to/resume-folder`.
Create an unpacked macOS application with `npm run pack:mac`, or create `.dmg` and
`.zip` release artifacts with `npm run dist:mac`.

For public distribution, install a Developer ID Application certificate in the
macOS keychain and provide Apple notarization credentials through either
`APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`, or a stored
`APPLE_KEYCHAIN_PROFILE`. electron-builder signs the app automatically when it
finds the certificate and notarizes it when those credentials are present.

## Keyboard shortcuts

- `Cmd-S`: save and compile
- `Cmd-Enter`: compile
- `Cmd-P`: focus the file explorer
- `Cmd-B`: collapse or expand the file explorer

New or unfamiliar LaTeX packages may be downloaded by Tectonic and cached on the
machine. The editor itself has no cloud service, accounts, analytics, or telemetry.
