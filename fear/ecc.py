
def ecc(pieces, n):
    ###
    ### Error correction using Reed-Solomon codes
    ###

    ##
    ## Field operations for F_{2^n}
    ## Elements are represented as polynomials over bits
    ##

    # Conway polynomials for F_{2^n} for n = 1..32.
    #  http://www.math.rwth-aachen.de/~Frank.Luebeck/data/ConwayPol/CP2.html
    Gs = {
        1: 3,
        2: 7,
        3: 11,
        4: 19,
        5: 37,
        6: 91,
        7: 131,
        8: 285,
        9: 529,
        10: 1135,
        11: 2053,
        12: 4331,
        13: 8219,
        14: 16553,
        15: 32821,
        16: 65581,
        17: 131081,
        18: 267267,
        19: 524327,
        20: 1050355,
        21: 2097253,
        22: 4202337,
        23: 8388641,
        24: 16901801,
        25: 33554757,
        26: 67126739,
        27: 134223533,
        28: 268443877,
        29: 536870917,
        30: 1073948847,
        31: 2147483657,
        32: 4295000729,
        }

    # Field order is 2**N
    N = 8

    # For debugging
    def str_poly(p):
        if p == 0:
            return '0'
        d = deg(p)
        sups = {'0': '⁰',
                '1': '¹',
                '2': '²',
                '3': '³',
                '4': '⁴',
                '5': '⁵',
                '6': '⁶',
                '7': '⁷',
                '8': '⁸',
                '9': '⁹',
                }
        def sup(n):
            return ''.join(sups[d] for d in str(n))
        out = []
        for i in range(d, 0, -1):
            if p & (1 << i):
                out.append('x' + sup(i))
        if p & 1:
            out.append('1')
        return ' + '.join(out)

    # Addition and subtractions is the same operation
    def add(x, y):
        return x ^ y
    sub = add

    # Multiply
    def mul(x, y):
        z = 0
        if y < x:
            x, y = y, x
        while x:
            if x & 1:
                z ^= y
            y <<= 1
            x >>= 1
        return polydiv(z, Gs[N])[1]

    # Polynomial degree
    def deg(x):
        d = -1
        while x:
            d += 1
            x >>= 1
        return d

    # Polynomial long division
    #  https://en.wikipedia.org/wiki/Polynomial_long_division
    def polydiv(x, y):
        if not y:
            raise ZeroDivisionError
        dx = deg(x)
        dy = deg(y)
        # y doesn't divide x
        if dy > dx:
            return 0, x
        z = 0
        # Align the leading terms
        y <<= dx - dy
        # For each term at least as large as y's leading term
        i = dx
        while i >= dy:
            z <<= 1
            # Subtract y
            if x & 1 << i:
                z |= 1
                x = sub(x, y)
            y >>= 1
            # Next term
            i -= 1
        return z, x

    # Extended Euclidean algorithm
    #  https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
    def egcd(a, b):
        if b == 0:
            return 1, 0
        q, r = polydiv(a, b)
        x, y = egcd(b, r)
        return y, sub(x, mul(q, y))

    # Inverse
    def inv(x):
        # By construction of Gs[N] we have gcd(x, Gs[N]) == 1
        return egcd(x, Gs[N])[0]

    # Division
    def div(x, y):
        return mul(x, inv(y))

    ##
    ## Matrix operations on matrices over F_{2^N}
    ##

    # Matrix dimension as (rows, columns)
    def dim(A):
        return len(A), len(A[0])

    def transpose(A):
        h, w = dim(A)
        return [[A[j][i] for j in xrange(h)] for i in xrange(w)]

    # Multiply by a vector, i.e returns t = A x v
    def mul_vec(A, v):
        return [reduce(add, map(mul, row, v)) for row in A]

    # Gauss-Jordan elimination
    #  https://en.wikipedia.org/wiki/Gaussian_elimination
    # In-place
    def gauss_jordan(A):
        i, j = 0, 0
        m, n = dim(A)
        for k in range(min(m, n)):
            # Find a row with pivot in column k
            for i in range(k, m):
                if A[i][k]:
                    # Found it
                    break
            else:
                # No row with pivot in column k, next please
                raise ValueError('Matrix is singular')
            # Swap rows
            A[i], A[k] = A[k], A[i]

            # Divide row k by pivot
            for j in range(k + 1, n):
                A[k][j] = div(A[k][j], A[k][k])
            # Pivot is now one
            A[k][k] = 1

            # Eliminate all other column k pivots
            for i in range(m):
                if i == k:
                    continue
                # Subtract (row i pivot) x (row k) from row i
                for j in range(k + 1, n):
                    A[i][j] = sub(A[i][j], mul(A[i][k], A[k][j]))
                # (Former) pivot now zero
                A[i][k] = 0
        return A

    # Find the inverse of a matrix using Gauss-Jordan elimination; see above
    def inverse(A):
        n, m = dim(A)
        if n != m:
            raise ValueError('Not a square matrix')
        # Append identity matrix
        for i, row in enumerate(A):
            row += [0] * n
            row[n + i] = 1
        # Find inverse
        gauss_jordan(A)
        # Discard now-identity matrix
        for row in A:
            row[:n] = []
        return A

    # For debugging
    def str_matrix(A):
        align = max(max(len(`cell`) for cell in row) for row in A)
        h, w = dim(A)
        pad = w * (align + 1) + 1
        out  = '.'
        hdr = '< %d x %d >' % (w, h)
        out += '-' * ((pad - len(hdr)) // 2)
        out += hdr
        out += '-' * ((pad - len(hdr) + 1) // 2)
        out += '.\n'
        for row in A:
            out += '| '
            for cell in row:
                out += `cell`.rjust(align) + ' '
            out += '|\n'
        out += '\''
        out += '-' * pad
        out += '\''
        return out

    ##
    ## Reed-Solomon encoding
    ##  https://en.wikipedia.org/wiki/Reed%E2%80%93Solomon_error_correction
    ##  http://web.mit.edu/~emin/Desktop/ref_to_emin/www.old/source_code/py_ecc
    ##

    # Generate encoder matrix for an RS code with block length n and message
    # length k
    def encoder_matrix(n, k, systematic=True):
        A = [[1] * k for _ in xrange(n)]
        for i in xrange(n):
            t = 1
            for j in xrange(k):
                A[i][j] = t
                t = mul(t, i)
        if systematic:
            A = transpose(A)
            A = gauss_jordan(A)
            A = transpose(A)
        return A

    # Given an encoder matrix, encoding is just vector multiplication
    def encode(A, msg):
        return mul_vec(A, msg)

    # Given a decoder matrix, decoding is the same
    decode = encode

    # Given n lists of byte values add k lists of redundancy.  The original
    # lists can be reconstructed from any n of the (n + k) new lists.  All the
    # lists must contain the same number of bytes.
    k = len(pieces)
    A = encoder_matrix(n, k)
    out = []
    for v in zip(*pieces):
        t = encode(A, map(ord, v))
        out.append(map(chr, t))
    x = [''.join(p) for p in zip(*out)]
    return [''.join(p) for p in zip(*out)]
