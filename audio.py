from lsb import lsb_encode_sized, lsb_decode_sized
from pathlib import Path
import wave


def read_wave(file_path):
    with wave.open(file_path, "rb") as wave_read:
        params = wave_read.getparams()
        frames = wave_read.readframes(params.nframes)
    return params, bytearray(frames)


def write_wave(file, params, frames):
    with wave.open(file) as wave_write:
        wave_write.setparams(params)
        wave_write.writeframes(frames)


def _read_flac_samples(medium_file: Path):
    """Read a FLAC file and return flat integer sample list + metadata."""
    try:
        import soundfile as sf
    except ImportError:
        raise ImportError(
            "soundfile is required for FLAC support. "
            "Install it with: pip install soundfile"
        )
    data, samplerate = sf.read(str(medium_file), dtype="int16", always_2d=True)
    return data, samplerate


def _write_flac_samples(output_file: Path, data, samplerate):
    """Write a FLAC file from a numpy int16 array."""
    try:
        import soundfile as sf
    except ImportError:
        raise ImportError(
            "soundfile is required for FLAC support. "
            "Install it with: pip install soundfile"
        )
    sf.write(str(output_file), data, samplerate, subtype="PCM_16", format="FLAC")


def audio_lsb_encode(medium_file: Path, secret_file: Path, output_file: Path):
    ext = medium_file.suffix.lower()

    with open(0 if str(secret_file) == "-" else secret_file, "rb") as f:
        secret_data = f.read()

    if ext in {".wav", ".wave"}:
        params, frames = read_wave(str(medium_file))
        lsb_encode_sized(frames, secret_data, count=2)
        with open(1 if str(output_file) == "-" else output_file, "wb") as f:
            write_wave(f, params, frames)

    elif ext == ".flac":
        import numpy as np
        data, samplerate = _read_flac_samples(medium_file)
        flat = data.flatten().tolist()
        lsb_encode_sized(flat, secret_data, count=2)
        result = np.array(flat, dtype=np.int16).reshape(data.shape)
        _write_flac_samples(output_file, result, samplerate)

    else:
        raise ValueError(f"Unsupported audio format: {ext}. Supported: WAV, FLAC")


def audio_lsb_decode(medium_file: Path, output_file: Path):
    ext = medium_file.suffix.lower()

    if ext in {".wav", ".wave"}:
        params, frames = read_wave(str(medium_file))
        secret_queue = lsb_decode_sized(frames, count=2)
        secret_data = secret_queue.buf
        with open(1 if str(output_file) == "-" else output_file, "wb") as f:
            f.write(secret_data)

    elif ext == ".flac":
        data, _ = _read_flac_samples(medium_file)
        flat = data.flatten().tolist()
        secret_queue = lsb_decode_sized(flat, count=2)
        with open(1 if str(output_file) == "-" else output_file, "wb") as f:
            f.write(secret_queue.buf)

    else:
        raise ValueError(f"Unsupported audio format: {ext}. Supported: WAV, FLAC")
