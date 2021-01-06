
/* frame:
{
  type:'group',
  parent:null,
  srcStart:0,
  srcEnd:0,
  op:{},
  opIndex:0,
  subMatches:[],
  mode:INITIAL
}
// subMatch:
{
  srcStart:0,
  srcEnd:NaN,
  altIndex:0,
  opIndex:0,
  frames:[]
}*/

// config
/*{
  // compile
  nativeOnly:false,
  lookBehindMode:'reverse|fixed-length|variable-length',
  allowRecursionDepthReferences:false,
  allowPositiveReferences:false,
  captureMode:'strict|truthy',
  flags:'',
  overwriteCaptures:true,
  maxRunTime:Infinity
}*/

// BUG: run(compiler('(ab|a)+?bab'),'ababab')

class Pattern {
  constructor(regex,cfg) {
    this.string = regex
    flags = ''
    if (typeof cfg == 'string') {
      flags = cfg
      cfg = {}
    }
    this.compiled = compiler(regex)
  }
  match(input) {
    return run(compiled,input)
  }
}

const
  INITIAL=0,
  MATCHED=1,
  BACKTRACKING=2,
  DEAD=3

let breakTime

function breakOut(n) {
  if (n) breakTime = Date.now() + n
  else if (Date.now()>breakTime) throw 'Timeout:\n'+(new Error()).stack
}

