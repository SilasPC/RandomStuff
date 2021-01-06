
// TODO:
//    lookBehind
//    variables&expressions?
//      reading captures as variables?
//    char types and such !!!
//    anchors // ish
//    backref // ish
//    use flags
//    ranges // missing character classes and flags
//    getRange function for character classes

function compiler(rgx) {
  let meta = {
    groupStart:1,
    numericGroups:{},
    namedGroups:{},
    defineAlts:[]
  }
  let flags = {
    ignoreCase:false,
    multiLine:false,
    dotAll:false,
    extended:false,
    ungreedy:false
  }
  let result = compile(rgx,0,meta,flags,false)
  traverse(result.alts)
  traverse(meta.defineAlts)
  // traverse regex to find meta-compile things
  function traverse(rgx) {
    if (rgx.length == 0) return
    if (Array.isArray(rgx[0])) {
      for (let sub of rgx) traverse(sub)
      return
    }
    for (let index = 0; index < rgx.length; index++) {
      let op = rgx[index]
      if (op.type == 'conditional') traverse(op.clauses)
      else if (op.type == 'lookAround') traverse(op.alts)
      else if (op.type == 'group' && !op.metaCompile) traverse(op.alts)
      else if (!op.metaCompile) continue
      switch (op.metaCompile) {
        case 'named-subroutine':
          let routine = meta.namedGroups[op.metaName]
          if (!routine) throw 'no such subroutine: '+op.metaName
          op.alts = routine.alts
          break
        case 'numeric-subroutine':
          let routine2 = op.metaNr==0?{alts:result.alts}:meta.numericGroups[op.metaNr]
          if (!routine2) throw 'no such subroutine: '+op.metaNr
          op.alts = routine2.alts
          break
      }
    }
  }
  return result.alts
}

function compile(rgx,index,meta,flags,noRunOut) {
  let alt = []
  let alts = [alt]
  for (; index < rgx.length; index++) {
    //console.log('_'.repeat(index)+rgx.slice(index),noRunOut)
    let char = rgx.charAt(index)
    let attribs
    switch (char) {
      case '|':
        alts.push(alt=[])
        break
      case '':
      case ')':
        return {alts,index}
      case '(':
        index = dealWithGroup(rgx,index,alt,meta,flags)
        break
      case '\\':
        index = dealWithBackslash(rgx,++index,alt,meta,flags)
        break
      case '[':
        index = dealWithRange(rgx,++index,alt,flags)
        break
      case '.':
        attribs = getAttribs(rgx.slice(index+1),flags)
        let chars = []
        if (!flags.dotAll) chars.push(10)
        alt.push({type:'range',isNegated:true,chars,ranges:[],...attribs})
        index += attribs.size
        break
      case '^':
        alt.push({type:'anchor',anchor:(flags.multiLine?anchorLineStart:anchorAbsStart)})
        break
      case '$':
        alt.push({type:'anchor',anchor:(flags.multiLine?anchorLineEnd:anchorAbsEnd)})
        break
      case '+':
      case '*':
      case '?':
        throw 'no quantifer here boi'
      default:
        if (flags.extended&&[9,10,11,12,13,32,133,160].includes(char.charCodeAt(0)))
          break // TODO: define whitespace: https://en.wikipedia.org/wiki/Whitespace_character
        attribs = getAttribs(rgx.slice(index+1),flags)
        alt.push({
          type: 'char',
          char,
          ...attribs
        })
        index += attribs.size
    }
  }
  if (noRunOut) throw 'unexpected end of input'
  return {alts,index:rgx.length}
}

function getCharClassCodes(char) {
  switch (char) {
    case 'w': return {ranges:[[48,57],[65,90],[97,122]],chars:[95]}
    case 'W': return {ranges:[[0,47],[58,64],[91,96],[123,256]],chars:[]}
    case 'd': return {ranges:[[48,57]],chars:[]}
    case 'D': return {ranges:[[0,47],[58,256]],chars:[]}
    case 'R': return {ranges:[[10-13]],chars:[133]}
    case 's': return {ranges:[[9,13]],chars:[32,133,160]}
    case 'S': return {ranges:[[0-8],[14,31],[33,132],[134,159],[161,255]],chars:[]}
    default: throw 'no such char class: '+char
  }
}

