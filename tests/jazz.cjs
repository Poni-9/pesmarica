// Run: node tests/jazz.cjs (requires Playwright + Chromium). Uses the real public files in jazz/.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const ctx = { createPiano: null }; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(root, 'piano.js'), 'utf8'), ctx);
const valid = ctx.createPiano({}).validPianoData;

console.log('Checking files');
const index = JSON.parse(fs.readFileSync(path.join(root, 'jazz/index.json')));
const total = index.scores.length;
assert.equal(total, 234);
assert.equal(new Set(index.scores.map(s => s.id)).size, total);
for (const s of index.scores) {
  const pdf = fs.readFileSync(path.join(root, 'jazz/pdf', s.id + '.pdf'));
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-', s.id);
  assert.equal(pdf.length, s.size, s.id);
  const d = JSON.parse(fs.readFileSync(path.join(root, 'jazz/play', s.id + '.json')));
  assert(valid(d), s.id);
  assert(d.ev.some(e => e[3] === 0) && d.ev.some(e => e[3] === 1) && d.ev.some(e => e[3] === 2), s.id + ' has melody, chords and bass');
  assert(s.freeSince, s.id + ' has copyright status');
}
assert.equal(fs.readdirSync(path.join(root, 'jazz/pdf')).length, total);
assert.equal(fs.readdirSync(path.join(root, 'jazz/play')).length, total);

(async () => {
  const server = http.createServer((req, res) => {
    let name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); if (name === '/') name = '/index.html';
    const file = path.join(root, name); if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404).end(); return; } res.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.js') ? 'application/javascript' : name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.json') ? 'application/json' : 'application/octet-stream'); res.end(data); });
  });
  await new Promise(r => server.listen(0, 'localhost', r)); const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('https://api.github.com/**', r => r.fulfill({ status: 404, body: 'not found' }));
    await context.route(/https:\/\/(fonts|cdnjs)\./, r => r.abort());
    const page = await context.newPage(); page.setDefaultTimeout(30000);
    page.on('pageerror', e => { errors.push(e.message); console.error('Page error:', e.message); });
    const dbDocs = () => page.evaluate(() => new Promise(r => { const q = indexedDB.open('pesmarica', 2); q.onsuccess = () => { const t = q.result.transaction(['docs', 'files']); const d = t.objectStore('docs').getAll(); const f = t.objectStore('files').getAllKeys(); t.oncomplete = () => { r({ docs: d.result.filter(x => x.jazz).length, files: f.result.filter(k => /^pdsa-/.test(k)).length }); q.result.close(); }; }; }));

    console.log('Checking jazz list');
    await page.goto(base); await page.click('#tab-jazz');
    await page.waitForFunction(n => document.querySelectorAll('.jazz-row').length === n, total);
    assert.equal(await page.locator('#cnt-jazz').innerText(), String(total));
    assert.match(await page.locator('#content').innerText(), /Public Domain Song Anthology/);
    await page.click('#tab-all'); assert.equal(await page.locator('.jazz-row').count(), 0);
    assert.equal(await page.locator('#cnt-all').innerText(), '518', 'hymnbook catalogue unchanged');
    await page.click('#tab-piano'); assert.equal(await page.locator('.jazz-row').count(), 0);
    await page.click('#tab-jazz');
    await page.fill('#q', 'saints'); await page.waitForTimeout(150);
    assert.equal(await page.locator('.jazz-row').count(), 1);
    await page.click('#qclear');

    console.log('Checking open and playback');
    const twoPages = index.scores.find(s => s.pages === 2);
    for (const s of [index.scores[0], twoPages, index.scores.find(x => x.id === 'pdsa-when-the-saints-go-marching-in')]) {
      console.log('Opening', s.id);
      await page.click(`[data-jazzplay="j:${s.id}"]`);
      await page.waitForFunction(() => document.querySelector('#spin').hidden && document.querySelectorAll('.pv canvas:not(.ink)').length > 0);
      assert.equal(await page.locator('#pl-title').innerText(), s.title);
      assert.deepEqual(await page.locator('[data-voice]:visible').allInnerTexts(), ['Melodija', 'Akordi', 'Bas']);
      assert.equal(await page.locator('#pl-play').getAttribute('aria-label'), 'Ustavi');
      assert.match(await page.locator('#pl-src').innerText(), /Jazz/);
      const t0 = await page.locator('#pl-time').innerText(); await page.waitForTimeout(1300);
      assert.notEqual(await page.locator('#pl-time').innerText(), t0, 'clock advances while playing');
      await page.click('#pl-play'); await page.click('#r-back');
    }
    assert.equal((await dbDocs()).docs, 3, 'opened songs are stored');

    console.log('Checking favorites');
    await page.click(`[data-fav="j:${index.scores[5].id}"]`); await page.click('#tab-fav');
    assert.equal(await page.locator('.jazz-row').count(), 1);
    await page.click('.jazz-row .row-main');
    await page.waitForFunction(() => document.querySelector('#spin').hidden && document.querySelectorAll('.pv canvas:not(.ink)').length > 0);
    await page.click('#r-back');

    console.log('Checking save all');
    await page.click('#tab-jazz'); await page.click('[data-jazzsync]');
    await page.waitForFunction(() => /shranjenih za uporabo brez interneta/.test(document.querySelector('#content').innerText), null, { timeout: 180000 });
    assert.deepEqual(await dbDocs(), { docs: total, files: total });

    console.log('Checking phone layout');
    await page.setViewportSize({ width: 393, height: 852 }); await page.click('#tab-jazz');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: process.env.JAZZ_SCREENSHOT || '/tmp/jazz-mobile.png' });

    console.log('Checking offline restart');
    await page.evaluate(() => navigator.serviceWorker.ready); await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true); await page.reload(); await page.click('#tab-jazz');
    await page.waitForFunction(n => document.querySelectorAll('.jazz-row').length === n, total);
    const last = index.scores[total - 1];
    await page.click(`[data-jazzplay="j:${last.id}"]`);
    await page.waitForFunction(() => document.querySelectorAll('.pv canvas:not(.ink)').length > 0);
    assert.equal(await page.locator('#pl-play').getAttribute('aria-label'), 'Ustavi');
    await page.screenshot({ path: '/tmp/jazz-player-mobile.png' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, songs: total, playback: true, saveAll: true, offline: true, mobile: true, errors }));
    await context.close();
  } finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
