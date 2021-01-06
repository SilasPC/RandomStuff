
enum FrameMode {
  INITIAL,
  MATCHED,
  BACKTRACKING,
  DEAD,
}

interface Match {
  srcStart:number,
  srcEnd:number,
  altIndex:number,
  opIndex:number,
  frames:BaseFrame[]
}

interface BaseFrame {
  op: any,
  srcEnd: number,
  opIndex: number,
}

interface CharFrame extends BaseFrame {
  matchCount: number,
}

interface Frame extends BaseFrame {
  mode:FrameMode,
  parent:Frame,
  srcStart:number,
  srcEnd:number,
  op:any,
  opIndex:number,
  matches:Match[],
}

let breakTime: number

function breakOut(n?:number) {
  if (n) breakTime = Date.now() + n
  else if (Date.now()>breakTime) throw 'Timeout:\n'+(new Error()).stack
}

// i would like to split the whole thing into backtrack and exec functions
// then to avoid recursion, make each able to return then start the next with some params
export function run(rgx:any,src:string) {
  breakOut(100)
  let root: Frame = {mode:FrameMode.INITIAL,opIndex:0,parent:null,srcStart:0,srcEnd:NaN,op:{type:'group',min:1,max:1,isLazy:false,isPossesive:false,alts:rgx},matches:[{srcStart:0,srcEnd:NaN,altIndex:0,opIndex:-1,frames:[]}]}
  let frame: Frame = root
  let currentIndex = 0
  let isBackTracking = false
  mainLoop:while(1) {
    if (frame==null) return console.log(!isBackTracking,currentIndex,root)
    //if (frame.op.isLazy) throw 'no lazy'
    if (frame.matches.length == 0) {
      if (isBackTracking) {
        // console.log('lazy died before main')
        frame.mode = FrameMode.DEAD
        frame = frame.parent
        continue mainLoop
      } else if (frame.mode==FrameMode.INITIAL&&frame.op.min==0) {
        frame.srcEnd = currentIndex
        frame.mode = FrameMode.MATCHED
        frame = frame.parent
        continue mainLoop
      } else frame.matches.push({frames:[],altIndex:0,opIndex:-1,srcEnd:NaN,srcStart:currentIndex})
    }
    let match = frame.matches[frame.matches.length-1]
    // console.log('main',match)
    if (isBackTracking) {
      if (frame.op.isLazy) {
        if (frame.mode==FrameMode.MATCHED&&frame.matches.length<frame.op.max) {
          // console.log('lazy backtrack exec')
          isBackTracking = false
          frame.mode = FrameMode.BACKTRACKING
          frame.matches.push({frames:[],altIndex:0,opIndex:-1,srcEnd:NaN,srcStart:currentIndex})
          continue mainLoop
        } else {
          frame.mode = FrameMode.BACKTRACKING
          backTrackLoop:while (1) {
            let latest = match.frames[match.frames.length-1]
            // console.log('backtrack lazy')
            if (!latest) {
              if (++match.altIndex<frame.op.alts.length) {
                // console.log('alt switch')
                match.opIndex = -1
                currentIndex = match.srcStart
                isBackTracking = false
                continue mainLoop
              }
              frame.matches.pop()
              if (frame.matches.length) continue mainLoop
              else {
                // console.log('lazy frame died')
                frame.mode = FrameMode.DEAD
                frame = frame.parent
                continue mainLoop
              }
            }
            if (latest.op.type == 'group' && (<Frame>latest).mode == FrameMode.DEAD) {
              match.frames.pop()
              continue backTrackLoop
            }
            match.opIndex = latest.opIndex
            if (latest.op.type == 'group') {
              frame = <Frame>latest
              continue mainLoop
            } else if (latest.op.type == 'char') {
              if (!latest.op.isLazy) {
                if (
                  (<CharFrame>latest).matchCount==latest.op.min ||
                  src.charAt(latest.srcEnd-1)!=latest.op.char
                ) {
                  match.frames.pop()
                  continue backTrackLoop
                }
                latest.srcEnd--
                (<CharFrame>latest).matchCount--
                currentIndex--
                isBackTracking = false
                continue mainLoop
              }
              if (
                (<CharFrame>latest).matchCount==latest.op.max ||
                src.charAt(latest.srcEnd)!=latest.op.char
              ) {
                match.frames.pop()
                continue backTrackLoop
              }
              latest.srcEnd++
              (<CharFrame>latest).matchCount++
              currentIndex++
              isBackTracking = false
              continue mainLoop
            } else throw 'another backtrack op type'
          }
        }
      }
      backTrackLoop:while (1) {
        let latest = match.frames[match.frames.length-1]
        // console.log('backtrack greedy',latest)
        if (!latest) {
          if (++match.altIndex<frame.op.alts.length) {
            // console.log('alt switch')
            currentIndex = match.srcStart
            match.opIndex = -1
            isBackTracking = false
            continue mainLoop
          }
          frame.matches.pop()
          if (frame.op.min>0&&!frame.matches.length) {
            // console.log('died')
            frame.mode = FrameMode.DEAD
            frame = frame.parent
            continue mainLoop
          } else if (frame.matches.length<frame.op.min) {
            // console.log('backtrack next frame')
            match = frame.matches[frame.matches.length-1]
            continue backTrackLoop
          } else {
            // console.log('backtrack ok')
            isBackTracking = false
            if (frame.matches.length) currentIndex = frame.matches[frame.matches.length-1].srcEnd
            else currentIndex = frame.srcStart
            frame.srcEnd = currentIndex
            frame.mode = FrameMode.MATCHED
            frame = frame.parent
            continue mainLoop
          }
        }
        if (latest.op.type == 'group' && (<Frame>latest).mode == FrameMode.DEAD) {
          // console.log('dead group frame')
          match.frames.pop()
          continue backTrackLoop
        }
        match.opIndex = latest.opIndex
        switch (latest.op.type) {
          case 'group':
            // console.log('enter group (main->backtrack)')
            frame = <Frame>latest
            continue mainLoop
          case 'char':
            if (!latest.op.isLazy) {
              if ((<CharFrame>latest).matchCount==latest.op.min) {
                // console.log('G char died')
                match.frames.pop()
                continue backTrackLoop
              }
              // console.log('G char');
              (<CharFrame>latest).srcEnd--
              (<CharFrame>latest).matchCount--
              currentIndex--
              isBackTracking = false
              continue mainLoop
            }
            if (
              (<CharFrame>latest).matchCount==latest.op.max ||
              src.charAt(latest.srcEnd)!=latest.op.char
            ) {
              // console.log('L char died')
              match.frames.pop()
              continue backTrackLoop
            }
            // console.log('L char ok');
            (<CharFrame>latest).srcEnd++
            (<CharFrame>latest).matchCount++
            currentIndex++
            isBackTracking = false
            continue mainLoop
          default:
            throw 'nope'
        }
      }
    }
    opLoop:while (1) {
      breakOut()
      let op = frame.op.alts[match.altIndex][++match.opIndex]
      // console.log('op',op)
      if (!op) {
        if (frame.op.isLazy) {
          if (frame.matches.length>=frame.op.min) {
            frame.srcEnd = currentIndex
            frame.mode = FrameMode.MATCHED
            frame = frame.parent
            continue mainLoop
          } else {
            match.srcEnd = currentIndex
            match = {altIndex:0,opIndex:-1,srcStart:currentIndex,srcEnd:NaN,frames:[]}
            frame.matches.push(match)
            continue opLoop
          }
        } else {
          if (frame.matches.length==frame.op.max) {
            // console.log('group matched')
            frame.srcEnd = currentIndex
            frame.mode = FrameMode.MATCHED
            frame = frame.parent
            continue mainLoop
          } else {
            // console.log('create new match')
            match.srcEnd = currentIndex
            match = {altIndex:0,opIndex:-1,srcStart:currentIndex,srcEnd:NaN,frames:[]}
            frame.matches.push(match)
            continue opLoop
          }
        }
      }
      if (op.type=='group') {
        let newFrame: Frame = {
          mode: FrameMode.INITIAL,
          parent: frame,
          srcStart: currentIndex,
          srcEnd: NaN,
          opIndex: match.opIndex,
          op,
          matches:[]
        }
        // console.log('enter new group')
        if (!op.isLazy) newFrame.matches.push({opIndex:-1,altIndex:0,frames:[],srcEnd:NaN,srcStart:currentIndex})
        match.frames.push(newFrame)
        frame = newFrame
        continue mainLoop
      } else if (op.type=='char') {
        if (!op.isLazy) {
          let newFrame: CharFrame = {op,srcEnd:currentIndex,matchCount:0,opIndex:match.opIndex}
          while (newFrame.matchCount<op.max) {
            if (src.charAt(newFrame.srcEnd)==op.char) {
              newFrame.srcEnd++
              newFrame.matchCount++
              continue
            } else if (newFrame.matchCount<op.min) {
              // console.log('char op failed')
              frame.mode = FrameMode.BACKTRACKING
              isBackTracking = true
              continue mainLoop
            } else break
          }
          // console.log('char op ok')
          currentIndex = newFrame.srcEnd
          match.frames.push(newFrame)
          continue opLoop
        } else {
          let newFrame: CharFrame = {op,srcEnd:currentIndex,matchCount:0,opIndex:match.opIndex}
          while (newFrame.matchCount<op.min) {
            if (src.charAt(newFrame.srcEnd)==op.char) {
              newFrame.srcEnd++
              newFrame.matchCount++
              continue
            } else {
              frame.mode = FrameMode.BACKTRACKING
              isBackTracking = true
              continue mainLoop
            }
          }
          currentIndex = newFrame.srcEnd
          match.frames.push(newFrame)
          continue opLoop
        }
      } else throw 'another op type'
    }
  }
}