function dealWithRange(rgx,index,alt,flags) {
  // TODO check for overlapping ranges and chars to optimize speed
  let ranges = [], chars = []
  let isNegated = rgx.charAt(index) == '^'
  if (isNegated) index++
  while (index<rgx.length) {
    let char = rgx.charAt(index)
    if (char == '\\') {
      char = rgx.charAt(++index)
      if (!']-\\'.includes(char)) {
        let codes = getCharClassCodes(char)
        ranges.push(...codes.ranges)
        chars.push(...codes.chars)
        index++
        continue
      }
    } else {
      // not escaped
      if (char == ']') {
        let attribs = getAttribs(rgx.slice(index+1),flags)
        index += attribs.size
        alt.push({type:'range',ranges,chars,...attribs,isNegated})
        return index
      }
      if (rgx.charAt(index+1)=='-') {
        let endChar = rgx.charAt(index+=2)
        index++
        let r = [char.charCodeAt(0),endChar.charCodeAt(0)]
        if (r[1]<=[0]) throw 'char code of second must be larger'
        ranges.push(r)
        continue
      }
    }
    // single char
    chars.push(char.charCodeAt(0))
    index++
    continue
  }
  throw 'unexpected end of input in range'
}

function dealWithBackslash(rgx,index,alt,meta,flags) {
  let attribs
  switch (rgx.charAt(index)) {
    case 'g':
      // assume g{} notation
      let endIndex = index + rgx.slice(index).indexOf('}')
      let metaName = rgx.slice(index+2,endIndex)
      if ('123456789+-'.includes(metaName.charAt(0))) {
        if (metaName.charAt(0)=='+') throw 'no forward ref'
        let metaNr = parseFloat(metaName)
        if (!Number.isInteger(metaNr)||metaNr==0) throw 'failed'
        if (metaNr<0) {
          metaNr += meta.groupStart
          if (metaNr < 1) throw 'fak u'
        } else if (metaNr >= meta.groupStart) throw 'no forward ref'
        metaName = metaNr // maybe do this differently
      } else if (metaName.charAt(0) == '0') throw 'failed'
      index = endIndex
      attribs = getAttribs(rgx.slice(index),flags)
      index += attribs.size
      alt.push({
        type: 'backRef',
        reference:metaName,
        ...attribs
      })
      return index
    case 'A':
      if (getAttribs(rgx.slice(index),flags).size > 0) throw 'no quantifers on anchors'
      alt.push({type:'anchor',anchor:anchorAbsStart})
      return index
    case 'z':
      if (getAttribs(rgx.slice(index),flags).size > 0) throw 'no quantifers on anchors'
      alt.push({type:'anchor',anchor:anchorAbsEnd})
      return index
    case 'b':
      if (getAttribs(rgx.slice(index),flags).size > 0) throw 'no quantifers on anchors'
      alt.push({type:'anchor',anchor:anchorWordBoundary})
      return index
    case 'B':
      if (getAttribs(rgx.slice(index),flags).size > 0) throw 'no quantifers on anchors'
      alt.push({type:'anchor',anchor:anchorNotWordBoundary})
      return index
    default:
      if ('+*?^$\\.[]{}()|/'.includes(rgx.charAt(index))) {
        attribs = getAttribs(rgx.slice(index+1),flags)
        alt.push({type:'char',char:rgx.charAt(index),...attribs})
        return index + attribs.size
      }
      let ccc = getCharClassCodes(rgx.charAt(index))
      attribs = getAttribs(rgx.slice(index+1),flags)
      alt.push({type:'range',...ccc,...attribs})
      return index + attribs.size
  }
}

function anchorLineStart(prev,next){return''==prev||[10,11,12,13,133].includes(prev.charCodeAt(0))}
function anchorLineEnd(prev,next){return''==next||[10,11,12,13,133].includes(next.charCodeAt(0))}
function anchorAbsStart(prev,next){return''==prev}
function anchorAbsEnd(prev,next){return''==next}
function anchorNotWordBoundary(prev,next){return!anchorWordBoundary(prev,next)}
function anchorWordBoundary(prev,next){
  let c = prev.charCodeAt(0), c1 = next.charCodeAt(0)
  return (
    (
      (c >= 48 && c <= 57) ||
      (c >= 65 && c <= 90) ||
      (c >= 97 && c <= 122) ||
      c == 95
    ) && !(
      (c1 >= 48 && c1 <= 57) ||
      (c1 >= 65 && c1 <= 90) ||
      (c1 >= 97 && c1 <= 122) ||
      c1 == 95
    )
  )
}

