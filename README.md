# Nebula AI Place

Nebula AI Place is a local-first desktop AI workspace built with Electron and Ollama. It keeps chats and generated projects on your machine, can write project files, preview coding activity, and open the project folder directly from the app.

## Preview

<img width="3004" height="1600" alt="ray-so-export" src="https://github.com/user-attachments/assets/fe2a7105-3bea-4cb4-9f56-50324b62b2ed" />


<img width="3839" height="2080" alt="Снимок экрана 2026-07-06 163654" src="https://github.com/user-attachments/assets/91562a8b-1b7c-4237-8a47-84742f9be9f0" />


## Features

- Local Ollama-based chat and coding assistant.
- Model catalog with downloadable Ollama models.
- Project folders stored in `~/NebulaProject`.
- Cross-platform desktop shell for Windows, macOS, and Linux.
- Dark and light themes with downloadable interface language packs.
- Optional Python package installation for generated Python projects.

## Requirements

- Node.js 18 or newer.
- npm.
- Ollama installed or available in `PATH`.

Nebula tries to start Ollama automatically. On Windows and Linux it can also attempt an automatic install. On macOS, install Ollama from the official app if it is not already available.

## Run

```bash
npm install
npm start
```

Windows users can also run:

```bat
start.cmd
```

macOS and Linux users can run:

```bash
./start.sh
```

## Development Checks

```bash
npm run check
```

## Data Locations

- App data: `~/.nebula-data`
- Generated projects: `~/NebulaProject`
- Optional bundled Ollama binary: `resources/ollama`

## Repository

This folder is ready to be used as a Git repository named `Nebula AI Place` locally. Add a remote when you are ready to publish it.
