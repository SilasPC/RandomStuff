
import os

def noise(data):
    prev = os.urandom(20)
    out = prev
    for i in xrange(0, len(data), 20):
        this = data[i : i + 20]
        out += ''.join(chr(ord(a) ^ ord(b)) for a, b in zip(prev, this))
        prev = this
    return out

def unnoise(data):
    prev = data[:20]
    out = ''
    for i in xrange(20, len(data), 20):
        this = data[i : i + 20]
        old = ''.join(chr(ord(a) ^ ord(b)) for a, b in zip(prev, this))
        out += old
        prev = old
    return out
