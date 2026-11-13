const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function loadGame(){
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const code=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('  requestAnimationFrame(loop);\n})();',`  window.testGame={Tower,TOWER_TYPES,setCreeps:value=>{creeps=value},setCredits:value=>{credits=value},getCredits:()=>credits};\n})();`);
 const element={addEventListener(){},classList:{add(){},remove(){}},getContext(){return {}},dataset:{}};
 const context={window:{},document:{getElementById:()=>element,querySelectorAll:()=>[]},performance:{now:()=>0},Math,requestAnimationFrame(){}};
 vm.runInNewContext(code,context);
 return context.window.testGame;
}
test('refund includes both upgrade investments, and max level cannot spend more',()=>{
 const game=loadGame();game.setCredits(1000);const t=new game.Tower('laser',0,0);
 assert.equal(t.upgrade(),true);assert.equal(t.upgrade(),true);assert.equal(t.upgrade(),false);
 assert.equal(game.getCredits(),760);assert.equal(t.totalInvested,340);assert.equal(t.sell(),238);assert.equal(game.getCredits(),998);
});
test('all tower refunds match the integer 70 percent at every level',()=>{
 const game=loadGame();
 for(const type of Object.keys(game.TOWER_TYPES)){
  for(let level=1;level<=3;level++){
   game.setCredits(10000);const t=new game.Tower(type,0,0);
   for(let i=1;i<level;i++)assert.equal(t.upgrade(),true);
   assert.equal(t.sell(),Math.floor(t.totalInvested*7/10),`${type} level ${level}`);
  }
 }
});
test('unaffordable upgrades leave credits, investment and level unchanged',()=>{
 const game=loadGame();game.setCredits(0);const t=new game.Tower('laser',0,0);
 assert.equal(t.upgrade(),false);assert.equal(t.level,1);assert.equal(t.totalInvested,100);assert.equal(game.getCredits(),0);
});
test('laser selects nearest living target at range edge, not a farther out-of-range creep',()=>{
 const game=loadGame();const t=new game.Tower('laser',0,0);
 const edge={x:t.x+t.rng,y:t.y,hp:100};const out={x:t.x+t.rng+1,y:t.y,hp:100};
 t.update(0,[out,edge]);assert.equal(t.target,edge);assert.equal(edge.hp,82);assert.equal(out.hp,100);
});
test('Tesla chain skips dead creeps instead of spending a hop on them',()=>{
 const game=loadGame();const t=new game.Tower('tesla',0,0);
 const first={x:t.x+10,y:t.y,hp:100},dead={x:t.x+20,y:t.y,hp:0};
 const next={x:t.x+130,y:t.y,hp:100},last={x:t.x+140,y:t.y,hp:100};
 const creeps=[first,dead,next,last];game.setCreeps(creeps);t.update(0,creeps);
 assert.equal(first.hp,60);assert.equal(dead.hp,0);assert.equal(next.hp,68);assert.equal(last.hp,68);
});
test('a second laser must not waste its shot on a creep killed earlier in the same frame',()=>{
 const game=loadGame();const a=new game.Tower('laser',0,0),b=new game.Tower('laser',0,0);
 const near={x:a.x+10,y:a.y,hp:18};const living={x:a.x+20,y:a.y,hp:100};
 a.update(0,[near,living]);assert.equal(near.hp,0);
 b.update(0,[near,living]);assert.equal(b.target,living);assert.equal(living.hp,82);assert.equal(near.hp,0);
});
