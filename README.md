# pygano

`pygano` is an ensemble steganography tool that hides secret files inside common media formats using **Least Significant Bit (LSB)** and **Unicode zero-width space (ZWSP)** steganography.

It ships with a **100% client-side web interface** — no server, no uploads, complete privacy — deployed live at:

> **🔗 [https://pygano-steganography-tool-6l33.vercel.app/](https://pygano-steganography-tool-6l33.vercel.app/)**

---

## Features

- **Multi-Format Support**:
  - 🖼️ **Images**: Hide secrets in PNG, BMP, JPG/JPEG, TIFF, GIF containers.
  - 🔊 **Audio**: Hide secrets in WAV/WAVE audio files.
  - 📝 **Plain Text**: Hide secrets inside `.txt` files using invisible zero-width Unicode characters (ZWSP).
- **Web Interface**: Fully serverless browser-based UI — drag & drop files, encode, and download your stego output, all without leaving your browser.
- **Auto File-Type Detection**: Automatically detects the container type (image, audio, text) when you drop a file — no manual selection required.
- **Real-Time Capacity Gauge**: Shows how much of the container's steganographic capacity your secret payload uses.
- **Python CLI**: Command-line interface with support for `stdin`/`stdout` piping for use in encryption pipelines.
- **Security Hardened**: Input validation, Content Security Policy, and buffer boundary checks throughout.

---

## Web Interface (Recommended)

### Live Demo
> **[https://pygano-steganography-tool-6l33.vercel.app/](https://pygano-steganography-tool-6l33.vercel.app/)**

No installation required. Open the link and use it directly in your browser.

### Run Locally

1. Clone the repository and serve it with Python's built-in HTTP server:
   ```bash
   git clone https://github.com/hemanth-chakravarthy/pygano-steganography-tool.git
   cd pygano-steganography-tool
   python -m http.server 8000
   ```
2. Open your browser and navigate to [http://localhost:8000](http://localhost:8000).

### How to Use the Web Interface

**Encode (Hide a Secret)**
1. Drop or click to upload your **container file** (image, audio, or text). The file type is auto-detected.
2. Choose your secret — type a **text message** directly, or upload any **secret file**.
3. Watch the **capacity bar** to ensure your secret fits inside the container.
4. Click **Encode & Download Container** — the stego file is downloaded directly to your device.

**Decode (Extract a Secret)**
1. Switch to the **Decode** tab.
2. Drop or upload the stego container file. The file type is auto-detected.
3. Click **Extract & Decode Secret** — the decoded payload is shown on screen or downloaded.

> [!NOTE]
> All processing happens entirely in your browser using the HTML5 Canvas, Web Audio, and File APIs. Your files are never uploaded to any server.

---

## Python CLI

### Prerequisites
- Python 3.12 or newer.

### Installation

1. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   ```

2. **Activate the virtual environment**:
   - **Windows (PowerShell)**: `.\.venv\Scripts\Activate.ps1`
   - **Windows (CMD)**: `.\.venv\Scripts\activate.bat`
   - **Linux/macOS**: `source .venv/bin/activate`

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

### Encoding (Hiding a Secret)

```bash
python pygano.py <medium_file> <secret_file> <output_file>
```

> [!WARNING]
> If using a JPEG/JPG image as the **input** container, the **output** must be saved as a lossless format (`.png` or `.bmp`). Saving as JPEG re-compresses the image and destroys the hidden LSB data.

**Examples:**
```bash
# Hide a secret in a PNG image
python pygano.py cover.png secret.txt stego.png

# Hide a secret in a JPEG (save output as PNG)
python pygano.py photo.jpg secret.txt stego.png

# Hide a secret in a WAV audio file
python pygano.py song.wav secret.txt stego.wav

# Hide a secret in a text file
python pygano.py cover.txt secret.txt stego.txt
```

### Decoding (Extracting a Secret)

```bash
python pygano.py <stego_file> <output_file>
```

**Examples:**
```bash
python pygano.py stego.png extracted.txt
python pygano.py stego.wav extracted.txt
python pygano.py stego.txt extracted.txt
```

### Piping (Advanced)

Use `-` as a file path to read from `stdin` or write to `stdout`. This enables chaining with encryption tools:

```bash
# Encrypt and hide in one pipeline
age -e -r <recipient-key> secret.txt | python pygano.py cover.png - stego.png

# Extract and decrypt in one pipeline
python pygano.py stego.png - | age -d -i key.txt
```

---

## Project Structure

| File | Description |
|---|---|
| `index.html` | Web interface layout |
| `index.css` | Web interface styles (monochrome light theme) |
| `index.js` | Client-side steganography engine (BitQueue, LSB, ZWSP, WAV parser) |
| `pygano.py` | Python CLI entry point |
| `image.py` | Image LSB steganography via Pillow |
| `audio.py` | Audio LSB steganography for WAV files |
| `text.py` | Text ZWSP steganography |
| `lsb.py` | LSB encode/decode utility functions |
| `bit_queue.py` | Custom bit-stream helper class |
| `vercel.json` | Vercel static deployment configuration |

---

## Deployment

The web interface is deployed as a **static site on Vercel**.

To deploy your own fork:
1. Push to GitHub.
2. Import the repository into [Vercel](https://vercel.com).
3. Vercel will use `vercel.json` to correctly detect the project as a static site (bypassing Python auto-detection).

---

## Roadmap

- [x] `BitQueue` data-structure for uniform binary I/O
- [x] Image LSB steganography for lossless formats
- [x] JPEG input support (lossless PNG/BMP output enforced)
- [x] Audio LSB steganography for WAV format
- [x] Plain text steganography using ZWSP Unicode characters
- [x] stdin/stdout piping support
- [x] Serverless client-side web interface
- [x] Auto file-type detection in the web UI
- [x] Security hardening (CSP, input validation, proper error handling)
- [x] Vercel deployment
- [ ] Support other lossless audio formats (FLAC)
- [ ] Support more lossless image formats
