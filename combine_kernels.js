
function combine(ks) {
  let _ = Math.floor
  let [rx,ry] = ks.reduce(([sx,sy],[,k])=>[sx+_(k[0].length/2),sy+_(k.length/2)],[0,0])
  let F = ks.reduce((s,[v])=>s*v,1)
  let K = new Array(ry*2+1).fill(0).map(()=>new Array(rx*2+1).fill(0))
  if (F != 0) T(ks)
  function T([...nks],cx=rx,cy=ry,cf=1) {
    if (cf == 0) return
    let k = nks.pop()
    let rx = _(k[1][0].length/2),
        ry = _(k[1].length/2)
    for (let dx = -rx; dx <= rx; dx++)
    for (let dy = -ry; dy <= ry; dy++) {
      let f = k[1][dy+ry][dx+rx] * cf
      if (nks.length) T(nks,cx+dx,cy+dy,f)
      else K[cy+dy][cx+dx] += f
    }
  }
  return [F,K]
}
