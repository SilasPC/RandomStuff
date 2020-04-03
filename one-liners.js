let matrixMult = (m1,m2) => Array(m1.length).fill(0).map((_,i)=>Array(m1.length).fill(0).map((_,j)=>m1[i].reduce((a,v,k)=>a+v*m2[k][j],0)))
let getSubsets = (a,l) => a.reduce((a,c)=>a.concat(a.map(b=>[...b, c])),[[]]).filter(a=>a.reduce((a,v)=>a+v,0)==l).map(s=>s.sort((a,b)=>a-b)).sort((a,b)=>(l=a.length-b.length)?l:a.reduce((t,v,i)=>t?t:(t=v-b[i])?t:0,0))
let pat = (a,b) => [[a,b],[b,a]].every(([a,b])=>Object.values(a.split('').reduce((m,l,i)=>[m[l]?m[l].push(b[i]):m[l]=[b[i]],m][1],{})).every(i=>i.every((v,_,r)=>v==r[0])))
let type = (n,p,x) => !n.includes(x)?'Not exist':!p.includes(x)?'Leaf':p[n.indexOf(x)]+1?'Inner':'Root'
