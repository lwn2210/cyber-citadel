// PLAYWRIGHT_MODULE_PATH=/path/to/playwright node tests/tower-browser.cjs output.json
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {once}=require('node:events');
(async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const report={attempted:0,passed:0,failed:0,blocked:0,scenarios:[]};let browser;
 const server=http.createServer((req,res)=>{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return}
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
  // Test-only exposure; normal UI pages receive exact unmodified HTML.
  res.end(req.url==='/targeting'?html.replace('  requestAnimationFrame(loop);\n})();',`  window.testGame={Tower,setCreeps:value=>{creeps=value}};\n})();`):html);
 });server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for(const mode of ['desktop','mobile','targeting']){
   const result={mode,pageErrors:[],consoleErrors:[]};report.attempted++;
   const page=await browser.newPage(mode==='mobile'?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1024,height:900}});
   page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())});
   try{
    await page.addInitScript(()=>{
     const arc=CanvasRenderingContext2D.prototype.arc;window.rangeArcs=[];
     CanvasRenderingContext2D.prototype.arc=function(x,y,r,...rest){window.rangeArcs.push(r);if(window.rangeArcs.length>2000)window.rangeArcs.splice(0,1000);return arc.call(this,x,y,r,...rest)};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/${mode==='targeting'?'targeting':''}`);
    if(mode==='targeting'){
     result.observed=await page.evaluate(()=>{
      const {Tower}=window.testGame;const a=new Tower('laser',0,0),b=new Tower('laser',0,0);
      const dead={x:a.x+10,y:a.y,hp:18},living={x:a.x+20,y:a.y,hp:100};
      a.update(0,[dead,living]);b.update(0,[dead,living]);
      return {deadHp:dead.hp,livingHp:living.hp,targetsLiving:b.target===living};
     });assert.deepEqual(result.observed,{deadHp:0,livingHp:82,targetsLiving:true});
    }else{
     await page.locator('#btn-start').click();await page.locator('[data-type="laser"]').click();
     const box=await page.locator('#cv').boundingBox();const point={x:box.x+box.width*725/800,y:box.y+box.height*216.3/600};
     await page.mouse.move(point.x,point.y);await page.waitForFunction(()=>window.rangeArcs.includes(120));
     await page.locator('#cv').tap({position:{x:box.width*725/800,y:box.height*216.3/600}}).catch(async()=>page.mouse.click(point.x,point.y));
     await page.mouse.click(point.x,point.y);
     await page.locator('#inspector').waitFor({state:'visible'});
     await page.locator('#btn-upgrade').click();await page.locator('#btn-upgrade').click();
     await page.waitForFunction(()=>window.rangeArcs.includes(160));
     result.sellLabel=await page.locator('#btn-sell').textContent();
     await page.locator('#btn-sell').click();result.credits=await page.locator('#hud-credits').textContent();
     assert.equal(result.sellLabel,'SELL ($238)');assert.equal(result.credits,'298');
     assert.equal(await page.locator('#inspector').isVisible(),false);
     assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.consoleErrors,[]);result.state='passed';report.passed++;
   }catch(e){result.state='failed';result.failure=String(e);report.failed++;process.exitCode=1}
   await page.close();report.scenarios.push(result);
  }
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))}
})().catch(e=>{console.error(e);process.exitCode=1});
