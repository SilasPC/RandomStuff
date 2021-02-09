from util import depad


def unsplit(pieces,n):
    out = ''
    for piece in pieces:
        piece = depad(piece)
        if piece is None:
            return
        out += piece
    return out

def split(data, n):
    out = [''] * n
    sz = (len(data) + n - 1) // n
    i = 0
    for j in xrange(n):
        out[j] = data[i : i + sz]
        i += sz

    # PKCS#5 padding to make all pieces same size
    for j in xrange(n):
        p = sz - len(out[j]) + 1
        out[j] += chr(p) * p

    return out