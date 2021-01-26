#!/usr/bin/python3
import re
import sys
from datetime import *
from urllib.request import urlopen

# Script to fetch and print SDU schedule
# For usage, see bottom of file

### CONFIGURATION ###
courses = ["DM564","DM563","DM507"]
team = "H9" # "*" for 
compactmode = True
### END CONFIGURATION ###

# Globals
otherWeek = False
remarks = set()

# Preformating
courses += [("%s:"+team+"-IEL") % (x,) for x in courses]
courses = ",%20".join(courses)

def main():
    wn, yr, period = getWeekData()
    url = "https://natfak.sdu.dk/mitskema/jsdata.php?periode="+period+"&courses="+courses
    page = urlopen(url)
    obj = extractObj(page.read(), wn, yr)
    obj = {day: priday(times) for day,times in obj.items()}
    print("Schedule week "+str(wn))
    printschedule(obj)
    global remarks
    for remark in remarks:
        print(remark)

def getWeekData():
    """
    Returns in order:
     - weeknumber (from sysargs)
     - year
     - period tag ((e|f)\d{4})
    """
    now = datetime.today()+timedelta(days=2)
    if len(sys.argv) > 1:
        argre = re.compile("(\\+|-)?(\\d*)")
        match = argre.match(sys.argv[1])
        if match is not None:
            arg = sys.argv[1]
            if match.group(2) == "":
                arg += '1'
            offset = eval(arg)
            global otherWeek
            otherWeek = (offset != 0)
            now += timedelta(weeks=offset)
    wn = int(now.strftime("%V"))
    yr = now.strftime("%Y")
    tag = None
    if wn < 30:
        tag = "f"
    else:
        tag = "e"
    return wn, int(yr), tag + now.strftime("%Y")

def extractObj(cnt,wk,yr):
    """
    Isolate js object from weeknumber and year,
    pythonize and evaluate
    """
    cnt = str(cnt)
    i = None
    try:
        i = cnt.index("weekList['{}{:02d}']".format(yr,wk))
    except:
        return {} # week not found
    j   = cnt.index("}\\n",i) # index for end of object
    fmt = cnt[i+20:j+1].replace("\\t","")
    fmt = fmt.replace("\\n","")
    fmt = re.sub(",\\s*}","}",fmt)
    return eval(fmt)

def priday(day):
    ret = {}
    for time,courses in day.items():
        course = extractCourse(courses)
        if course is not None:
            ret[time] = course
    return ret

def extractCourse(crs):
    """
    Extract first course and return
     - [courseId, room, tag]
    """

    # Sort out wrong teams
    if team != "*":
        crs = [c for c in crs if c[3] == team or c[3] == ""]
    
    if len(crs) == 0:
        return None
    elif len(crs) > 1:
        global remarks
        remarks.add("Warning, hidden courses due to collision, check online schedule")
    
    [courseId,room,tag,cteam,note] = crs[0]
    if note == "Online" or room[0] == "*":
        # * means '*odense lokalitet aftales ..'
        room = "*"
    if note == "SF":
        tag = "SF"
    
    room = room[-4:] # Limit room name length
    
    return [courseId, room, tag]

def printschedule(s):
    last = ["$"] * 5
    header = ['']+['-'*13]*5+['']
    day = datetime.today().weekday()
    if day < 5 and not otherWeek:
        header[day+1] = '----Today----'
    print('   '+'+'.join(header))
    for time in (str(x) for x in range(8,18)):
        sep = ["-" * 13] * 5
        fargs = [""] * 5 + [str(time)]
        for i,si in ((x,str(x+1)) for x in range(5)):
            if si in s:
                cnt = ""
                if time in s[si]:
                    cnt = "{0:5s} {1:4s} {2:2s}".format(*s[si][time])
                if cnt == last[i] and cnt != "":
                    sep[i] = " " * 13
                    if cnt != " " * 13:
                        fargs[i] = "^ ^ ^"
                else:
                    sep[i] = "-" * 13
                    fargs[i] = cnt
                last[i] = cnt
            else:
                fargs[i] = ""
        print("{5:3s}|{0:13s}|{1:13s}|{2:13s}|{3:13s}|{4:13s}|".format(*fargs))
    print("   +---Monday----+---Tuesday---+--Wednesday--+--Thursday---+---Friday----+")

main()

"""
How to use:

 - Install dependencies
 - Configure (see top of file)
 - Execute from terminal, optionally with an argument

Optional argument:
 - "-n"     gives n'th previous week
 - "+n"     gives n'th next week
 - "+"      same as '+1'
 - "-"      same as '-1'

"""
