
import sys
import zlib

MAGIC   = 'FEAr'
VERSION = 1
VERBOSE = True

def err(msg = '', die = False):
    if die:
        die(msg)
    warn(msg)

def die(msg = '', status = 1):
    if msg:
        print >>sys.stderr, msg
    sys.exit(status)

def unimpl(*args):
    die("Unimplemented")

def log(msg):
    if VERBOSE:
        print >>sys.stderr, msg

def warn(msg):
    print >>sys.stderr, '\x1b[31m%s\x1b[m' % msg

def crc32(data):
    return zlib.crc32(data) & 0xffffffff

def depad(data):
    val = ord(data[-1])
    if map(ord,data[-val:]) == [val] * val:
        return data[:-val]

def bytesToStr(n):
    if n < 1e3:
        return '%d b' % n
    if n < 1e6:
        return '%d kb' % n // 1e3
    if n < 1e9:
        return '%d Mb' % n // 1e6
    if n < 1e12:
        return '%d Gb' % n // 1e9
    return '%d Tb' % n // 1e12