function run(rgx,src,n=2000) {
  breakOut(n)
  let frame = {type:'group',opIndex:0,mode:INITIAL,parent:null,srcStart:0,srcEnd:NaN,op:{min:1,max:1,isLazy:true,isPossesive:false,alts:rgx},subMatches:[]}
  let rootFrame = frame
  let currentIndex = 0
  let isBackTracking = false
  mainLoop:while (true) { // main loop
    breakOut()
    console.log('isRoot?',frame==rootFrame)
    if (frame==null) {
      return console.log(!isBackTracking,currentIndex,rootFrame)
    }
    if (!frame.subMatches.length) {
      if (!frame.op.isLazy) {
        // greedy died
        console.log('greedy died')
        frame.mode = DEAD
        frame = frame.parent
        continue mainLoop
      }
      if (isBackTracking) {
        // died because it hit zero during backtracking
        console.log('lazy died')
        frame.mode = DEAD
        frame = frame.parent
        continue mainLoop
      } else if (frame.mode==INITIAL&&frame.op.min==0) {
        // initial match at zero
        frame.srcEnd = currentIndex
        frame.mode = MATCHED
        frame = frame.parent
        continue mainLoop
      }
      frame.subMatches.push({frames:[],altIndex:0,opIndex:-1,srcEnd:NaN,srcStart:currentIndex})
    }
    let sF = frame.subMatches[frame.subMatches.length-1]
    console.log(sF)
    if (isBackTracking) {
      if (frame.op.isLazy) {
        if (frame.mode==MATCHED&&frame.subMatches.length<frame.op.max) {
          console.log('lazy backtrack exec')
          isBackTracking = false
          frame.mode = BACKTRACKING
          frame.subMatches.push({frames:[],altIndex:0,opIndex:-1,srcEnd:NaN,srcStart:currentIndex})
        } else {
          frame.mode = BACKTRACKING
          backTrackLoop:while (true) {
            breakOut()
            let latest = sF.frames[sF.frames.length-1]
            if (!latest) {
              if (++sF.altIndex<frame.op.alts.length) {
                console.log('lazy alt switch')
                // got more alts!
                // stop backtracking, and start executing
                sF.opIndex = -1
                isBackTracking = false
                continue mainLoop
              }
              // no more subMatch.frames, and no alts
              // now we need to backtrack to the last subMatch
              frame.subMatches.pop()
              if (frame.subMatches.length) continue mainLoop
              else {
                console.log('lazy died')
                // no more subMatches, the whole frame just died
                // go to parent frame, and backtrack.
                // setting frame mode to dead,
                // means that this frame is immediately discarded
                frame.mode = DEAD
                frame = frame.parent
                continue mainLoop
              }
            }
            if (latest.mode==DEAD) {
              sF.frames.pop()
              continue backTrackLoop
            }
            sF.opIndex = latest.opIndex
            if (latest.type=='group') {
              sF.opIndex = latest.opIndex
              frame = latest
              continue mainLoop
            } else if (latest.type=='char') {
              if (!latest.op.isLazy) {
                if (
                  latest.matchCount==latest.op.min ||
                  src.charAt(latest.srcEnd-1)!=latest.op.char
                ) {
                  sF.frames.pop()
                  continue backTrackLoop
                }
                latest.srcEnd--
                latest.matchCount--
                currentIndex--
                isBackTracking = false
                continue mainLoop
              }
              if (
                latest.matchCount==latest.op.max ||
                src.charAt(latest.srcEnd)!=latest.op.char
              ) {
                // rematch failed
                sF.frames.pop()
                continue backTrackLoop
              }
              latest.srcEnd++
              latest.matchCount++
              currentIndex++
              isBackTracking = false
              // remain in backtrack frame-mode
              continue mainLoop
            } else {
              throw 'lazy backtrack only does lazy groups and chars rn'
            }
          }
          throw 'backtrackloop is never broken?'
        }
      } else {
        backTrackLoop:while (true) {
          console.log('greedy backtrack',frame.subMatches.length,sF.frames.length)
          breakOut()
          let latest = sF.frames[sF.frames.length-1]
          if (!latest) {
            if (++sF.altIndex<frame.op.alts.length) {
              console.log('greedy alt switch')
              // got more alts!
              // stop backtracking, and start executing
              sF.opIndex = -1
              isBackTracking = false
              continue mainLoop
            }
            // no more subMatch.frames, and no alts
            // now we need to backtrack to the last subMatch
            frame.subMatches.pop()
            if (frame.op.min>0&&!frame.subMatches.length) {
              console.log('greedy died')
              frame.mode = DEAD
              frame = frame.parent
              continue mainLoop
            } else if (frame.subMatches.length<frame.op.min) {
              sF = frame.subMatches
              continue backTrackLoop
            } else {
              console.log('greedy backtrack exiting')
              isBackTracking = false
              if (frame.subMatches.length) currentIndex = frame.subMatches[frame.subMatches.length-1].srcEnd
              else currentIndex = frame.srcStart
              frame.srcEnd = currentIndex
              frame.mode = MATCHED
              frame = frame.parent
              continue mainLoop
            }
          }
          if (latest.mode==DEAD) {
            sF.frames.pop()
            continue backTrackLoop
          }
          sF.opIndex = latest.opIndex
          if (latest.type=='group') {
            sF.opIndex = latest.opIndex // duped lol
            frame = latest
            continue mainLoop
          } else if (latest.type=='char') {
            if (!latest.op.isLazy) {
              if (latest.matchCount==latest.op.min) {
                sF.frames.pop()
                continue backTrackLoop
              }
              latest.srcEnd--
              latest.matchCount--
              currentIndex--
              isBackTracking = false
              continue mainLoop
            }
            if (
              latest.matchCount==latest.op.max ||
              src.charAt(latest.srcEnd)!=latest.op.char
            ) {
              // rematch failed
              sF.frames.pop()
              continue backTrackLoop
            }
            latest.srcEnd++
            latest.matchCount++
            currentIndex++
            isBackTracking = false
            // remain in backtrack frame-mode
            continue mainLoop
          } else {
            throw 'greedy backtrack only does greedy groups and chars rn'
          }
        }
        throw 'greedy backtrack ended?'
      }
    }
    opLoop:while (true) { // op loop
      breakOut()
      let op = frame.op.alts[sF.altIndex][++sF.opIndex]
      console.log('op',currentIndex,op)
      if (!op) {
        // ran out of ops
        if (frame.op.isLazy) {
          if (frame.subMatches.length>=frame.op.min) {
            console.log('lazy matched')
            // frame ok for now
            frame.srcEnd = currentIndex
            frame.mode = MATCHED
            frame = frame.parent
            continue mainLoop
          } else {
            // new subMatch ### IF < max
            sF.srcEnd = currentIndex
            sF = {altIndex:0,opIndex:-1,srcEnd:NaN,frames:[]}
            frame.subMatches.push(sF)
            continue opLoop
          }
        } else {
          if (frame.subMatches.length==frame.op.max) {
            console.log('greedy matched')
            frame.srcEnd = currentIndex
            frame.mode = MATCHED
            frame = frame.parent
            continue mainLoop
          } else {
            // new subMatch
            sF.srcEnd = currentIndex
            sF = {altIndex:0,opIndex:-1,srcEnd:NaN,frames:[]}
            frame.subMatches.push(sF)
            continue opLoop
          }
        }
      }
      if (op.type=='group') {
        let newFrame = {
          type:'group',
          mode:INITIAL,
          parent:frame,
          srcStart:currentIndex,
          srcEnd:NaN,
          opIndex:sF.opIndex,
          op,
          subMatches:[]
        }
        if (!op.isLazy) newFrame.subMatches.push({opIndex:-1,srcEnd:NaN,frames:[],altIndex:0,srcStart:currentIndex})
        sF.frames.push(newFrame)
        frame = newFrame
        continue mainLoop
      } else if (op.type=='char') {
        if (!op.isLazy) {
          let newFrame = {type:'char',op,srcEnd:currentIndex,matchCount:0,opIndex:sF.opIndex}
          while (newFrame.matchCount<op.max) {
            if (src.charAt(newFrame.srcEnd)==op.char) {
              newFrame.srcEnd++
              newFrame.matchCount++
              continue
            } else if (newFrame.matchCount<op.min) {
              frame.mode = BACKTRACKING /// XXX: have this?
              isBackTracking = true
              continue mainLoop
            } else break
          }
          currentIndex = newFrame.srcEnd
          sF.frames.push(newFrame)
          continue opLoop
        }
        let newFrame = {type:'char',op,srcEnd:currentIndex,matchCount:0,opIndex:sF.opIndex}
        while (newFrame.matchCount<op.min) {
          if (src.charAt(newFrame.srcEnd)==op.char) {
            newFrame.srcEnd++
            newFrame.matchCount++
            continue
          } else {
            frame.mode = BACKTRACKING // disallow further lazy execution
            isBackTracking = true
            continue mainLoop
          }
        }
        currentIndex = newFrame.srcEnd
        sF.frames.push(newFrame)
        continue opLoop
      } else {
        throw 'another op type'
      }
    }
  }
}