function dealWithConditional(rgx,index,alt,meta,flags) {
  if (rgx.charAt(index) == '?') {
    throw 'loooooooooooooooook around my assss'
  }
  let endIndex = index + rgx.slice(index).indexOf(')')
  let metaName = rgx.slice(index,endIndex)
  if (metaName == 'DEFINE') { // define group
    let res = compile(rgx,endIndex+1,meta,{...flags},true)
    meta.defineAlts.push(...res.alts)
    return res.index
  }
  if ('123456789+-'.includes(metaName.charAt(0))) {
    if (metaName.charAt(0)=='+') throw 'no forward ref'
    let metaNr = parseFloat(metaName)
    if (!Number.isInteger(metaNr)||metaNr==0) throw 'failed'
    if (metaNr<0) {
      metaNr += meta.groupStart
      if (metaNr < 1) throw 'fak u'
    } else if (metaNr >= meta.groupStart) throw 'no forward ref'
    metaName = metaNr // maybe do this differently
  } else if (metaName.charAt(0) == '0') throw 'failed'
  let sub = compile(rgx,endIndex+1,meta,{...flags},true)
  index = sub.index
  let attribs = getAttribs(rgx.slice(index+1),flags)
  index += attribs.size
  if (sub.alts.length > 1) {
    if (sub.alts.length > 2) throw 'only one else clause'
    alt.push({type:'conditional',use:'backRef',group:metaName,clauses:sub.alts,...attribs})
    return index
  }
  alt.push({type:'conditional',use:'backRef',group:metaName,clauses:sub.alts,...attribs})
  return index
}

function dealWithGroup(rgx,index,alt,meta,flags) {
  let noCap = false, lookAround = false, lookAhead = true, noCompile = false, name = undefined, isAtomic = false
  if (rgx.charAt(index+1) == '?') {
    noCap = true
    let endIndex, metaNr
    switch (rgx.charAt(index+2)) {
      case '(': // conditional
        return dealWithConditional(rgx,index+3,alt,meta,flags)
      case '|':
        throw 'branch reset not supported'
      case '&': // subroutine by name reference
        let endIndex3 = index + 3 + rgx.slice(index+3).indexOf(')')
        let metaName = rgx.slice(index+3,endIndex3)
        if ('0123456789'.includes(metaName.charAt(0))) throw 'no digit plz'
        if (!metaName) throw 'zero-length name reference'
        attribs = getAttribs(rgx.slice(endIndex3+1),flags)
        index = endIndex3 + attribs.size
        alt.push({
          type:'group',metaCompile:'named-subroutine',metaName,...attribs
        })
        noCompile = true
        break
      case "'": // named group
        let endIndex2 = index + 3 + rgx.slice(index+3).indexOf("'")
        name = rgx.slice(index+3,endIndex2)
        if ('0123456789'.includes(name.charAt(0))) throw 'no digit plz'
        if (meta.namedGroups[name]) throw 'dupe name '+name
        index = endIndex2
        noCap = false
        break
      case '#': // comment
        noCompile = true
        index += 2 + rgx.slice(index+2).indexOf(')')
        break
      case ':': // non-capture
        index+=2
        break
      case '>': // atomic
        isAtomic = true
        index+=2
        break
      case '<': // lookbehind
        noCap = true
        lookAhead = false
        let char = rgx.charAt(index+=3)
        if (char == '!') lookAround = '-'
        else if (char == '=') lookAround = '+'
        else throw 'invalid thang'
        break
      case '=': // positive lookahead
        lookAround = '+'
        noCap = true
        index+=2
        break
      case '!': // negative lookahead
        lookAround = '-'
        noCap = true
        index+=2
        break
      case 'i': // flag modifier
      case 'm':
      case 's':
      case 'x':
      case 'U':
        return flagModifier(rgx,index+2,flags)
      case '-': // subroutine by relative numeric reference OR flag modifier
        if ('imsxU'.includes(rgx.charAt(index+3))) return flagModifier(rgx,index+2,flags)
      case '+':
        endIndex = index + 2 + rgx.slice(index+2).indexOf(')')
        metaNr = parseFloat(rgx.slice(index+2),endIndex)
        if (!Number.isInteger(metaNr)||meta.groupStart+metaNr<1||metaNr==0) throw 'failed'
        metaNr += meta.groupStart
        attribs = getAttribs(rgx.slice(endIndex+1),flags)
        index = endIndex + attribs.size
        alt.push({
          type:'group',isAtomic,metaCompile:'numeric-subroutine',metaNr,...attribs
        })
        noCompile = true
        break
      case '0': // subroutine by numeric reference
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        endIndex = index + 2 + rgx.slice(index+2).indexOf(')')
        metaNr = parseFloat(rgx.slice(index+2,endIndex))
        if (!Number.isInteger(metaNr)||metaNr<0) throw 'failed'
        attribs = getAttribs(rgx.slice(endIndex+1),flags)
        index = endIndex + attribs.size
        alt.push({
          type:'group',isAtomic,metaCompile:'numeric-subroutine',metaNr,...attribs
        })
        noCompile = true
        break
      default: throw 1
    }
  }
  if (!noCompile) {
    let nr = noCap ? undefined : meta.groupStart
    if (!noCap) meta.groupStart++
    let sub = compile(rgx,index+=1,meta,{...flags},true)
    index = sub.index
    let attribs = getAttribs(rgx.slice(index+1),flags)
    if (lookAround) {
      if (attribs.size) throw 'no quantifers on lookaround'
      alt.push({
        type: 'lookAround',
        lookAhead,
        positive: lookAround == '+',
        alts: sub.alts
      })
      return index
    }
    index += attribs.size
    let op
    alt.push(op = {
      type: 'group',
      alts: sub.alts,
      name,
      nr,
      ...attribs
    })
    meta.numericGroups[nr] = op
    if (name) meta.namedGroups[name] = op
  }
  return index
}

