
interface PatternFlags {
  ignoreCase:boolean,
  multiLine:boolean,
  dotAll:boolean,
  extended:boolean,
  ungreedy:boolean
}

interface PatternConfig {
  nativeOnly:boolean, // false
  lookBehindMode:'reverse'|'fixed-length'|'variable-length',
  allowRecursionDepthReferences:boolean, // false
  allowPositiveReferences:boolean, // true
  captureMode:'strict'|'truthy',
  flags:PatternFlags|string,
  overwriteCaptures:boolean, // true
  maxRunTime:number // Infinity
}

import {compiler} from './compiler'
import {run} from './exeTry2'

export class Pattern {

  string: string
  flags: string
  compiled: any

  constructor(pattern:any,cfg:PatternConfig|string) {
    this.string = pattern
    this.flags = ''
    if (typeof cfg == 'string') {
      this.flags = cfg
      cfg = {nativeOnly:false,lookBehindMode:'reverse',allowRecursionDepthReferences:false,allowPositiveReferences:true,captureMode:'strict',flags:'',overwriteCaptures:true,maxRunTime:Infinity}
    }
    cfg = <PatternConfig>cfg
    if (typeof cfg.flags == 'string') {
      let flagObj: PatternFlags = {ignoreCase:false,multiLine:false,dotAll:false,extended:false,ungreedy:false}
      for (let flag of cfg.flags.split('')) {
        let key: string
        switch (flag) {
          case 'i': key = 'ignoreCase'; break
          case 'm': key = 'multiLine'; break
          case 's': key = 'dotAll'; break
          case 'x': key = 'extended'; break
          case 'U': key = 'ungreedy'; break
          default: throw 'invalid flag'
        }
        if (flagObj[key]) throw 'lol'
        flagObj[key] = true
      }
    }
    this.compiled = compiler(pattern)
  }

  match(input) {
    return run(this.compiled,input)
  }

}
