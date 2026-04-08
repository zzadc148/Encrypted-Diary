# Encrypted Diary

[中文 README](./README.md)

Encrypted Diary is a desktop diary application built with Electron, React, and TypeScript.

The project focuses on offline-first personal journaling with local encryption. Diary content stays on the machine and is protected with a key derived from a master password.

## Features

- Local-only storage by default
- Master-password verification based on PBKDF2
- AES-256-GCM encryption for diary content
- Encryption, decryption, and file I/O handled in the Electron main process
- React + Ant Design desktop UI
- Auto-save and manual save
- Full-text search
- Manual lock and idle auto-lock
- Windows packaging support
- Installer supports custom installation directory

## Tech Stack

- Electron
- React 18
- TypeScript
- Zustand
- Ant Design
- Vite
- Vitest

## Current Scope

The current repository includes the following implemented capabilities:

- First-run master password setup
- Unlock flow on subsequent launches
- Three-column layout: diary list, editor, and search results
- Create, view, edit, and save diary entries
- Menu shortcuts for core actions
- Auto-save behavior
- Search across saved diary content
- Main-process cache and auto-lock logic
- Unit tests and basic packaging configuration

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start development mode

Start the renderer dev server first:

```bash
npm run dev:renderer
```

Then compile and launch Electron:

```bash
npm run build:electron
npm start
```

## Common Commands

```bash
npm install
npm test
npm run build:electron
npm run dev:renderer
npm start
npm run build
```

Command summary:

- `npm test`: run unit tests
- `npm run build:electron`: compile the Electron main process
- `npm run dev:renderer`: start the Vite dev server
- `npm start`: launch the desktop app
- `npm run build`: create a production build and installer

## Packaging

Run:

```bash
npm run build
```

Build output is generated in:

- `release/win-unpacked/`
- `release/Encrypted Diary Setup <version>.exe`

The Windows installer is configured as an assisted installer and supports custom install paths.

## Data Storage

In the current version, data is stored in the user profile directory rather than in the installation directory.

On Windows, it is typically located at:

```text
C:\Users\<username>\AppData\Roaming\local-encrypted-diary\appData
```

Directory layout:

```text
appData/
├─ config.json
├─ index.json
└─ diaries/
   └─ {uuid}.enc
```

Notes:

- `config.json`: password-verification parameters
- `index.json`: diary index metadata
- `diaries/*.enc`: encrypted content for each entry

## Security Notes

The project currently follows these core boundaries:

- The renderer does not directly access filesystem or crypto APIs
- Encryption, decryption, and file operations run in the Electron main process
- `contextIsolation` is enabled
- `nodeIntegration` is disabled
- A limited API is exposed through `preload`
- The master password is not stored in plaintext
- Keys and caches are cleared when the vault is locked

This is not intended to be a hardened security product for high-adversary environments. It is better suited for personal local privacy than for defending against system-level compromise, admin access, or memory-dump attacks.

## Tests

Run tests with:

```bash
npm test
```

Current coverage includes:

- Encryption/decryption round trips
- Different IVs generating different ciphertext
- Decryption failure on modified `authTag`
- Decryption failure on tampered ciphertext
- Empty-text and long-text edge cases
- Master password verification
- Auto-lock behavior

## Project Structure

```text
.
├─ build/               # Installer customization scripts
├─ electron/            # Electron main process / preload / IPC
├─ src/
│  ├─ shared/           # Shared types, crypto, and search logic
│  ├─ store/            # Zustand store
│  ├─ types/            # Type declarations
│  ├─ App.tsx           # Main UI
│  └─ main.tsx          # Renderer entry
├─ tests/               # Vitest unit tests
├─ package.json
└─ README.md
```

## Development Notes

- In production, Electron loads the renderer through `file://`, so Vite is configured to emit relative asset paths
- If you change packaging, preload, or asset-loading behavior, run a full production build again
- Windows packaging is handled with `electron-builder`

## Repository Status

This repository is currently closer to a working prototype and engineering exercise than a fully polished end-user product. There is still room for expansion, for example:

- Better note organization
- Richer search and highlighting
- Stronger deletion and content-management workflows
- Better data migration and uninstall cleanup
- Smaller package size and better application assets

## Who This Is For

This project may be useful if you:

- want to learn Electron + React desktop development
- want a reference for basic local encrypted storage
- want to extend a journaling prototype into a fuller app

## License

This repository does not currently include a dedicated license file.

If you plan to publish it publicly or accept contributions, you should add an explicit `LICENSE` file, such as MIT.
