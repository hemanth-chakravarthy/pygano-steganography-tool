from lsb import lsb_encode_sized, lsb_decode_sized
from PIL import Image
from pathlib import Path
from itertools import chain, batched

# Supported formats
SUPPORTED_INPUT_FORMATS = {"PNG", "BMP", "TIFF", "GIF", "JPEG", "MPO"}
SUPPORTED_OUTPUT_FORMATS = {"PNG", "BMP", "TIFF"}
LSB_COUNT = 2


def image_lsb_encode(medium_file: Path, secret_file: Path, output_file: Path):
    with Image.open(medium_file) as medium_image, open(
        0 if str(secret_file) == "-" else secret_file, "rb"
    ) as secret_file:
        if medium_image.format not in SUPPORTED_INPUT_FORMATS:
            raise ValueError(f"Unsupported input image format: {medium_image.format}")
        if medium_image.mode not in {"RGB", "RGBA"}:
            raise ValueError(f"Unsupported image mode: {medium_image.mode}")

        if str(output_file) != "-":
            output_suffix = output_file.suffix.lower()
            output_format = Image.registered_extensions().get(output_suffix)
            if output_format not in SUPPORTED_OUTPUT_FORMATS:
                raise ValueError(
                    f"Unsupported or lossy output image format: {output_suffix}. "
                    "Steganography requires a lossless output format (such as PNG or BMP) to preserve the hidden bits."
                )

        medium_image = medium_image.convert("RGB")
        image_data = list(chain.from_iterable(medium_image.getdata()))
        assert len(image_data) == medium_image.width * medium_image.height * 3
        secret_data = secret_file.read()
        lsb_encode_sized(image_data, secret_data, count=LSB_COUNT)
        assert len(image_data) == medium_image.width * medium_image.height * 3

        with Image.new(medium_image.mode, medium_image.size) as output_image:
            output_image.putdata(list(batched(image_data, 3)))
            with open(1 if str(output_file) == "-" else output_file, "wb") as f:
                if str(output_file) == "-":
                    output_image.save(f, format="PNG")
                else:
                    output_image.save(f)


def image_lsb_decode(medium_file: Path, output_file: Path):
    with Image.open(medium_file) as medium_image, open(
        1 if str(output_file) == "-" else output_file, "wb"
    ) as output_file:
        if medium_image.format not in SUPPORTED_INPUT_FORMATS:
            raise ValueError(f"Unsupported image format: {medium_image.format}")
        if medium_image.mode not in {"RGB"}:
            raise ValueError(f"Unsupported image mode: {medium_image.mode}")

        image_data = list(chain.from_iterable(medium_image.getdata()))
        secret = lsb_decode_sized(image_data, count=LSB_COUNT)
        secret_data = secret.buf
        output_file.write(secret_data)
