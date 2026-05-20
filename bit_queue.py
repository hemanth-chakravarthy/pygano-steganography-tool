from collections.abc import Iterable


class BitQueue:
    def __init__(self, iterable: Iterable[int] = ()):
        self.buf: bytearray = bytearray(iterable)
        self.l: int = 0
        self.r: int = 8 * len(self.buf)

    def __len__(self) -> int:
        return self.r - self.l

    def __repr__(self) -> str:
        return self.buf.__repr__()

    def _defragment(self):
        pass

    def clear(self):
        self.buf.clear()
        self.l = 0
        self.r = 0

    def extend(self, bits: int, count: int):
        for shift in range(count - 1, -1, -1):
            if self.r // 8 >= len(self.buf):
                self.buf.append(0)
            self.buf[self.r // 8] |= (bits >> shift & 1) << (7 - self.r % 8)
            self.r += 1

    def pop(self, count: int = 1) -> int:
        assert self.r - self.l >= count, "Not enough bits in the buffer"
        accumulator = 0
        for _ in range(count):
            accumulator <<= 1
            accumulator |= self.buf[self.l // 8] >> (7 - self.l % 8) & 1
            self.l += 1
        return accumulator
