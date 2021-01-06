
// interface: {success:boolean,captures:{},length:integer,rematch:()=>this}

// rule of thumb: don't change the greedy algorithm

/*
  JS:   igmuy
  PCRE: igmsxU

*/

function create(rgx) {
  let start = Date.now()
  rgx = compiler(rgx)
  return src => {
    start = Date.now()
    let index = 0
    let ret
    while (index <= src.length) {
      ret = runAlts({alts:rgx,isAtomic:true},src,index,{})
      if (ret.success) break
      index++
    }
    if (!ret.success) return ret
    ret.captures[0] = src.slice(index,index+ret.length)
    return ret
  }
}

function combineCaptures(captures,matches) {
  let ret = {...captures}
  for (let m of matches) Object.assign(ret,m.captures)
  return ret
}

function runOp(op,src,skip,captures) {
  if (op.type == 'anchor')          return runAnchor      (op,src,skip)
  else if (op.type == 'lookAround') return runLookAround  (op,src,skip,captures)
  else if (op.isLazy)               return runLazy        (op,src,skip,captures)
  else if (op.isPossesive)          return runPossesive   (op,src,skip,captures)
  else                              return runGreedy      (op,src,skip,captures)
}

function runCore(ops,src,index,captures) {
  let matches = []
  while (matches.length < ops.length) {
    // console.log('_'.repeat(index)+src.slice(index))
    let op = ops[matches.length]
    let caps = combineCaptures(captures,matches)
    let skip = index+matches.reduce((s,{length})=>s+length,0)
    let m = runOp(op,src,skip,caps)
    if (m.success) matches.push(m)
    else if (!backTrack()) return {success:false}
  }
  if (matches.length < ops.length) return {success:false}
  return {
    success:true,
    length:matches.reduce((s,{length})=>s+length,0),
    captures: combineCaptures({},matches),
    rematch(){
      if (!backTrack()) {
        this.success = false
        return this
      }
      while (matches.length > 0 && matches.length < ops.length) {
        let op = ops[matches.length-1]
        let caps = combineCaptures(captures,matches)
        let skip = index+matches.reduce((s,{length})=>s+length,0)
        let m = runOp(op,src,skip,caps)
        if (m.success) matches.push(m)
        else if (!backTrack()) {
          this.success = false
          return this
        }
        // console.log('_'.repeat(skip)+src.slice(skip))
      }
      if (matches.length < ops.length) {
        this.success = false
        return this
      }
      this.length = matches.reduce((s,{length})=>s+length,0)
      this.captures = combineCaptures({},matches)
      return this
    }
  }
  function backTrack() {
    while (true) {
      if (matches.length == 0) {
        return false
      }
      let prev = matches[matches.length-1].rematch()
      if (prev.success) break
      matches.pop()
      let skip = index+matches.reduce((s,{length})=>s+length,0)
      // console.log('_'.repeat(skip)+src.slice(skip))
    }
    return true
  }
}

function runConditional(op,src,index,captures) {
  // console.log(op,index,captures)
  if (op.use == 'backRef') {
    if (op.group in captures) return runCore(op.clauses[0],src,index,captures)
    if (!op.clauses[1]) return {success:false}
    return runCore(op.clauses[1],src,index,captures)
  }
  throw 1
}

function runAnchor(op,src,index) {
  return {
    success:op.anchor(src.charAt(index-1),src.charAt(index)),
    length:0,
    captures:{},
    rematch(){
      this.success = false
      return this
    }
  }
}

function runLookAround(op,src,index,captures) {
  if (!op.lookAhead) throw 'no lookbehind yet plz'
  let m = runAlts(op,src,index,captures)
  if (m.success != op.positive) return {success:false}
  return {
    success:true,
    captures: op.positive?m.captures:{},
    length:0,
    rematch(){
      this.success = false
      return this
    }
  }
}

function runAlts(op,src,index,captures) {
  let altIndex = 0
  let res
  do {
    if (altIndex == op.alts.length) return {success:false}
    res = runCore(op.alts[altIndex++],src,index,captures)
  } while (!res.success)
  let caps = {...res.captures} // probably not needed. just making sure
  if (op.nr) caps[op.nr] = src.slice(0,res.length)
  if (op.name) caps[op.name] = src.slice(0,res.length)
  return {
    success:true,
    captures:caps,
    length:res.length,
    rematch(){
      if (op.isAtomic) {
        this.success = false
        return this
      }
      if (res.rematch().success) return this
      do {
        if (altIndex == op.alts.length) {
          this.success = false
          return this
        }
        res = runCore(op.alts[altIndex++],src,index,captures)
      } while (!res.success)
      this.length = res.length
      this.captures = res.captures
      return this
    }
  }
}

