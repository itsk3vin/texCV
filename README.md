# ResTeX

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
tex-editor /path/to/resume-folder
```

During development, use `npm run dev -- /path/to/resume-folder`. The editor binds
only to `127.0.0.1`; resume content is read and written directly in the selected
folder.

## Keyboard shortcuts

- `Cmd-S`: save and compile
- `Cmd-Enter`: compile
- `Cmd-P`: focus the file explorer
- `Cmd-B`: collapse or expand the file explorer

New or unfamiliar LaTeX packages may be downloaded by Tectonic and cached on the
machine. The editor itself has no cloud service, accounts, analytics, or telemetry.
