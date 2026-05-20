from lsb import lsb_encode_sized, lsb_decode_sized
from pathlib import Path
import wave


def read_wave(file_path):
    with wave.open(file_path, "rb") as wave_read:
        params = wave_read.getparams()  # Retrieve audio parameters
        frames = wave_read.readframes(params.nframes)  # Read all frames
    return params, bytearray(frames)


def write_wave(file, params, frames):
    with wave.open(file) as wave_write:
        wave_write.setparams(params)  # Set parameters for the output file
        wave_write.writeframes(frames)  # Write frames


def audio_lsb_encode(medium_file: Path, secret_file: Path, output_file: Path):
    if medium_file.suffix.lower() not in {".wav", ".wave"}:
        raise ValueError("Only WAV audio files are supported")

    with open(0 if str(secret_file) == "-" else secret_file, "rb") as secret_file:
        secret_data = secret_file.read()

    params, frames = read_wave(str(medium_file))
    lsb_encode_sized(frames, secret_data, count=2)

    with open(1 if str(output_file) == "-" else output_file, "wb") as f:
        write_wave(f, params, frames)


def audio_lsb_decode(medium_file: Path, output_file: Path):
    if medium_file.suffix.lower() not in {".wav", ".wave"}:
        raise ValueError("Only WAV audio files are supported")

    params, frames = read_wave(str(medium_file))
    secret_queue = lsb_decode_sized(frames, count=2)
    secret_data = secret_queue.buf
    with open(1 if str(output_file) == "-" else output_file, "wb") as f:
        f.write(secret_data)