function runGreedy(op,src,index,captures) {
  if (op.type == 'group' || op.type == 'conditional') {
    let subs = []
    if (!doThang()) return {success:false}
    return {
      success:true,
      captures:combineCaptures({},subs),
      length:subs.reduce((s,{length})=>s+length,0),
      rematch(){
        if (subs.length == 0) {
          this.success = false
          return this
        }
        if (subs[subs.length-1].rematch().success) {
          if (!doThang()) {
            this.success = false
            return this
          }
        } else {
          subs.pop()
          if (subs.length < op.min) return this.rematch()
        }
        this.length = subs.reduce((s,{length})=>s+length,0)
        this.captures = combineCaptures({},subs)
        return this
      }
    }
    function doThang() {
      while (subs.length<op.max) {
        let sub = (op.type=='group'?runAlts:runConditional)(op,src,index+subs.reduce((s,{length})=>s+length,0),combineCaptures(captures,subs))
        if (sub.success) {
          subs.push(sub)
          continue
        }
        while (true) {
          if (subs.length>=op.min) return true
          if (subs.length == 0) return false
          if (subs[subs.length-1].rematch().success) break
          subs.pop()
        }
      }
      return true
    }
  }
  if (op.type == 'range') {
    let length = 0
    while (length < op.max) {
      if (!testRange(op,src.charAt(index+length))) break
      length++
    }
    if (length < op.min) return {success:false}
    return {
      success:true,
      length,
      captures:{},
      rematch(){
        if (this.length == op.min) {
          this.success = false
          return this
        }
        this.length--
        return this
      }
    }
  }
  if (op.type == 'char') {
    let length = 0
    while (length < op.max) {
      if (src.charAt(index+length) != op.char) break
      length++
    }
    if (length < op.min) return {success:false}
    return {
      success:true,
      length,
      captures:{},
      rematch(){
        if (this.length == op.min) {
          this.success = false
          return this
        }
        this.length--
        return this
      }
    }
  }
  if (op.type == 'backRef') {
    // console.log('backref',captures)
    let ref = captures[op.reference]
    if (ref == undefined) return {success:false}
    let count = 0
    if (ref.length > 0) {
      while (count < op.max) {
        if (!src.slice(index+ref.length*count).startsWith(ref)) break
        count++
      }
      if (count < op.min) return {success:false}
    }
    return {
      success:true,
      length:count*ref.length,
      captures:{},
      rematch(){
        if (ref.length == 0 || count == op.min) {
          this.success = false
          return this
        }
        this.length -= ref.length
        count--
        return this
      }
    }
  }
}

function runPossesive(op,src,index,captures) {
  if (op.type == 'group') {
    let length = 0
    let count = 0
    let subs = []
    while (count < op.max) {
      let caps = combineCaptures({},subs)
      let sub = runAlts(op,src,index+subs.reduce((s,{length})=>s+length,0),caps)
      if (!sub.success) break
      length += sub.length
      count++
      subs.push(sub)
    }
    if (count < op.min) return {success:false}
    return {
      success:true,
      captures:combineCaptures({},subs),
      length,
      rematch(){
        this.success = false
        return this
      }
    }
  }
  let ret = runGreedy(op,src,index,captures)
  ret.rematch = function(){
    this.success = false
    return this
  }
  return ret
}

function runLazy(op,src,index,captures) {
  if (op.type == 'group' || op.type == 'conditional') {
    let subs = []
    while (subs.length < op.min) {
      let caps = combineCaptures(captures,subs)
      let sub = (op.type=='group'?runAlts:runConditional)(op,src,index+subs.reduce((s,{length})=>s+length,0),caps)
      if (!sub.success) {
        while (true) {
          if (subs.length == 0) return {success:false}
          let last = subs[subs.length-1]
          if (last.rematch().success) break
          subs.pop()
        }
      } else subs.push(sub)
    }
    return {
      success:true,
      captures:combineCaptures({},subs),
      length:subs.reduce((s,{length})=>s+length,0),
      rematch(){
        if (subs.length < op.max) {
          let caps = combineCaptures(captures,subs)
          let sub = (op.type=='group'?runAlts:runConditional)(op,src,index+subs.reduce((s,{length})=>s+length,0),caps)
          if (sub.success) {
            subs.push(sub)
            this.length += sub.length
            return this
          }
        }
        while (true) {
          if (subs.length == 0) {
            // console.log('lazy rematch failed',src)
            this.success = false
            return this
          }
          let last = subs[subs.length-1]
          if (last.rematch().success) break
          subs.pop()
        }
        this.length = subs.reduce((s,{length})=>s+length,0)
        this.captures = combineCaptures({},subs)
        return this
      }
    }
  }
  if (op.type == 'range') {
    let length = 0
    while (length < op.min) {
      if (!testRange(op,src.charAt(index+length))) return {success:false}
      length++
    }
    return {
      success:true,
      length,
      captures:{},
      rematch(){
        if (this.length == op.max || !testRange(op,src.charAt(index+this.length++))) {
          this.success = false
        }
        return this
      }
    }
  }
  if (op.type == 'char') {
    let length = 0
    while (length < op.min) {
      if (src.charAt(index+length) != op.char) return {success:false}
      length++
    }
    return {
      success:true,
      length,
      captures:{},
      rematch(){
        if (this.length == op.max || src.charAt(index+this.length++) != op.char) {
          this.success = false
        }
        return this
      }
    }
  }
  if (op.type == 'backRef') {
    let ref = captures[op.reference]
    if (ref == undefined) return {success:false}
    let count = 0
    if (ref.length > 0) {
      while (count < op.min) {
        if (!src.slice(index+ref.length*count).startsWith(ref)) return {success:false}
        count++
      }
    }
    return {
      success:true,
      length:count*ref.length,
      captures:{},
      rematch(){
        if (ref.length == 0 || count == op.max || !src.slice(index+this.length).startsWith(ref)) {
          this.success = false
          return this
        }
        this.length += ref.length
        count++
        return this
      }
    }
  }
  throw 'only lazy char or group for now'
}

function testRange(op,char) {
  if (char == '') return false
  if (op.chars.includes(char.charCodeAt(0))) return !op.isNegated
  let cc = char.charCodeAt(0)
  for (let r of op.ranges) {
    if (cc >= r[0] && cc <= r[1]) return !op.isNegated
  }
  return op.isNegated
}
