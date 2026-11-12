// Run: node tests/piano.cjs (requires Playwright + Chromium).
// Optional PIANO_ASSETS points at a private folder containing piano/scores.json.
// Default fixtures are original synthetic notes; no scores or credentials are published.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
function blankPdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 1 /Kids [3 0 R] >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>','<< /Length 0 >>\nstream\n\nendstream'];
  let s = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((obj,i) => { offsets.push(Buffer.byteLength(s)); s += `${i+1} 0 obj\n${obj}\nendobj\n`; });
  const start = Buffer.byteLength(s); s += 'xref\n0 5\n0000000000 65535 f \n' + offsets.slice(1).map(n => `${String(n).padStart(10,'0')} 00000 n \n`).join('');
  return Buffer.from(s + `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
}
const notes = {v:1, inst:'piano', src:'piano', bpm:100, voices:3, voiceNames:['Melodija','Desna','Leva'], len:8, ev:[[0,1,72,0],[0,1,64,1],[0,2,48,2],[2,1,74,0],[2,1,65,1],[2,2,50,2],[4,1,76,0],[4,1,67,1],[4,2,52,2]]};
const fixture = {v:1,scores:Array.from({length:7},(_,i)=>({id:`piano-test-${i}`,title:`Piano test ${i}`,comp:'Test',info:'Synthetic test score.',pages:1,version:'one',pdf:`piano/scores/piano-test-${i}.pdf`,playback:`piano/scores/piano-test-${i}.json`,musicxml:`piano/scores/piano-test-${i}.musicxml`}))};
const assets = process.env.PIANO_ASSETS;
const manifest = assets ? JSON.parse(fs.readFileSync(path.join(assets,'piano/scores.json'))) : fixture;
const asset = p => assets ? fs.readFileSync(path.join(assets,p)) : p.endsWith('.pdf') ? blankPdf() : Buffer.from(JSON.stringify(notes));
const moduleContext = {createPiano:null}; vm.createContext(moduleContext); vm.runInContext(fs.readFileSync(path.join(root,'piano.js'),'utf8'),moduleContext);
const valid = moduleContext.createPiano({}).validPianoData;
assert(valid(notes));
for (const bad of [{...notes,ev:[[0,1,NaN,0]]},{...notes,ev:[[9,1,60,0]]},{...notes,ev:[[0,-1,60,0]]},{...notes,ev:[[0,1,60,4]]},{...notes,ev:[[2,1,60,0],[0,1,60,0]]}]) assert(!valid(bad));
for (const score of manifest.scores) assert(valid(JSON.parse(asset(score.playback))), score.id);

(async()=>{
 const server = http.createServer((req,res)=>{
   let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname); if(name==='/')name='/index.html';
   const file=path.join(root,name); if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
   fs.readFile(file,(err,data)=>{ if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.html')?'text/html':name.endsWith('.js')?'application/javascript':name.endsWith('.pdf')?'application/pdf':name.endsWith('.json')?'application/json':'application/octet-stream');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'localhost',r)); const base=`http://localhost:${server.address().port}`;
 const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})}); const errors=[];
 try {
   const context = await browser.newContext({viewport:{width:1280,height:900}});
   let failures = false; const requests=[];
   await context.route('https://api.github.com/**',async route=>{
     const p = decodeURIComponent(new URL(route.request().url()).pathname).split('/contents/')[1] || '';
     requests.push(p);
     if(p==='scores.json')return route.fulfill({json:[]});
     if(p==='piano/scores.json')return route.fulfill({json:manifest});
     if(p.startsWith('piano/scores/')){
       if(failures && p===manifest.scores[0].playback)return route.fulfill({json:{bad:true}});
       return route.fulfill({body:asset(p),contentType:p.endsWith('.pdf')?'application/pdf':'application/json'});
     }
     return route.fulfill({status:404,body:'not found'});
   });
   await context.route(/https:\/\/(fonts|cdnjs)\./,r=>r.abort());
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.click('#tab-piano');
   assert.match(await page.locator('#content').innerText(),/Poveži zbirko/);
   assert.equal(await page.locator('.piano-row').count(),0);
   // Settings fixture is a dummy token; requests are intercepted locally.
   await page.evaluate(()=>localStorage.setItem('pesmarica.meta',JSON.stringify({settings:{gh:{repo:'Poni-9/zbor-note',token:'test-token'},mute:[3],solo:2,zRep1:1,fsOff1:1,secDef1:1,autoFs:false}})));
   // Clear the boot-created meta record so the fixture is read on the next load.
   await page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('pesmarica',2);q.onsuccess=()=>{const t=q.result.transaction('meta','readwrite');t.objectStore('meta').delete('main');t.oncomplete=()=>{q.result.close();resolve();};t.onerror=reject;};}));
   failures=true;await page.reload();await page.click('#tab-piano');
   await page.waitForFunction(()=>document.querySelectorAll('.piano-row').length===6);
   assert.match(await page.locator('#content').innerText(),/Prenos ni popoln/);
   const dbItems=()=>page.evaluate(()=>new Promise(r=>{const q=indexedDB.open('pesmarica',2);q.onsuccess=()=>{const t=q.result.transaction(['docs','files']);const d=t.objectStore('docs').getAll();const f=t.objectStore('files').getAllKeys();t.oncomplete=()=>{r({docs:d.result,files:f.result});q.result.close();};};}));
   let stored=await dbItems();assert(!stored.files.includes(manifest.scores[0].id),'failed import must not leave an orphan PDF');
   failures=false;await page.click('[data-pianosync]');await page.waitForFunction(()=>document.querySelectorAll('.piano-row').length===7);
   assert.equal((await dbItems()).docs.filter(d=>d.piano).length,7);
   await page.click('[data-pianosync]');await page.waitForFunction(()=>!document.querySelector('[data-pianosync]').disabled);
   assert.equal((await dbItems()).docs.filter(d=>d.piano).length,7,'repeat sync is idempotent');
   await page.click('#tab-zbor');assert.equal(await page.locator('.piano-row').count(),0);
   await page.click('#tab-all');assert.equal(await page.locator('.piano-row').count(),0);
   assert.equal(await page.locator('#cnt-all').innerText(),'518');
   await page.click('#tab-piano');
   for (const [i,score] of manifest.scores.entries()) {
     await page.click(`[data-pianoplay="p:${score.id}"]`);
     await page.waitForFunction(()=>!document.querySelector('#spin').hidden===false && document.querySelectorAll('.pv canvas:not(.ink)').length>0);
     assert.equal(await page.locator('#playerbar').isVisible(),true);
     assert.equal(await page.locator('#pl-title').innerText(),score.title);
     assert.equal(await page.locator('[data-voice="0"]').innerText(),'Melodija');
     assert.equal(await page.locator('[data-voice="3"]').isVisible(),false);
     assert.equal(await page.locator('#pl-play').getAttribute('aria-label'),'Ustavi');
     await page.click('#pl-play');
     if(i===0){
       await page.click('[data-pianomode="melody"]');
       for(const v of [0,1,2])assert.equal(await page.locator(`[data-voice="${v}"]`).getAttribute('aria-pressed'),v===0?'true':'false');
       await page.click('[data-pianomode="all"]');
       for(const v of [0,1,2])assert.equal(await page.locator(`[data-voice="${v}"]`).getAttribute('aria-pressed'),'true');
       const prefs=await page.evaluate(()=>JSON.parse(localStorage.getItem('pesmarica.meta')).settings);assert.deepEqual(prefs.mute,[3]);assert.equal(prefs.solo,2);
       const bpm=+(await page.locator('#pl-bpm').innerText());await page.click('[data-bpm="4"]');assert.equal(+(await page.locator('#pl-bpm').innerText()),bpm+4);
       await page.click('[data-tr="1"]');assert.equal(await page.locator('#pl-tr').innerText(),'+1');
       await page.locator('#pl-seek').evaluate(el=>{el.value='4';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.locator('#pl-seek').inputValue(),'4');
     }
     await page.click('#r-back');
   }
   const first=manifest.scores[0];await page.click(`[data-fav="p:${first.id}"]`);await page.click('#tab-fav');assert.equal(await page.locator('.piano-row').count(),1);
   await page.fill('#q',first.title);await page.waitForTimeout(150);assert.equal(await page.locator('.piano-row').count(),1);
   await page.click('#qclear');await page.click('#tab-piano');await page.fill('#q','no such piano score');await page.waitForTimeout(150);assert.equal(await page.locator('.piano-row').count(),0);await page.click('#qclear');
   await page.setViewportSize({width:393,height:852});await page.screenshot({path:process.env.PIANO_SCREENSHOT||'/tmp/piano-mobile.png',fullPage:true});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.click(`[data-pianoplay="p:${first.id}"]`);await page.click('#pl-play');
   for(const selector of ['#pl-piano-modes','[data-voice="0"]','[data-voice="2"]']){const box=await page.locator(selector).boundingBox();assert(box.x>=0 && box.x+box.width<=394 && box.y+box.height<=852,selector+' mobile bounds');}
   await page.screenshot({path:'/tmp/piano-player-mobile.png'});await page.click('#r-back');
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   await context.setOffline(true);await page.reload();await page.click('#tab-piano');assert.equal(await page.locator('.piano-row').count(),7);
   await page.click(`[data-pianoplay="p:${first.id}"]`);await page.waitForFunction(()=>document.querySelectorAll('.pv canvas:not(.ink)').length>0);assert.equal(await page.locator('#pl-play').getAttribute('aria-label'),'Ustavi');
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({passed:true,collection:assets?'private seven scores':'synthetic seven scores',scores:7,offline:true,atomicImport:true,playback:true,mobile:true,errors}));
   await context.close();
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
