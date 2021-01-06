#!/usr/bin/python3
import re
import pprint
import sys
from datetime import *
from urllib.request import urlopen

pprint = pprint.PrettyPrinter(indent=4).pprint

# Own courses go here
own = ["DM564","DM563","DM507"]
team = "H9"

# Other courses to follow with low priority
courses = [
    #"DM548-IEL", # sys prog
    #"DM572-IEL", # cybersikkerhed
    #"DM861-IEL", # concurrency theory
    #"DM817-IEL"  # network progr
]
courses += [("%s:"+team+"-IEL") % (x,) for x in own]
courses = ",%20".join(courses)

compactmode = True
showSF = True
nextweek = False

def main():
    url = "https://natfak.sdu.dk/mitskema/jsdata.php?periode=e2020&courses="+courses
    #print(url)
    page = urlopen(url)
    wn = int((datetime.today()+timedelta(days=2)).strftime("%V"))
    if len(sys.argv) > 1:
        wn += 1
        nextweek = True
    obj = strip(page.read(),wn)
    obj = {day: priday(times) for day,times in obj.items()}
    print("Schedule week "+str(wn))
    printschedule(obj)


def strip(cnt,wk):
    cnt = str(cnt)
    i = None
    try:
        i   = cnt.index("weekList['2020"+str(wk)+"']")
    except:
        return {}
    j   = cnt.index("}\\n",i)
    fmt = cnt[i+20:j+1].replace("\\t","")
    fmt = fmt.replace("\\n","")
    fmt = re.sub(",\\s*}","}",fmt)
    return eval(fmt)

def priday(day):
    return {time: course for time,courses in day.items() for course in [pri(courses)] if course != None}

def pri(l):
    owncl = [x for x in l if x[0] in own and (showSF or x[4] != "SF")]
    ownc = (x for x in owncl[-1:])
    other = (x for x in l if x[0] not in own and x[2] == 'F')
    course = next(ownc, next(other, None))
    #if len(owncl) > 1:
    #    print("Multiple courses:")
    #    print(owncl)
    if course == None:
        return None
    room = course[1]
    if course[4] == "Online" or room[0] == "*":
        room = "*"
    if course[4] == "SF":
        course[2] = "SF"
    if room == "IMADA ComputerLab":
        room = "LAB"
    return [course[0],room,course[2]]

def printschedule(s):
    last = ["$"] * 5
    if compactmode:
        header = ['']+['-'*13]*5+['']
        day = datetime.today().weekday()
        if day < 5 and not nextweek:
            header[day+1] = '----Today----'
        #print(("   +"+"%s+"*5)%tuple(["-"*13]*5))
        print('   '+'+'.join(header))
    for time in (str(x) for x in [8,9,10,11,12,13,14,15,16,17]):
        sep = ["-" * 13] * 5
        fargs = [""] * 5 + [str(time)]
        for i,si in ((x,str(x+1)) for x in [0,1,2,3,4]):
            if si in s:
                cnt = ""
                if time in s[si]:
                    cnt = "{0:5s} {1:4s} {2:2s}".format(*s[si][time])
                if cnt == last[i] and cnt != "":
                    sep[i] = " " * 13
                    if compactmode and cnt != " " * 13:
                        fargs[i] = "^ ^ ^"
                else:
                    sep[i] = "-" * 13
                    fargs[i] = cnt
                last[i] = cnt
            else:
                fargs[i] = ""
        if not compactmode:
            print("   +%s+%s+%s+%s+%s+" % tuple(sep))
        print("{5:3s}|{0:13s}|{1:13s}|{2:13s}|{3:13s}|{4:13s}|".format(*fargs))
    print("   +---Monday----+---Tuesday---+--Wednesday--+--Thursday---+---Friday----+")

"""
def getrss():
    page = urlopen("https://e-learn.sdu.dk/webapps/itSS-RSSfeed-bb_bb60/rss.jsp?user=silch20&hash=7f5865811df2efed4a306e6de38d720d")
    arr = []
    rgx = re.compile("<item .*>[\\s\\S]*?<title>(.*)</title>[\\s\\S]*?<description><!\\[CDATA\\[(.*)\\]\\]></description>[\\s\\S]*?(<link>.*</link>)")
    for m in rgx.finditer(str(page.read())):
        arr.append((
            m.group(1)
                .replace("\\xc5","Å")
                .replace("\\xf8","ø"),
            m.group(2)
                .replace("&nbsp"," ")
                .replace("&oslash;","ø")
                .replace("&aring;","å")
                .replace("\\n","\n")
        ))
    return arr
"""

main()

