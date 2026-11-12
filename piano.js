'use strict';
/* Private piano collection; dependencies come from the hymnbook application. */
function createPiano({ S, DB, songDoc, esc, ICON_PLAY, ICON_STAR, ghCfg, norm, coll, gh, render, memFiles, pdfCache, buildSongs, toast, audio, openSong, openPlayer, PL, plStart, voicePrefs, saveMeta, plRestartIfPlaying, showChrome }) {
/* Klavir shares the PDF reader and synthesizer, with its own private score collection. */
const PIANO = { syncing: false, progress: '', error: '', total: 0 };
const isPiano = s => s && s.src === 'piano';
const pianoDocs = () => S.docs.filter(d => d.piano);
const pianoSong = d => S.songs.find(s => s.key === 'p:' + d.id);
const pianoPath = path => typeof path === 'string' && /^piano\/scores\/[a-z0-9-]+\.(pdf|json|musicxml)$/.test(path);
function validPianoData(d) {
  return !!(d && d.v === 1 && d.inst === 'piano' && d.voices === 3 && Number.isFinite(d.bpm) && d.bpm >= 30 && d.bpm <= 200 && Number.isFinite(d.len) && d.len > 0 && d.len < 100000 && Array.isArray(d.ev) && d.ev.length && d.ev.length < 200000 && d.ev.every((e, i) => Array.isArray(e) && e.length === 4 && e.every(Number.isFinite) && e[0] >= 0 && e[1] > 0 && e[0] + e[1] <= d.len + .001 && Number.isInteger(e[2]) && e[2] >= 21 && e[2] <= 108 && Number.isInteger(e[3]) && e[3] >= 0 && e[3] <= 2 && (!i || d.ev[i-1][0] <= e[0])));
}
function pianoRow(s) {
  const d = songDoc(s), fav = S.favs.has(s.key);
  return `<li class="row piano-row"><button class="row-main" data-open="${esc(s.key)}"><span class="num" aria-hidden="true">♪</span><span class="tt"><b>${esc(s.title)}</b><span>${esc(s.comp)} · ${d.pages} ${d.pages === 1 ? 'stran' : 'strani'}</span><span class="piano-info">${esc(d.info || '')}</span></span></button><button class="star" data-pianoplay="${esc(s.key)}" aria-label="Zaigraj ${esc(s.title)}">${ICON_PLAY}</button><button class="star" data-fav="${esc(s.key)}" aria-pressed="${fav}" aria-label="${fav ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}">${ICON_STAR(fav)}</button></li>`;
}
function pianoHtml() {
  const docs = pianoDocs(), connected = !!ghCfg().token, q = norm(S.q || '');
  const list = docs.map(pianoSong).filter(Boolean).filter(s => !q || q.split(' ').every(t => (s.n + ' ' + s.cn).includes(t))).sort((a,b) => coll.compare(a.title,b.title));
  let h = `<div class="section-head"><h2>Klavir<em>${docs.length}</em></h2></div><p class="hint-p">Odpri note ali tapni ▸ za poslušanje. V predvajalniku izberi samo melodijo ali vadi posamezno roko. Prenesene skladbe delujejo tudi brez interneta.</p><div class="zb-add"><button class="btn primary" data-pianosync ${PIANO.syncing ? 'disabled' : ''}>${PIANO.syncing ? 'Prenašam …' : 'Prenesi note in melodije'}</button><button class="btn" data-zsetup>${connected ? 'Povezava z zbirko' : 'Poveži zbirko'}</button></div>`;
  if (!connected) h += `<div class="notice"><p>Klavir uporablja isto zasebno zbirko kot Zbor. Poveži jo z gumbom »Poveži zbirko«. Če Zbor že deluje, uporabi njegovo obstoječo povezavo.</p></div>`;
  if (PIANO.progress) h += `<p class="hint-p" role="status">${esc(PIANO.progress)}</p>`;
  if (PIANO.error) h += `<div class="notice" role="alert"><p>${esc(PIANO.error)}</p></div>`;
  if (!docs.length && !PIANO.syncing) h += `<div class="empty"><strong>Note za klavir še niso prenesene</strong>Tapni »Prenesi note in melodije«. PDF in melodija se shranita skupaj.</div>`;
  else if (!list.length && q) h += '<div class="empty">Ni zadetkov.</div>';
  else h += `<ul class="list">${list.map(pianoRow).join('')}</ul>`;
  return h;
}
async function pianoResponse(path) {
  const r = await gh('contents/' + path, { raw: true, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Povezava nima dostopa do zbirke. Preveri povezavo, ki jo uporablja Zbor.' : r.status === 404 ? 'Klavirskih datotek v povezani zbirki ni. Preveri, da je izbrana ista zbirka kot za Zbor.' : 'Prenos ni uspel (GitHub ' + r.status + '). Poskusi znova.');
  return r;
}
async function pianoSync(manual = false) {
  if (PIANO.syncing) return;
  PIANO.error = '';
  if (!ghCfg().token || !ghCfg().repo) { if (manual) { PIANO.error = 'Najprej poveži zasebno zbirko z gumbom »Poveži zbirko«.'; render(); } return; }
  if (!navigator.onLine) { if (manual) { PIANO.error = 'Za prvi prenos potrebuješ internet. Že prenesene skladbe lahko odpreš.'; render(); } return; }
  PIANO.syncing = true; PIANO.progress = 'Preverjam zbirko …'; if (S.tab === 'piano') render();
  let added = 0, failed = 0;
  try {
    const pack = await (await pianoResponse('piano/scores.json')).json();
    if (pack.v !== 1 || !Array.isArray(pack.scores) || pack.scores.length > 1000) throw new Error('Seznam klavirskih skladb ni veljaven.');
    const ids = new Set();
    for (const it of pack.scores) {
      if (!it || !/^piano-[a-z0-9-]+$/.test(it.id) || ids.has(it.id) || typeof it.title !== 'string' || !it.title.trim() || !Number.isInteger(it.pages) || it.pages < 1 || it.pages > 200 || typeof it.version !== 'string' || !pianoPath(it.pdf) || !pianoPath(it.playback) || !pianoPath(it.musicxml)) throw new Error('Seznam klavirskih skladb vsebuje neveljaven zapis.');
      ids.add(it.id);
    }
    PIANO.total = pack.scores.length;
    for (const [i,it] of pack.scores.entries()) {
      PIANO.progress = `${i + 1}/${pack.scores.length} · ${it.title}`; if (S.tab === 'piano') render();
      const old = S.docs.find(d => d.id === it.id);
      if (old && !old.piano) { failed++; continue; }
      if (old && old.version === it.version && validPianoData(old.playback) && await DB.get('files', it.id)) continue;
      try {
        const [pr, nr] = await Promise.all([pianoResponse(it.pdf), pianoResponse(it.playback)]);
        const [blob, data] = await Promise.all([pr.blob(), nr.json()]);
        if (!validPianoData(data) || await blob.slice(0,5).text() !== '%PDF-') throw new Error('Neveljaven PDF ali zapis melodije.');
        data.src = 'piano'; data.voiceNames = ['Melodija','Desna','Leva'];
        const file = new File([blob], it.title + '.pdf', { type: 'application/pdf' });
        const doc = { id: it.id, name: it.title, comp: it.comp || '', info: it.info || '', pages: it.pages, size: file.size, book: null, songs: [], status: 'ready', added: old?.added || Date.now(), piano: true, version: it.version, playback: data, musicxml: it.musicxml };
        // PDF and playback become visible together; a failed write leaves the old score intact.
        await DB.batch([{ store:'files', key:doc.id, value:file }, { store:'docs', key:doc.id, value:doc }]);
        if (old) Object.assign(old, doc); else S.docs.push(doc);
        memFiles.set(doc.id,file); pdfCache.delete(doc.id); S.notes['p:' + doc.id] = data; added++;
      } catch (err) { failed++; PIANO.error = err.name === 'QuotaExceededError' ? 'Na napravi ni dovolj prostora za vse skladbe.' : err.message || 'Nekaterih skladb ni bilo mogoče prenesti.'; }
    }
    buildSongs();
    PIANO.progress = failed ? `Prenos ni popoln: ${failed} ${failed === 1 ? 'skladba ni prenesena' : 'skladb ni prenesenih'}. Tapni »Prenesi note in melodije« za ponovni poskus.` : `${pianoDocs().length} skladb je pripravljenih za igranje in uporabo brez interneta.`;
    if (manual && !failed) toast(added ? `Prenesenih skladb za klavir: ${added}` : 'Klavirske note so že posodobljene.');
  } catch (err) { PIANO.error = err.name === 'TimeoutError' ? 'Povezava je prepočasna. Poskusi prenos znova.' : err.message || 'Zbirke ni bilo mogoče prenesti.'; PIANO.progress = ''; }
  finally { PIANO.syncing = false; if (S.tab === 'piano') render(); }
}
function pianoPlay(key) {
  const s = S.songs.find(x => x.key === key && isPiano(x)); if (!s) return;
  audio(); openSong(s); openPlayer(s); PL.pos = 0; if (PL.data) plStart(0);
}
function pianoMode(mode) {
  const prefs = voicePrefs(); prefs.mute = mode === 'melody' ? [1,2] : []; prefs.solo = null;
  saveMeta(); plRestartIfPlaying(); showChrome();
}

return { PIANO, isPiano, pianoDocs, validPianoData, pianoRow, pianoHtml, pianoSync, pianoPlay, pianoMode };
}
