
def compress(data):
    out = ""
    codebook = [(0, 0, "")] * 255
    i = 0
    def score ((j, n, c)):
        return (j - i) * 2 + n * 4 + len(c) * 7
    def insert (e):
        for j in range(255):
            if score(e) > score(codebook[j]):
                codebook.insert(j, e)
                break
    while i < len(data):
        t = data[i:]
        k = 255 # entry
        l = 0   # length
        for j in range(255):
            (_, _, c) = codebook[j]
            if t.startswith(c) and len(c) > l and len(c) + i < len(data):
                k = j
                l = len(c)
        out += chr(k) + t[l]

        if k < 255: # "Upgrade" entry in codebook
            (_, n, c) = codebook[k]
            del codebook[k]
            insert((i, n + 1, c))

        insert((i, 1, t[:l + 1])) # insert this entry
        codebook.pop() # remove entry with lowest score

        i += l + 1
    return out
