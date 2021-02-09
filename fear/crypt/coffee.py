
import struct
import hashlib
from util import depad

"""
Padded data is divided into 8 byte chunks which interpreted as two ints
Each chunk is repeatedly transformed a bunch in a reversible fashion
"""

def encrypt(data, password):
    # PKCS#5 padding
    padding = -len(data) % 8
    if not padding:
        padding = 8
    data += chr(padding) * padding

    key = struct.unpack('!IIII', hashlib.sha1(password).digest()[:16])

    out = ''
    for i in xrange(0, len(data), 8):
        msg = list(struct.unpack('!II', data[i : i + 8]))
        s = 0

        for _ in xrange(32):
            s = (s + 0x9e3779b9) & 0xffffffff
            msg[0] = (msg[0] + \
                      (((msg[1] << 4) + key[0]) ^ \
                       ( msg[1] +            s) ^ \
                       ((msg[1] >> 5) + key[2])
                       )
                      ) & 0xffffffff
            msg[1] = (msg[1] + \
                      (((msg[0] << 4) + key[1]) ^ \
                       ( msg[0]       + s     ) ^ \
                       ((msg[0] >> 5) + key[3])
                       )
                      ) & 0xffffffff

        out += struct.pack('!II', *msg)

    return out


def decrypt(data, psw):
    
    key = struct.unpack('!IIII', hashlib.sha1(psw).digest()[:16])
    pln = ''

    for i in xrange(0, len(data), 8):
        msg = list(struct.unpack('!II', data[i:i+8]))
        s = 3337565984
        for _ in xrange(32):

            msg[1] = (msg[1] - \
                      (((msg[0] << 4) + key[1]) ^ \
                       ( msg[0]       + s     ) ^ \
                       ((msg[0] >> 5) + key[3])
                       )
                      )
            if msg[1] < 0:
                msg[1] += 0x100000000
            msg[1] &= 0xffffffff

            msg[0] = (msg[0] - \
                      (((msg[1] << 4) + key[0]) ^ \
                       ( msg[1] +            s) ^ \
                       ((msg[1] >> 5) + key[2])
                       )
                      )
            if msg[0] < 0:
                msg[0] += 0x100000000
            msg[0] &= 0xffffffff

            s -= 0x9e3779b9
            if s < 0:
                s += 0x100000000
            s &= 0xffffffff

        assert(s == 0)
        pln += struct.pack('!II', *msg)
    
    return depad(pln)
