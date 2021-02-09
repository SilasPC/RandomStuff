
import os
import stat
import errno
from util import log, die

def pack(path):
    path = os.path.normpath(path)
    Q = [path]
    objs = []
    while Q:
        path = Q.pop(0)

        st = os.stat(os.path.realpath(path))
        mode  = st.st_mode
        islnk = False
        isdir = False
        data  = ''
        link  = ''

        if stat.S_ISDIR(mode):
            isdir = True
            log('Dir: %s/' % path)
            for entry in os.listdir(path):
                Q.append(os.path.join(path, entry))

        elif os.path.islink(path):
            islnk = True
            link = os.readlink(path)
            log('Link: %s -> %s' % (path, link))
            if len(link) > 100:
                die('Path too long: %s' % link)

        elif stat.S_ISREG(mode):
            log('File: %s' % path)
            try:
                data = file(path, 'rb').read()
            except IOError as e:
                if e.errno != errno.EPERM:
                    raise
                die('Cannot read file: %s: Permission denied' % path)

        def number(x, sz):
            return oct(x)[1-sz:].rjust(sz-1, '0') + '\0'

        if isdir:
            size = 0
            path += '/'

        if len(path) > 100:
            die('Path too long: %s' % path)

        name  = path.ljust(100, '\0')
        mode  = number(stat.S_IMODE(mode), 8)
        uid   = number(st.st_uid, 8)
        gid   = number(st.st_gid, 8)
        size  = number(len(data), 12)
        mtime = number(int(st.st_mtime), 12)
        islnk = '2' if islnk else '0'
        link  = link.ljust(100, '\0')
        cksum = ' ' * 8

        hdr = ''.join((name, mode, uid, gid, size, mtime, cksum, islnk, link))
        cksum = number(sum(map(ord, hdr)), 7) + ' '
        hdr = (hdr[:148] + cksum + hdr[156:]).ljust(512, '\0')

        obj = hdr + data

        objs.append(obj)

    return ''.join(objs)

def unpack(objs,outdir):

    files = 0
    tsize = 0

    while objs:
        name  = objs[:100].rstrip(chr(0))
        mode  = int(objs[100:107].rstrip(chr(0)),8)
        uid   = int(objs[108:115].rstrip(chr(0)),8)
        gid   = int(objs[116:123].rstrip(chr(0)),8)
        size  = int(objs[124:135].rstrip(chr(0)),8)
        mtime = int(objs[136:147].rstrip(chr(0)),8)
        cksum = objs[148:156]
        islnk = objs[156] == '2'
        link  = objs[157:257].rstrip(chr(0))

        files += 1
        tsize += size

        data = objs[512:512+size]

        objs = objs[512+size:]

        path = os.path.join(outdir,name)

        if not islnk and size == 0:
            os.mkdir(path,mode)
        elif not islnk:
            if os.path.exists(path):
                die("File '%s' already exists" % path)
            file(path,'wb').write(data)
        else:
            os.symlink(link,path)

    return files, tsize
