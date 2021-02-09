
import hashlib

"""
Algorithm is symetrical, so this one is trivial
"""

def encrypt(data, password):
    S = map(ord, hashlib.sha256(password).digest())

    out = ''
    for c in data:
        out += chr(ord(c) ^ S.pop(0))
        S.append(S[7] ^ S[9] ^ S[13])

    return out

decrypt = encrypt