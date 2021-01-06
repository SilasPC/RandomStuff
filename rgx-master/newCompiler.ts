
enum MatchType {
  GREEDY,
  LAZY,
  POSSESIVE
}

enum GroupType {
  CAPTURE,
  NO_CAPTURE,
  BRANCH_RESET,
  ATOMIC,
  DEFINITION,
}

enum AtomType {
  RANGE,
  GROUP,
  MODE_MOD
}

interface Atom {
  type: AtomType,
  min: number,
  max: number,
  matchType: MatchType
}

interface ModeMod extends Atom {
  type: AtomType.MODE_MOD,
  content: string
}

interface Range extends Atom {
  type: AtomType.RANGE,
  content: string
}

interface Group extends Atom {
  type: AtomType.GROUP,
  groupType: GroupType,
  alts: (string|Atom)[]
}
