<img width="2163" height="727" alt="ChatGPT Image 7 июл  2026 г , 23_16_07" src="https://github.com/user-attachments/assets/6f2ba66e-8445-4505-951c-af582c8c8284" />

# Nevo AI Place

Nevo AI Place is a local-first desktop AI workspace built with Electron and Ollama. It keeps chats and generated projects on your machine, can write project files, preview coding activity, and open the project folder directly from the app.

## Preview

<img width="3444" height="1632" alt="ray-so-export (1)" src="https://github.com/user-attachments/assets/2339dca0-eba1-48c8-bc8d-76ef40f3efb6" />





<img width="3839" height="2090" alt="image" src="https://github.com/user-attachments/assets/2b706208-879a-4660-918e-57f15d60470f" />



## Features

- Local Ollama-based chat and coding assistant.
- Model catalog with downloadable Ollama models.
- Project folders stored in `~/NevoProject`.
- Cross-platform desktop shell for Windows, macOS, and Linux.
- Dark and light themes with downloadable interface language packs.
- Optional Python package installation for generated Python projects.

## Requirements

- Node.js 18 or newer.
- npm.
- Ollama installed or available in `PATH`.

Nevo tries to start Ollama automatically. On Windows and Linux it can also attempt an automatic install. On macOS, install Ollama from the official app if it is not already available.

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

- App data: `~/.nevo-data`
- Generated projects: `~/NevoProject`
- Optional bundled Ollama binary: `resources/ollama`

## Repository

This folder is ready to be used as a Git repository named `Nevo AI Place` locally. Add a remote when you are ready to publish it.
