from pathlib import Path
from sys import argv
from image import image_lsb_encode, image_lsb_decode
from audio import audio_lsb_encode, audio_lsb_decode
from text import text_encode, text_decode


def usage():
    print(f"""\
Usage: {argv[0]} [OPTIONS] MEDIUM_FILE SECRET_FILE OUTPUT_FILE

Options:
  --help  Show this message and exit.
""")


IMAGE_SUFFIXES = [".png", ".bmp", ".jpg", ".jpeg"]
AUDIO_SUFFIXES = [
    ".wav",
    ".wave",
]  # ".flac"]



def get_steganography_kind_from_medium_file(medium_file: Path):
    if medium_file.suffix.lower() == ".txt":
        return "TEXT"
    elif medium_file.suffix.lower() in IMAGE_SUFFIXES:
        return "IMAGE"
    elif medium_file.suffix.lower() in AUDIO_SUFFIXES:
        return "AUDIO"
    return None


def encode(medium_file: Path, secret_file: Path, output_file: Path):
    if not medium_file.is_file():
        raise FileNotFoundError(f"Medium file {medium_file} doesn't exist")
    if str(output_file) != "-" and output_file.exists():
        raise FileExistsError(f"Output file {output_file} already exists")
    if str(secret_file) != "-" and not Path(secret_file).is_file():
        raise FileNotFoundError(f"Secret file {secret_file} doesn't exist")

    kind = get_steganography_kind_from_medium_file(medium_file)
    if kind is None:
        raise ValueError(f"Medium file {medium_file} is not of valid format")

    match kind:
        case "TEXT":
            text_encode(medium_file, secret_file, output_file)
        case "IMAGE":
            image_lsb_encode(medium_file, secret_file, output_file)
        case "AUDIO":
            audio_lsb_encode(medium_file, secret_file, output_file)


def decode(medium_file: Path, output_file: Path):
    if not medium_file.is_file():
        raise FileNotFoundError(f"Medium file {medium_file} doesn't exist")
    if str(output_file) != "-" and output_file.exists():
        raise FileExistsError(f"Output file {output_file} already exists")
    kind = get_steganography_kind_from_medium_file(medium_file)
    if kind is None:
        raise ValueError(f"Medium file {medium_file} is not of valid format")

    match kind:
        case "TEXT":
            text_decode(medium_file, output_file)
        case "IMAGE":
            image_lsb_decode(medium_file, output_file)
        case "AUDIO":
            audio_lsb_decode(medium_file, output_file)


def main():
    match argv:
        case [_, medium_file, secret_file, output_file]:
            encode(Path(medium_file), Path(secret_file), Path(output_file))
        case [_, medium_file, output_file]:
            decode(Path(medium_file), Path(output_file))
        case _:
            usage()
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
