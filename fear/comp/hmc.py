
def hmc(data):

    def bits(x, n):
        out = []
        for _ in xrange(n):
            out.append(x & 1)
            x >>= 1
        if x:
            die('Too few bits')
        return out

    def vlq(x):
        octets = []
        while True:
            x, y = divmod(x, 0x80)
            octets.append(bits(y, 7))
            if not x:
                break
        out = []
        for o in reversed(octets[1:]):
            out += o + [1]
        out += octets[0] + [0]
        return out
    maxsym = max(data)
    size = 1
    while 2**size <= maxsym:
        size += 1

    freqs = defaultdict(int)
    for sym in data:
        freqs[sym] += 1

    heap = [(wt, sym) for sym, wt in freqs.items()]
    heapify(heap)

    while len(heap) > 1:
        ka, va = heappop(heap)
        kb, vb = heappop(heap)
        kc = ka + kb
        vc = (va, vb)
        heappush(heap, (kc, vc))

    root = heap[0][1]
    codebook = {}

    def encode(x, p=[]):
        if isinstance(x, tuple):
            return [0] + encode(x[0], p + [0]) + encode(x[1], p + [1])
        codebook[x] = p
        return [1] + bits(x, size)

    bs = vlq(size) + encode(root)

    if len(codebook) == 1:
        bs += vlq(len(data))
    else:
        for sym in data:
            bs += codebook[sym]

    padding = -len(bs)%8
    bs = vlq(padding) + bs + [0] * padding

    out = ''
    for i in xrange(0, len(bs), 8):
        n = 0
        for j in xrange(8):
            b = bs[i + 7 - j]
            n <<= 1
            n |= b
        out += chr(n)
    return out

def compress(data):
    return hmc(map(ord, data))