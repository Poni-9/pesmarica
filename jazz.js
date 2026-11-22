'use strict';
/* Jazz: javne note (The Public Domain Song Anthology, CC0; v SI prosto) iz mape jazz/ te strani.
   Uporablja isti bralnik PDF in isti klavirski predvajalnik kot Klavir. */
function createJazz({ S, DB, songDoc, esc, ICON_PLAY, ICON_STAR, norm, coll, render, memFiles, pdfCache, buildSongs, toast, audio, openSong, openPlayer, PL, plStart, validPianoData, LS }) {
const JAZZ = { list: null, src: null, loading: null, syncing: false, progress: '', error: '', busy: new Set() };
const isJazz = s => s && s.src === 'jazz';
const jazzDocs = () => S.docs.filter(d => d.jazz);
const ID = /^pdsa-[a-z0-9-]+$/;
function validIndex(p) {
  return !!(p && p.v === 1 && Array.isArray(p.scores) && p.scores.length && p.scores.length < 2000 && p.scores.every(x => x && ID.test(x.id) && typeof x.title === 'string' && x.title.trim() && Number.isInteger(x.pages) && x.pages >= 1 && x.pages <= 50));
}
function useIndex(p) { JAZZ.list = p.scores; JAZZ.src = p.source || null; JAZZ.version = p.version || ''; }
/* seznam se prebere iz omrežja; zadnji uspešni ostane v napravi za delo brez interneta */
function jazzLoad(force) {
  if (JAZZ.list && !force) return Promise.resolve(JAZZ.list);
  if (JAZZ.loading) return JAZZ.loading;
  if (!JAZZ.list) { const saved = LS.get('jazzIndex', null); if (validIndex(saved)) useIndex(saved); }
  JAZZ.loading = (async () => {
    try {
      const r = await fetch('jazz/index.json', { cache: 'no-cache' }); if (!r.ok) throw new Error('http ' + r.status);
      const p = await r.json(); if (!validIndex(p)) throw new Error('Seznam jazz skladb ni veljaven.');
      useIndex(p); LS.set('jazzIndex', p); JAZZ.error = '';
    } catch (err) { if (!JAZZ.list) JAZZ.error = navigator.onLine ? 'Seznama jazz skladb ni bilo mogoče naložiti.' : 'Za prvi prikaz seznama potrebuješ internet.'; }
    finally { JAZZ.loading = null; }
    buildSongs(); render();
    return JAZZ.list;
  })();
  return JAZZ.loading;
}
/* pesmi za iskalnik in priljubljene: vse s seznama, tudi še neprenesene */
function jazzSongs() {
  const out = [], seen = new Set();
  for (const it of JAZZ.list || []) { seen.add(it.id); out.push({ key: 'j:' + it.id, num: '', title: it.title, comp: it.comp || '', docId: it.id, book: null, page: 1, y: 0, src: 'jazz', jz: it }); }
  for (const d of jazzDocs()) if (!seen.has(d.id)) out.push({ key: 'j:' + d.id, num: '', title: d.name, comp: d.comp || '', docId: d.id, book: null, page: 1, y: 0, src: 'jazz', jz: null });
  for (const d of jazzDocs()) if (validPianoData(d.playback)) S.notes['j:' + d.id] = d.playback;
  return out;
}
function jazzRow(s) {
  const d = songDoc(s), it = s.jz || {}, fav = S.favs.has(s.key), pages = d?.pages || it.pages || 1;
  const state = JAZZ.busy.has(s.docId) ? 'prenašam …' : d ? 'shranjeno' : (it.size ? Math.max(1, Math.round(it.size / 1024)) + ' kB' : '');
  return `<li class="row piano-row jazz-row"><button class="row-main" data-open="${esc(s.key)}"><span class="num" aria-hidden="true">♪</span><span class="tt"><b>${esc(s.title)}</b><span>${esc(s.comp)}</span><span class="piano-info">${pages} ${pages === 1 ? 'stran' : 'strani'}${it.time ? ' · ' + esc(it.time) : ''}${state ? ' · ' + state : ''}</span></span></button><button class="star" data-jazzplay="${esc(s.key)}" aria-label="Zaigraj ${esc(s.title)}">${ICON_PLAY}</button><button class="star" data-fav="${esc(s.key)}" aria-pressed="${fav}" aria-label="${fav ? 'Odstrani iz priljubljenih' : 'Dodaj med priljubljene'}">${ICON_STAR(fav)}</button></li>`;
}
function jazzHtml() {
  if (!JAZZ.list && !JAZZ.loading && !JAZZ.error) jazzLoad();
  const q = norm(S.q || '');
  const sk = t => t.replace(/^[^A-Za-z0-9]+/, '').replace(/^(the|a|an)\s+/i, '');
  const all = S.songs.filter(isJazz).sort((a, b) => coll.compare(sk(a.title), sk(b.title)));
  const list = q ? all.filter(s => q.split(' ').every(t => (s.n + ' ' + s.cn).includes(t))) : all;
  const saved = jazzDocs().length, total = all.length;
  const mb = (JAZZ.list || []).filter(it => !jazzDocs().some(d => d.id === it.id)).reduce((a, it) => a + (it.size || 0), 0) / 1048576;
  let h = `<div class="section-head"><h2>Jazz<em>${total || ''}</em></h2></div>
    <p class="hint-p">Lead sheeti z jazz akordi: standardi, ragtime, blues, spirituali in ljudske. Odpri note ali tapni ▸. Predvajalnik igra melodijo, akorde in bas; v njem lahko vadiš samo melodijo. Odprte pesmi ostanejo v napravi.</p>
    <div class="zb-add"><button class="btn primary" data-jazzsync ${JAZZ.syncing || !JAZZ.list ? 'disabled' : ''}>${JAZZ.syncing ? 'Prenašam …' : saved && saved >= total ? 'Vse je shranjeno' : `Shrani vse za brez interneta${mb >= 0.1 ? ` (${mb.toFixed(0)} MB)` : ''}`}</button></div>`;
  if (JAZZ.progress) h += `<p class="hint-p" role="status">${esc(JAZZ.progress)}</p>`;
  if (JAZZ.error) h += `<div class="notice" role="alert"><p>${esc(JAZZ.error)}</p></div>`;
  if (!total) h += JAZZ.error ? '' : '<div class="empty"><strong>Nalagam seznam …</strong></div>';
  else if (!list.length) h += '<div class="empty">Ni zadetkov.</div>';
  else {
    const groups = new Map();
    for (const s of list) { const L = (sk(s.title)[0] || '#').toUpperCase(); const k = /[A-Z]/.test(L) ? L : '#'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
    h += [...groups.entries()].map(([k, songs]) => `<section class="piano-author"><div class="section-head"><h3>${esc(k)}<em>${songs.length}</em></h3></div><ul class="list">${songs.map(jazzRow).join('')}</ul></section>`).join('');
  }
  const src = JAZZ.src;
  if (src) h += `<p class="hint-p jazz-src">Vir: <a href="${esc(src.doi)}" target="_blank" rel="noopener">${esc(src.name)}</a> (D. Berger, C. Israels; ${esc(src.publisher)}), izdaja pod licenco ${esc(src.license)}. Tu so le pesmi, ki so v Sloveniji proste: avtorji glasbe in besedila so umrli vsaj 70 let pred 2026 ali pa je pesem ljudska. Spremljavo predvajalnik sestavi samodejno iz akordnih oznak.</p>`;
  return h;
}
async function jazzFetch(id) {
  const it = (JAZZ.list || []).find(x => x.id === id); if (!it) throw new Error('Te skladbe ni na seznamu.');
  const old = S.docs.find(d => d.id === id);
  if (old && !old.jazz) throw new Error('Skladba z istim imenom že obstaja.');
  if (old && old.version === (JAZZ.version || '') && validPianoData(old.playback) && await DB.get('files', id)) return old;
  const [pr, nr] = await Promise.all([fetch(`jazz/pdf/${id}.pdf`), fetch(`jazz/play/${id}.json`)]);
  if (!pr.ok || !nr.ok) throw new Error(navigator.onLine ? 'Prenos ni uspel. Poskusi znova.' : 'Za prvo odprtje te pesmi potrebuješ internet.');
  const [blob, data] = await Promise.all([pr.blob(), nr.json()]);
  if (!validPianoData(data) || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('Neveljaven PDF ali zapis melodije.');
  data.src = 'jazz';
  const file = new File([blob], it.title + '.pdf', { type: 'application/pdf' });
  const doc = { id, name: it.title, comp: it.comp || '', info: '', pages: it.pages, size: file.size, book: null, songs: [], status: 'ready', added: old?.added || Date.now(), jazz: true, version: JAZZ.version || '', playback: data };
  // PDF in melodija se shranita skupaj; neuspešen zapis pusti staro stanje
  await DB.batch([{ store: 'files', key: id, value: file }, { store: 'docs', key: id, value: doc }]);
  if (old) Object.assign(old, doc); else S.docs.push(doc);
  memFiles.set(id, file); pdfCache.delete(id); S.notes['j:' + id] = data;
  return doc;
}
/* odpre neprenesene: prenese, nato odpre (vrne false, če prenos ni uspel) */
async function jazzEnsure(s) {
  if (songDoc(s)) return true;
  if (!JAZZ.list) await jazzLoad();
  JAZZ.busy.add(s.docId); if (S.tab === 'jazz') render();
  try { await jazzFetch(s.docId); buildSongs(); return true; }
  catch (err) { toast(err.name === 'QuotaExceededError' ? 'Na napravi ni dovolj prostora.' : err.message || 'Pesmi ni bilo mogoče odpreti.'); return false; }
  finally { JAZZ.busy.delete(s.docId); if (S.tab === 'jazz') render(); }
}
async function jazzSync() {
  if (JAZZ.syncing) return;
  if (!navigator.onLine) { JAZZ.error = 'Za prenos potrebuješ internet. Že shranjene pesmi lahko odpreš.'; render(); return; }
  JAZZ.syncing = true; JAZZ.error = ''; render();
  let failed = 0, added = 0;
  try {
    await jazzLoad(true); const list = JAZZ.list || [];
    for (const [i, it] of list.entries()) {
      JAZZ.progress = `${i + 1}/${list.length} · ${it.title}`; if (S.tab === 'jazz' && i % 4 === 0) render();
      const had = S.docs.find(d => d.id === it.id && d.jazz && d.version === (JAZZ.version || ''));
      try { await jazzFetch(it.id); if (!had) added++; }
      catch (err) { failed++; if (err.name === 'QuotaExceededError') { JAZZ.error = 'Na napravi ni dovolj prostora za vse pesmi.'; break; } }
    }
    buildSongs();
    JAZZ.progress = failed ? `Prenos ni popoln: ${failed} pesmi ni shranjenih. Tapni gumb za ponovni poskus.` : `${jazzDocs().length} pesmi je shranjenih za uporabo brez interneta.`;
    if (!failed) toast(added ? `Shranjenih jazz pesmi: ${added}` : 'Jazz pesmi so že shranjene.');
  } finally { JAZZ.syncing = false; render(); }
}
async function jazzPlay(key) {
  const s = S.songs.find(x => x.key === key && isJazz(x)); if (!s) return;
  audio();
  if (!await jazzEnsure(s)) return;
  openSong(s); openPlayer(s); PL.pos = 0; if (PL.data) plStart(0);
}
return { JAZZ, isJazz, jazzDocs, jazzSongs, jazzRow, jazzHtml, jazzLoad, jazzEnsure, jazzSync, jazzPlay };
}
