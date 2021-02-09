
def compress(data):
    if not data:
        return ''

    c = data[0]
    Z = 0x100
    G = [[float('inf'), [c]]]

    def p1((a, b)):
        seen = False
        for i, r in enumerate(G):
            c = r[1][0]
            for d in r[1][1:]:
                if (a, b) == (c, d):
                    if seen:
                        return True
                    seen = True
                c = d
        return False

    def p2():
        for i, (rc, _) in enumerate(G):
            if rc < 2:
                yield i

    def isterminal(x):
        return isinstance(x, str)

    def ref(xs, n):
        for x in xs:
            if not isterminal(x):
                G[x][0] += n

    def find(link):
        for i, (_, s) in enumerate(G):
            if tuple(s) == link:
                return i

        G.append([0, list(link)])
        ref(link, 1)

        return len(G) - 1

    def use(i):
        links = []
        rc, s1 = G[i]
        for _, s2 in G:
            if s1 == s2:
                continue
            j = 0
            while j <= len(s2) - len(s1):
                if s2[j:j + len(s1)] == s1:
                    ref(s2[j:j + len(s1)], -1)
                    s2[j:j + len(s1)] = [i]
                    rc += 1
                    if j:
                        links.append((s2[j-1], s2[j]))
                j += 1
        G[i][0] = rc
        return links

    def rem(i):
        links = []
        _, s1 = G.pop(i)
        for _, s2 in G:
            j = 0
            while j < len(s2):
                if s2[j] == i:
                    s2[j:j+1] = s1
                    if j:
                        links.append((s2[j-1], s2[j]))
                    j += len(s1)
                    continue
                elif not isterminal(s2[j]) and s2[j] > i:
                    s2[j] -= 1
                j += 1
        return links

    # This algorithm is rather slow; better log progress
    progress = ''
    for i, c in enumerate(data[1:]):
        progress_ = '%d%%' % (i * 100 // len(data))
        if progress != progress_:
            progress = progress_
            log(progress)
        G[0][1].append(c)
        links = [tuple(G[0][1][-2:])]
        while links:
            link = links.pop()
            if p1(link):
                rule = find(link)
                links += use(rule)
            for rule in p2():
                links += rem(rule)

    data = []
    for n, (_, xs) in enumerate(G):
        for x in xs:
            if isterminal(x):
                x = ord(x)
            else:
                x += Z
            data.append(x)
        data.append(Z)

    data.pop()

    return hmc(data)
