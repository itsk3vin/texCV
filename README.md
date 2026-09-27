# TexCV

A private, local-only macOS app for editing one-page resumes. It combines a file
explorer, a CodeMirror LaTeX editor, and a live US Letter PDF preview.

## Requirements

- macOS and Node.js 20 or newer
- [Tectonic](https://tectonic-typesetting.github.io/) for PDF compilation

```sh
brew install tectonic
```

## Development

```sh
npm install
npm run desktop
```

On first launch, TexCV creates and opens `~/Documents/TexCV`. It reopens the last
workspace after that; if the folder is no longer available, it falls back to the
managed Documents folder. Use File → Open Folder to choose a different workspace.
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