function flagModifier(rgx,index,flags) {
  while (rgx.charAt(index) != ')') {
    let val = true
    let f = rgx.charAt(index++)
    if (f == '-') {
      val = false
      f = rgx.charAt(index++)
    }
    if (f=='i') flags.ignoreCase = val
    else if (f=='m') flags.multiLine = val
    else if (f=='s') flags.dotAll = val
    else if (f=='x') flags.extended = val
    else if (f=='U') flags.ungreedy = val
    else throw 'invalid flag'
  }
  return index
}

function getAttribs(rgx,flags) {
  let size = 1
  let isLazy = false
  let isPossesive = false
  let min = 1, max = 1
  switch (rgx.charAt(0)) {
    case '*':
      min = 0
    case '+':
      max = Infinity
      break
    case '?':
      min = 0
      break
    case '{':
      let index = rgx.indexOf(',')
      size = rgx.indexOf('}')
      if (index == -1 || index > size) {
        min = max = parseFloat(rgx.slice(1,size))
      } else {
        min = parseFloat(rgx.slice(1,index))
        max = (size>index+1)?parseFloat(rgx.slice(index+1,size)):Infinity
      }
      if ( !Number.isInteger(min) || !(Number.isInteger(max)||max==Infinity) || min < 0 || min > max) throw 'wut:'+rgx
      size++
      break
    default:
      size = 0
  }
  if (size&&rgx.charAt(size)=='?') {
    isLazy = true
    size++
  } else if (size&&rgx.charAt(size)=='+') {
    isPossesive = true
    size++
  }
  if (flags.ungreedy) isLazy = !isLazy
  return {size,isLazy,isPossesive,min,max}
}

// Flatted is used for stringifying the regexes
/*! (c) 2018, Andrea Giammarchi, (ISC) */
var Flatted=function(a,l){return{parse:function(n,t){var e=JSON.parse(n,i).map(f),r=e[0],u=t||s,c="object"==typeof r&&r?function u(c,f,n,i){return Object.keys(n).reduce(function(n,t){var e=n[t];if(e instanceof a){var r=c[e];"object"!=typeof r||f.has(r)?n[t]=i.call(n,t,r):(f.add(r),n[t]=i.call(n,t,u(c,f,r,i)))}else n[t]=i.call(n,t,e);return n},n)}(e,new Set,r,u):r;return u.call({"":c},"",c)},stringify:function(n,e,t){for(var r,u=new Map,c=[],f=[],i=e&&typeof e==typeof c?function(n,t){if(""===n||-1<e.indexOf(n))return t}:e||s,a=+p(u,c,i.call({"":n},"",n)),o=function(n,t){if(r)return r=!r,t;var e=i.call(this,n,t);switch(typeof e){case"object":if(null===e)return e;case l:return u.get(e)||p(u,c,e)}return e};a<c.length;a++)r=!0,f[a]=JSON.stringify(c[a],o,t);return"["+f.join(",")+"]"}};function s(n,t){return t}function p(n,t,e){var r=a(t.push(e)-1);return n.set(e,r),r}function f(n){return n instanceof a?a(n):n}function i(n,t){return typeof t===l?new a(t):t}}(String,"string");
