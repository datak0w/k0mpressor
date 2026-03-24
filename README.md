# K0mpressor

Cyberpunk-style batch image compressor and resizer for the web.  
Drop a large set of images, convert them to one or many target formats/sizes, and download everything as a ZIP.

## Features

- Drag and drop multiple images (or use file picker)
- Batch resize to common web dimensions
- Keep aspect ratio option (letterbox background color supported)
- Output formats: `JPEG`, `WEBP`, `PNG`
- Quality/optimization control for compressed formats
- Live upload preview grid
- Social bundle export:
  - Select multiple social presets at once
  - Export grouped by folders in ZIP
  - Includes `1080x1080` standard version in social mode
- Futuristic/cyberpunk UI, fully client-side

## Tech Stack

- Vanilla `HTML`, `CSS`, `JavaScript` (no framework)
- [`JSZip`](https://github.com/Stuk/jszip) for ZIP generation
- Browser `canvas` API for image processing

## Project Structure

```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Run Locally

You can open `index.html` directly, but using a local server is recommended.

### Option 1: Python

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Option 2: Node (serve)

```bash
npx serve .
```

## Deploy to Netlify

This is a static app, so deployment is straightforward:

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site -> Import an existing project**.
3. Select this repository.
4. Use these settings:
   - Build command: *(leave empty)*
   - Publish directory: `.`
5. Deploy.

No server, no environment variables required.

## Usage

1. Upload images with drag-and-drop.
2. Choose output format, size, and options.
3. (Optional) Enable **Social Bundle Export** and select social presets.
4. Click **Convert and download ZIP**.

## Notes

- All processing happens in the browser (client-side).
- Large batches may consume significant RAM depending on image count/resolution.
- Browser support depends on `createImageBitmap`, `canvas`, and Blob APIs.

## Roadmap Ideas

- Progress details per file
- Custom naming patterns
- Save/load preset profiles
- Optional Web Worker processing for smoother UI in huge batches

---

Made with neon pixels and compression energy.
