
import struct
from util import log, die, unimpl, crc32, MAGIC, VERSION, VERBOSE, bytesToStr
from pack import pack, unpack
from obf.noise import noise, unnoise
from obf.split import split, unsplit
import crypt
import comp

def hdrinfo(hdr):
    if hdr[:4] != MAGIC:
        return
    info = map(ord,hdr[4:16])
    return {
        'version': info[0],
        'compression': {
            0: None,
            1: ('zlib',comp.zlib.decompress),
            2: ('hmc',unimpl),
            3: ('bpk',unimpl),
            4: ('qed',unimpl)
        }[info[1]],
        'encryption': {
            0: None,
            1: ('coffee',crypt.coffee.decrypt),
            2: ('benc',crypt.benc.decrypt),
            3: ('fcrypt',crypt.fcrypt.decrypt)
        }[info[2]],
        'noise': info[3] != 0,
        'pieces': None if info[4] & 1 == 0 else info[4] >> 1
    }

def printinfo(path):
    cnt = file(path,'rb').read()
    info = hdrinfo(cnt[:24])
    def name(t):
        if t is not None:
            return t[0]
    print(
        """
Version:     %s
Compression: %s
Encryption:  %s
Noise:       %s
Pieces:      %s
        """ % (
            info['version'],
            name(info['compression']),
            name(info['encryption']),
            "Yes" if info['noise'] else "No",
            str(info['pieces'])
        )
    )    

if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser(
        description = 'FEAr',
    )

    p.add_argument(
        'src',
        metavar = '<path>',
        help = 'Source file or directory.',
    )

    p.add_argument(
        '--force', '-f',
        action = 'store_true',
        help = 'Overwrite when extracting.',
    )

    p.add_argument(
        '--outdir', '-o',
        metavar = '<path>',
        default = '.',
        help = 'Extract relative to <path>.  (default: .)',
    )

    p.add_argument(
        '--extract', '-x',
        metavar = '<path>',
        help = 'Extract archive.',
    )

    p.add_argument(
        '--create', '-c',
        metavar = '<path>',
        help = 'Create a new archive.',
    )

    p.add_argument(
        '--compress', '-z',
        nargs = '?',
        choices = ('zlib', 'hmc', 'bpk', 'qed'),
        help = 'Compress archive.  Optionally choose algorithm.  (default: '
        'zlib)',
        default = False,
    )

    p.add_argument(
        '--encrypt', '-e',
        nargs = '?',
        choices = ('coffee', 'benc', 'fcrypt'),
        help = 'Encrypt archive.  Optionally choose an algorithm.  (default: '
        'coffee)',
        default = False,
    )

    p.add_argument(
        '--noise',
        action = 'store_true',
        help = 'Make archive look like random data.',
    )

    p.add_argument(
        '--split',
        type = int,
        metavar = '<num>',
        help = 'Split archive into <num> files plus one file for metadata.',
    )


    p.add_argument(
        '--ecc',
        type = int,
        help = 'Use error correcting codes to protect against some data '
        'corruption.',
    )

    p.add_argument(
        '--password',
        help = 'Password used for encryption/decryption.',
    )

    p.add_argument(
        '--verbose', '-v',
        action = 'store_true',
        help = 'Enable verbose output.',
    )

    args = p.parse_args()
    if args.verbose:
        VERBOSE = True

    if args.extract:
        cnt = file(args.extract,'rb').read()
        info = hdrinfo(cnt[:24])

        if not info:
            die("Not a FEAr library")
        if info['version'] != VERSION:
            die("FEAr version mismatch")

        data = cnt[24:]

        if info['pieces']:
            n = info['pieces']
            log("Split: %d pieces" % n)
            pieces = []
            for i in xrange(n):
                ppath = "%s.%d" % (args.extract, i+1)
                pieces.append(file(ppath,'rb').read())
            data = unsplit(pieces,n)
            if data is None:
                die("Unsplitting failed")

        if info['noise']:
            log("Noise: Yes")
            data = unnoise(data)

        if info['encryption']:
            if not args.password:
                args.password = raw_input('Password: ')
            n, f = info['encryption']
            log("Encryption: %s" % n)
            data = f(data, args.password)
            if data is None:
                die("Decryption failed")

        if info['compression']:
            n, f = info['compression']
            log("Compression: %s" % n)
            data = f(data)
            if data is None:
                die("Decompression failed")

        log("Unpacking...")

        numFiles, numBytes = unpack(data, args.outdir or '.')

        log("Unpacked %d file(s) (%s)"
            % (numFiles, bytesToStr(numBytes)))

    elif args.create:
        dst = args.create
        info = [VERSION] + [0] * 11
        data = pack(args.src)
        pieces = []

        if args.compress != False:
            args.compress = args.compress or 'zlib'
            log('Compression: %s' % args.compress)
            n, f = {'zlib'   : (1, comp.zlib.compress),
                    'hmc'    : (2, comp.hmc.compress),
                    'bpk'    : (3, comp.bpk.compress),
                    'qed'    : (4, comp.qed.compress),
                    }[args.compress]
            info[1] = n
            data = f(data)

        if args.encrypt != False:
            if not args.password:
                args.password = raw_input('Password: ')
            args.encrypt = args.encrypt or 'coffee'
            log('Encryption: %s' % args.encrypt)
            n, f = {'coffee': (1, crypt.coffee.encrypt),
                    'benc'   : (2, crypt.benc.encrypt),
                    'fcrypt' : (3, crypt.fcrypt.encrypt),
                    }[args.encrypt]
            info[2] = n
            data = f(data, args.password)

        if args.noise:
            log('Noise: Yes')
            info[3] = 1
            data = noise(data)

        if args.split:
            # PKCS#5 padding limits number of pieces to 255
            if args.split > 255:
                die('Can split into at most 255 pieces')
            log('Split: %d pieces' % args.split)
            info[4] = args.split << 1 | 1
            pieces = split(data, args.split)
            data = ''

            if args.ecc:
                if args.ecc > 127:
                    die('Can add at most 127 pieces of redundancy')
                log('Error correction: %d extra pieces (~%d%% redundancy)' % \
                    (args.ecc, 100 * args.ecc / (args.split + args.ecc)))
                info[5] = args.ecc << 1 | 1
                pieces = ecc(pieces, args.split + args.ecc)

        elif args.ecc:
            die('You must also specify --split to use --ecc')

        size = len(data) + 24
        hdr = MAGIC + ''.join(map(chr, info)) + struct.pack('!I', size)
        crc = crc32(hdr + data)
        hdr += struct.pack('!I', crc)

        log('')
        log('File: %s' % dst)
        log('Size: %dB' % size)
        log('CRC : 0x%08x' % crc)

        if pieces:
            file(dst, 'wb').write(hdr)
            for i, piece in enumerate(pieces, 1):
                size = len(piece) + 8
                crc = crc32(piece)
                path = '%s.%d' % (dst, i)
                log('')
                log('File: %s' % path)
                log('Size: %dB' % size)
                log('CRC : 0x%08x' % crc)
                phdr = struct.pack('!II', size, crc)
                file(path, 'wb').write(phdr + piece)
        else:
            file(dst, 'wb').write(hdr + data)
    else:
        die('Must give --create or --extract')
