# pygano

`pygano` is a Python-based ensemble steganography tool that allows you to hide secret files inside common medium formats (images, audio files, and text) using Least Significant Bit (LSB) and Unicode steganography.

---

## Features

- **Multi-Format Support**:
  - **Images**: Hide secrets in images (`.png`, `.bmp`, `.jpg`, `.jpeg`, `.tiff`, `.gif`).
  - **Audio**: Hide secrets in WAVE audio files (`.wav`, `.wave`).
  - **Plain Text**: Hide text secrets in other text files (`.txt`) using zero-width spaces (ZWSP) Unicode characters.
- **Pipelining**: Support for reading from `stdin` and writing to `stdout` by using `-` as a file path.
- **Uniform binary I/O** powered by a custom `BitQueue` implementation.

---

## Installation

### Prerequisites
- Python 3.12 or newer.

### Setting Up a Virtual Environment (Recommended)

1. **Create a virtual environment**:
   ```powershell
   python -m venv .venv
   ```

2. **Activate the virtual environment**:
   * **Windows (PowerShell)**:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   * **Windows (CMD)**:
     ```cmd
     .\.venv\Scripts\activate.bat
     ```
   * **Linux/macOS**:
     ```bash
     source .venv/bin/activate
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

---

## Usage Guide

The tool determines the type of steganography automatically based on the file extension of the medium container file.

### 1. Encoding (Hiding a Secret)

To hide a secret file within a medium file, run the command with three arguments:
```bash
python pygano.py <medium_file> <secret_file> <output_file>
```

#### Important note on JPEG images:
> [!WARNING]
> While you can use a lossy image format (like `.jpg` or `.jpeg`) as the **input** medium container, you must save the **output** file in a **lossless** format (like `.png` or `.bmp`). Saving the output as a JPEG will run compression on the image and corrupt your hidden data.

#### Examples:
* **Hiding a text file in a Wave Audio file**:
  ```bash
  python pygano.py data/song.wav data/secret.txt output_song.wav
  ```
* **Hiding a file in a JPEG (saving to lossless PNG)**:
  ```bash
  python pygano.py input.jpg secret.txt stego_image.png
  ```
* **Hiding text in a text file**:
  ```bash
  python pygano.py cover.txt secret.txt stego_text.txt
  ```

---

### 2. Decoding (Extracting a Secret)

To extract a hidden secret from a medium container, run the command with two arguments:
```bash
python pygano.py <medium_file_with_secret> <output_secret_file>
```

#### Examples:
* **Extracting a secret from a Wave Audio file**:
  ```bash
  python pygano.py output_song.wav extracted_secret.txt
  ```
* **Extracting a secret from a PNG image**:
  ```bash
  python pygano.py stego_image.png extracted_secret.txt
  ```
* **Extracting a secret from a text file**:
  ```bash
  python pygano.py stego_text.txt extracted_secret.txt
  ```

---

## Advanced Usage (Piping & Encryption)

Since `pygano` supports standard streams via the `-` argument, you can easily combine it with other terminal utilities for compression or encryption.

### Piping Encrypted Data with `age`

* **Encoding an encrypted secret**:
  ```bash
  age -e -r age1f0muf5szgy3z0y5yddhq7c5af6sl3djupa0xhkurnk2mugzvxdus47qczf data/secret.txt | python pygano.py data/magic.png - stego_magic.png
  ```
* **Decoding and decrypting**:
  ```bash
  python pygano.py stego_magic.png - | age -d -i data/age_key.txt
  ```

### Archiving, Compressing, Encrypting, and Hiding

* **Encoding multiple files**:
  ```bash
  tar cvz data/secret.txt data/text_medium.txt | age -e -r age1f0muf5szgy3z0y5yddhq7c5af6sl3djupa0xhkurnk2mugzvxdus47qczf | python pygano.py data/magic.png - stego_magic.png
  ```
* **Decoding and extracting files**:
  ```bash
  python pygano.py stego_magic.png - | age -d -i data/age_key.txt | tar xvz -C /tmp/
  ```

---

## Project Structure

- **[pygano.py](file:///d:/pygano/pygano.py)**: The main command-line entry point. Handles arguments and dispatches tasks.
- **[image.py](file:///d:/pygano/image.py)**: Image-based LSB steganography implementation using `Pillow`.
- **[audio.py](file:///d:/pygano/audio.py)**: Audio-based LSB steganography implementation for WAVE files.
- **[text.py](file:///d:/pygano/text.py)**: Text-based steganography using zero-width space characters.
- **[lsb.py](file:///d:/pygano/lsb.py)**: Utility functions for encoding/decoding bits into bytes.
- **[bit_queue.py](file:///d:/pygano/bit_queue.py)**: A custom binary/bit stream helper class.

---

## Roadmap

- [x] `BitQueue` data-structure for uniform binary I/O
- [x] Image LSB steganography for lossless formats
- [x] Audio LSB steganography for WAVE format
- [x] Plain text steganography using ZWSP, zero-width space, Unicode characters
- [x] Support reading and writing from and to stdin and stdout if `-` is provided as path
- [x] Test pipelining
- [ ] Support other lossless audio formats
- [ ] Support more uncommon lossless image formats
- [ ] Support lossy audio and image formats
