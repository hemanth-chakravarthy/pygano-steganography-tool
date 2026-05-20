from collections.abc import MutableSequence
from bit_queue import BitQueue


def lsb_encode(medium: MutableSequence[int], secret: BitQueue, /, *, count: int):
    for i in range(len(medium)):
        if len(secret) == 0:
            break
        medium[i] &= ~((1 << count) - 1)
        medium[i] |= secret.pop(count)


def lsb_encode_sized(medium: MutableSequence[int], secret: bytes, /, *, count: int):
    size = len(secret) * 8
    queue = BitQueue(size.to_bytes(8, "big") + secret)
    lsb_encode(medium, queue, count=count)


def lsb_decode(medium: MutableSequence[int], /, *, count: int) -> BitQueue:
    secret = BitQueue()
    for i in range(len(medium)):
        secret.extend(medium[i] & (1 << count) - 1, count)
        medium[i] &= ~((1 << count) - 1)
    return secret


def lsb_decode_sized(medium: MutableSequence[int], /, *, count: int) -> BitQueue:
    size_bytes = 8 * 8 // count
    size_medium, medium = medium[:size_bytes], medium[size_bytes:]
    size_queue = lsb_decode(size_medium, count=count)
    size = size_queue.pop(8 * 8)

    secret = BitQueue()
    for i in range(len(medium)):
        secret.extend(medium[i] & (1 << count) - 1, count)
        medium[i] &= ~((1 << count) - 1)
        if len(secret) >= size:
            break
    return secret


def test():
    q = BitQueue()
    q.extend(0b101011111, 9)
    print(q)
    print(bin(q.pop(3)))
    print(bin(q.pop(3)))
    print(bin(q.pop(3)))

    secret = BitQueue([0x41, 0x42, 0x43, 0x42])
    original_secret = BitQueue([0x41, 0x42, 0x43, 0x42])
    print([f"{x:08b}" for x in [0x41, 0x42, 0x43, 0x42]])
    count = 2
    medium = bytearray(range(len(secret) // count))
    print(medium)
    lsb_encode(medium, secret, count=count)
    decoded_secret = lsb_decode(medium, count=count)
    print(medium)

    print(hex(original_secret.pop(len(original_secret))))
    print(hex(decoded_secret.pop(len(decoded_secret))))
