// Run with: node tests/statistics.cjs (no dependencies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const elements = {};
for (const id of html.matchAll(/id="([^"]+)"/g)) elements[id[1]] = {value:'', innerHTML:'', textContent:''};
Object.assign(elements.M, {value:'20'});
Object.assign(elements.simC, {value:'20'});
elements.speed.value = '200';
const ctx = new Proxy({}, {get:(o,k)=>o[k] || ((...args)=>{
  for (const a of args) if(typeof a === 'number') assert.ok(Number.isFinite(a), 'finite canvas coordinates');
})});
Object.assign(elements.chart, {width:980,height:420,getContext:()=>ctx});
let rows = [], alerts = [], stopped = 0;
function setRows(pairs){
  rows = pairs.map(([C,R])=>{
    const cells = {'.cInput':{value:String(C)}, '.rInput':{value:String(R)}, '.idx':{}, '.estCell':{}, '.avgCell':{}};
    return {querySelector:k=>cells[k]};
  });
}
const math = Object.create(Math);
const app = {document:{getElementById:id=>elements[id],querySelectorAll:()=>rows}, Math:math,
 alert:s=>alerts.push(s),confirm:()=>true,setInterval:()=>1,clearInterval:()=>stopped++};
vm.createContext(app);
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], app);
for(const value of ['', ' ', '-3', '2.5', 'abc12', '1e2','Infinity','9007199254740992']) assert.ok(Number.isNaN(app.toNum(value)),value);
assert.equal(app.toNum(' 0 '),0);
setRows([[20,''],[20,5]]);
assert.equal(app.getEstimatedP().p,.25); // Blank must not halve p.
setRows([[20,0],[20,5],[20,21],[10,11],[20,'-1']]);
assert.equal(app.getEstimatedP().p,.125);
assert.equal(app.getStudentRecords().length,2);
app.updateAll();
assert.equal(elements.avgText.innerHTML,'80.0');
assert.match(elements.pooledText.textContent,/160.0/);
assert.match(elements.resultBody.innerHTML,/R=0/);
setRows([[20,0]]);
app.simulateMany(100);
assert.equal(app.simRecords.length,100);
assert.ok(app.simRecords.every(r=>r.R===0 && r.est===null));
assert.equal(elements.avgText.innerHTML,'-');
elements.showReal.checked=true; elements.realN.value='90'; app.updateAll();
app.clearSimulation();
setRows([[20,20]]);
app.simulateMany(10);
assert.ok(app.simRecords.every(r=>r.R===20 && r.est===20));
// Deterministically force a zero outcome at interior p; exactly C draws, no retries.
app.clearSimulation(); setRows([[20,5]]);
let draws=0; math.random=()=>{draws++;return .99;};
const zero=app.simulateRecord(); assert.equal(zero.R,0); assert.equal(draws,20);
app.simRecords.push(zero);
app.startSim(); elements.M.value='30'; app.dataChanged();
assert.equal(app.timer,null); assert.ok(stopped>0);
assert.equal(app.simRecords.length,1); assert.equal(app.simRecords[0].MUsed,20);
assert.equal(elements.simCount.innerHTML,0);
assert.match(elements.resultBody.innerHTML,/舊模擬 M=20/);
assert.equal(app.simulateRecord(),null);
app.clearSimulation(); assert.equal(app.simStale,false);
for(const value of ['', '0', '-1', '2.5', '100001']){
 elements.simC.value=value; assert.equal(app.simulateRecord(),null);
}
elements.simC.value='20';
// Seeded binomial distribution check: P(R=0)=.9^5 and E[R]=.5.
let seed=42; math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
setRows([[20,2]]); elements.simC.value='5';
let zeros=0,total=0;
for(let i=0;i<20000;i++){const r=app.simulateRecord().R; total+=r;if(r===0) zeros++;}
assert.ok(Math.abs(zeros/20000-Math.pow(.9,5))<.015);
assert.ok(Math.abs(total/20000-.5)<.02);
app.drawChart([null,80,80,100],2);
app.drawChart([null,null],1);
console.log('PASS: input boundaries, pooled estimate, endpoint p, retained zeros, no redraw bias, stale history, timer stop, finite chart coordinates.');
