from bit_queue import BitQueue
from pathlib import Path

CHARMAP = "\u200b\u200c\u200d\u2063"


def text_encode(medium_file: Path, secret_file: Path, output_file: Path):
    with open(medium_file) as medium_file, open(
        0 if str(secret_file) == "-" else secret_file, "rb"
    ) as secret_file:
        medium_data = medium_file.read()
        secret_data = secret_file.read()

    print_idx = -1
    for i, c in enumerate(medium_data):
        if c.isprintable():
            print_idx = i
            break
    else:
        raise ValueError("Medium file doesn't contain any printable characters")

    before, after = medium_data[: print_idx + 1], medium_data[print_idx + 1 :]
    q = BitQueue(secret_data)
    while len(q):
        char_idx = q.pop(2)
        before += CHARMAP[char_idx]

    with open(1 if str(output_file) == "-" else output_file, "w") as f:
        f.write(before + after)


def text_decode(medium_file: Path, output_file: Path):
    medium_data = medium_file.read_text()
    idxs = [CHARMAP.index(c) for c in medium_data if c in CHARMAP]
    q = BitQueue()
    for idx in idxs:
        q.extend(idx, 2)
    with open(1 if str(output_file) == "-" else output_file, "wb") as f:
        f.write(q.buf)
