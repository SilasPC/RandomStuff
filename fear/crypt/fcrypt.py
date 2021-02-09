
import os
import struct
import hashlib
from util import depad

"""
8 byte chunks manipulated with IV
"""

def rot(x, n):
    return ((x << n) | x >> (32 - n)) & 0xffffffff
def rotinv(x, n):
    return ((x >> n) | x << (32 - n)) & 0xffffffff
def f(x):
    return (0xb819 - (0x47e6 ^ rot(x, 17))) & 0xffffffff

def encrypt(data, password):

    # PKCS#5 padding
    padding = -len(data) % 8
    if not padding:
        padding = 8
    data += chr(padding) * padding

    IV  = struct.unpack('II', os.urandom(8))
    key = struct.unpack('!II', hashlib.sha1(password).digest()[:8])

    # Write IV
    out = struct.pack('!II', *IV)

    for i in xrange(0, len(data), 8):
        msg = list(struct.unpack('!II', data[i : i + 8]))

        # Add IV
        msg[0] ^= IV[0]
        msg[1] ^= IV[1]

        # Add key
        msg[0] ^= key[0]
        msg[1] ^= key[1]

        # Mix
        msg[0] ^= f(msg[1])
        msg[1] ^= f(msg[0])

        # Add key
        msg[0] ^= f(key[0] ^ IV[0])
        msg[1] ^= f(key[1] ^ IV[1])

        # Output
        out += struct.pack('!II', *msg)

        # Update IV
        IV = msg

    return out

def decrypt(data, password):

    pln = ''
    key = struct.unpack('!II', hashlib.sha1(password).digest()[:8])

    for i in xrange(8, len(data), 8):
        msg = list(struct.unpack('!II', data[i : i + 8]))
        IV = list(struct.unpack('!II', data[i - 8 : i]))

        msg[1] ^= f(key[1] ^ IV[1])
        msg[0] ^= f(key[0] ^ IV[0])

        msg[1] ^= f(msg[0])
        msg[0] ^= f(msg[1])

        msg[1] ^= key[1]
        msg[0] ^= key[0]

        msg[1] ^= IV[1]
        msg[0] ^= IV[0]

        pln += struct.pack('!II', *msg)

    return depad(pln)
