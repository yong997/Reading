/* Reading · TXT 阅读编辑器  —  app.js */
'use strict';

/* ---------------- 状态 ---------------- */
const state = {
  handle: null,
  fileName: '',
  origBuffer: null,
  origText: '',
  text: '',
  origEncoding: 'utf-8',
  hasBOM: false,
  chapters: [],
  cur: 0,
  editing: false,
  dirty: false,
  nl: '\n',
  prefs: { font: 19, lh: 1.95, theme: 'light', width: 'medium', sidebarHidden: false },
  gbkTable: null,
  scrollSaveTimer: null,
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------------- 偏好存取 ---------------- */
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem('reading.prefs') || '{}');
    Object.assign(state.prefs, p);
  } catch (e) {}
}
function savePrefs() {
  localStorage.setItem('reading.prefs', JSON.stringify(state.prefs));
}
function applyPrefs() {
  const b = document.body;
  b.dataset.theme = state.prefs.theme;
  b.dataset.width = state.prefs.width;
  document.documentElement.style.setProperty('--fs', state.prefs.font + 'px');
  document.documentElement.style.setProperty('--lh', String(state.prefs.lh));
  $('#lblFont').textContent = state.prefs.font;
  $('#selTheme').value = state.prefs.theme;
  $('#selWidth').value = state.prefs.width;
  document.body.classList.toggle('sidebar-collapsed', !!state.prefs.sidebarHidden && window.innerWidth > 820);
}

/* ---------------- 位置存取 ---------------- */
function posKey(name) { return 'reading.pos.' + name; }
function savePos() {
  if (!state.fileName || !state.chapters.length) return;
  clearTimeout(state.scrollSaveTimer);
  state.scrollSaveTimer = setTimeout(() => {
    const data = { chapter: state.cur, scroll: $('#viewport').scrollTop };
    try { localStorage.setItem(posKey(state.fileName), JSON.stringify(data)); } catch (e) {}
  }, 300);
}
function loadPos(name) {
  try { return JSON.parse(localStorage.getItem(posKey(name)) || 'null'); } catch (e) { return null; }
}

/* ---------------- 编码：解码 ---------------- */
function decodeBuffer(buf, forced) {
  const u8 = new Uint8Array(buf);
  const enc = forced || 'auto';

  if (enc === 'auto') {
    // BOM
    if (u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF)
      return { text: new TextDecoder('utf-8').decode(u8.subarray(3)), encoding: 'utf-8', hasBOM: true };
    if (u8[0] === 0xFF && u8[1] === 0xFE)
      return { text: new TextDecoder('utf-16le').decode(u8.subarray(2)), encoding: 'utf-16le', hasBOM: true };
    if (u8[0] === 0xFE && u8[1] === 0xFF)
      return { text: new TextDecoder('utf-16be').decode(u8.subarray(2)), encoding: 'utf-16be', hasBOM: true };
    // strict UTF-8
    try {
      const t = new TextDecoder('utf-8', { fatal: true }).decode(u8);
      return { text: t, encoding: 'utf-8', hasBOM: false };
    } catch (e) {}
    // GBK fallback
    try {
      const t = new TextDecoder('gbk').decode(u8);
      return { text: t, encoding: 'gbk', hasBOM: false };
    } catch (e) {}
    return { text: new TextDecoder('utf-8').decode(u8), encoding: 'utf-8', hasBOM: false };
  }

  // forced
  let label = enc;
  if (enc === 'gbk') label = 'gbk';
  let offset = 0, hasBOM = false;
  if (enc === 'utf-8' && u8[0] === 0xEF && u8[1] === 0xBB && u8[2] === 0xBF) { offset = 3; hasBOM = true; }
  if (enc === 'utf-16le' && u8[0] === 0xFF && u8[1] === 0xFE) { offset = 2; hasBOM = true; }
  try {
    const t = new TextDecoder(label).decode(u8.subarray(offset));
    return { text: t, encoding: enc, hasBOM };
  } catch (e) {
    return { text: new TextDecoder('utf-8').decode(u8), encoding: 'utf-8', hasBOM: false };
  }
}

/* ---------------- 编码：保存 ---------------- */
function getGbkTable() {
  if (state.gbkTable) return state.gbkTable;
  const b64 = (window.GBK_TABLE_B64 || '').replace(/\s+/g, '');
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  state.gbkTable = new Uint16Array(u8.buffer, 0, u8.length >> 1);
  return state.gbkTable;
}
function encodeGbk(text) {
  const tbl = getGbkTable();
  const out = new Uint8Array(text.length * 2 + 4);
  let n = 0; const lost = new Set();
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp < 0x80) { out[n++] = cp; }
    else {
      const v = cp <= 0xFFFF ? tbl[cp] : 0;
      if (v) { out[n++] = (v >> 8) & 0xFF; out[n++] = v & 0xFF; }
      else { lost.add(text[i]); out[n++] = 0x3F; } // '?'
    }
  }
  return { bytes: out.subarray(0, n), lost: Array.from(lost) };
}
function encodeText(text, enc) {
  const hasBOM = state.hasBOM;
  if (enc === 'gbk' || enc === 'gb18030') {
    const r = encodeGbk(text);
    return { bytes: r.bytes, lost: r.lost };
  }
  if (enc === 'utf-16le') {
    const r = new Uint8Array(text.length * 2 + 2); let n = 0;
    if (hasBOM) { r[n++] = 0xFF; r[n++] = 0xFE; }
    for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); r[n++] = c & 0xFF; r[n++] = (c >> 8) & 0xFF; }
    return { bytes: r.subarray(0, n), lost: [] };
  }
  // utf-8
  const body = new TextEncoder().encode(text);
  if (hasBOM && state.origEncoding === 'utf-8') {
    const r = new Uint8Array(body.length + 3); r[0]=0xEF;r[1]=0xBB;r[2]=0xBF; r.set(body,3);
    return { bytes: r, lost: [] };
  }
  return { bytes: body, lost: [] };
}
function effectiveEncoding() {
  const sel = $('#selEncoding').value;
  return sel === 'auto' ? state.origEncoding : sel;
}

/* ---------------- 解析章节 ---------------- */
function parseChapters(text) {
  state.nl = text.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  // 第X章/回/卷（可带分隔符与标题）；序章/楔子/后记/尾声/番外/终章；Chapter N
  const re = /^[ \t\u3000]*(?:第[ \t\u3000]*(?:[0-9０-９]{1,7}|[〇零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]{1,12})[ \t\u3000]*[章回卷](?:[ \t\u3000：:、，,·\-—]+[^\r\n]{0,40})?|(?:序章|楔子|后记|尾声|番外|终章|Chapter[ \t]+\d+)[^\r\n]{0,40})/gmi;
  const heads = [];
  let m;
  while ((m = re.exec(text)) !== null) heads.push({ start: m.index, title: m[0].trim() });
  const chapters = [];
  for (let i = 0; i < heads.length; i++) {
    chapters.push({ start: heads[i].start, end: i + 1 < heads.length ? heads[i + 1].start : text.length, title: heads[i].title });
  }
  state.preamble = heads.length ? text.slice(0, heads[0].start) : text;
  return chapters;
}

/* ---------------- 渲染 ---------------- */
function splitBlocks(body) {
  let s = body.replace(/\r\n/g, '\n');
  s = s.replace(/^\n+/, '').replace(/\n+$/, '');
  if (!s) return [];
  return s.split(/\n[ \t\u3000]*\n/);
}
function makePara(text) {
  const p = document.createElement('p');
  p.className = 'para';
  p.textContent = text;
  setParaEditable(p);
  return p;
}
function setParaEditable(p) {
  if (state.editing) {
    p.setAttribute('contenteditable', 'plaintext-only');
    p.addEventListener('input', onParaInput);
  } else {
    p.removeAttribute('contenteditable');
  }
}
function onParaInput() { state.dirty = true; updateDirtyUI(); }

function renderChapter(idx, opts = {}) {
  if (!state.chapters.length) return;
  idx = Math.max(0, Math.min(idx, state.chapters.length - 1));
  state.cur = idx;
  const c = state.chapters[idx];
  const raw = state.text.slice(c.start, c.end);
  const firstNl = raw.indexOf('\n');
  let title, body;
  if (firstNl >= 0) { title = raw.slice(0, firstNl).trim(); body = raw.slice(firstNl + 1); }
  else { title = raw.trim(); body = ''; }
  $('#chapterTitle').textContent = title || ('第 ' + (idx + 1) + ' 章');
  const bodyEl = $('#chapterBody');
  bodyEl.innerHTML = '';
  splitBlocks(body).forEach(b => bodyEl.appendChild(makePara(b)));
  $('#navInfo').textContent = (idx + 1) + ' / ' + state.chapters.length;
  $$('#toc li').forEach(li => li.classList.toggle('active', +li.dataset.i === idx));
  // 只滚动目录容器，避免影响整页
  const activeLi = $('#toc li.active');
  const tocEl = $('#toc');
  if (activeLi && tocEl) {
    const top = activeLi.offsetTop, h = activeLi.offsetHeight;
    if (top < tocEl.scrollTop) tocEl.scrollTop = top;
    else if (top + h > tocEl.scrollTop + tocEl.clientHeight) tocEl.scrollTop = top + h - tocEl.clientHeight;
  }
  updateStatus();
  if (!opts.keepScroll) $('#viewport').scrollTop = opts.scroll != null ? opts.scroll : 0;
}

function renderTOC() {
  const ul = $('#toc');
  ul.innerHTML = '';
  const frag = document.createDocumentFragment();
  state.chapters.forEach((c, i) => {
    const li = document.createElement('li');
    li.textContent = c.title || ('第 ' + (i + 1) + ' 章');
    li.dataset.i = i;
    li.title = li.textContent;
    frag.appendChild(li);
  });
  ul.appendChild(frag);
  filterTOC();
}
function filterTOC() {
  const q = ($('#tocSearch').value || '').trim();
  $$('#toc li').forEach(li => {
    li.style.display = !q || li.textContent.includes(q) ? '' : 'none';
  });
}

/* ---------------- 编辑/提交 ---------------- */
function toggleEdit() {
  if (!state.chapters.length) return;
  const vp = $('#viewport');
  const savedScroll = vp.scrollTop;
  if (state.editing) {
    commitCurrent();
    state.editing = false;
  } else {
    state.editing = true;
  }
  document.body.classList.toggle('editing', state.editing);
  const btn = $('#btnEdit');
  btn.classList.toggle('active', state.editing);
  btn.textContent = state.editing ? '✓ 完成' : '✎ 编辑';
  renderChapter(state.cur, { keepScroll: true });
  // innerHTML 重建会清空滚动高度，这里恢复到切换前的位置
  vp.scrollTop = savedScroll;
  requestAnimationFrame(() => { vp.scrollTop = savedScroll; });
}
function commitCurrent() {
  if (!state.chapters.length) return;
  const bodyEl = $('#chapterBody');
  const paras = $$('.para', bodyEl);
  const c = state.chapters[state.cur];
  if (!c) return;
  const raw = state.text.slice(c.start, c.end);
  const firstNl = raw.indexOf('\n');
  const titleLine = firstNl >= 0 ? raw.slice(0, firstNl) : raw;
  const nl = state.nl;
  const blocks = paras.map(p => (p.innerText != null ? p.innerText : p.textContent).replace(/\r\n/g, '\n'));
  let newBody = blocks.join('\n\n').replace(/\n/g, nl);
  let newRaw = titleLine + nl + nl + newBody + nl;
  if (newRaw === raw) return;
  state.text = state.text.slice(0, c.start) + newRaw + state.text.slice(c.end);
  state.dirty = true;
  const keepCur = state.cur;
  state.chapters = parseChapters(state.text);
  state.cur = Math.min(keepCur, state.chapters.length - 1);
  renderTOC();
  updateMeta();
  updateDirtyUI();
}

/* ---------------- 导航 ---------------- */
function gotoChapter(idx, opts) {
  if (!state.chapters.length) return;
  if (state.editing) commitCurrent();
  renderChapter(idx, opts || {});
}
function nextChapter() { if (state.cur < state.chapters.length - 1) gotoChapter(state.cur + 1); }
function prevChapter() { if (state.cur > 0) gotoChapter(state.cur - 1); }
function toggleSidebar() {
  if (window.innerWidth <= 820) {
    document.body.classList.toggle('toc-open');
  } else {
    const hidden = document.body.classList.toggle('sidebar-collapsed');
    state.prefs.sidebarHidden = hidden;
    savePrefs();
  }
}

/* ---------------- 打开 / 加载 ---------------- */
async function openFile() {
  if (window.showOpenFilePicker && window.isSecureContext) {
    try {
      const [h] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'TXT / 文本', accept: { 'text/plain': ['.txt', '.md', '.log', '.text'] } }],
      });
      const file = await h.getFile();
      const buf = await file.arrayBuffer();
      loadFile(h, file.name, buf);
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      console.warn('showOpenFilePicker 失败，改用文件选择框', e);
    }
  }
  $('#fileInput').click();
}

async function loadFile(handle, name, buf) {
  state.handle = handle;
  state.fileName = name;
  state.origBuffer = buf;
  const sel = $('#selEncoding').value;
  const forced = sel === 'auto' ? null : sel;
  const d = decodeBuffer(buf, forced);
  state.origEncoding = d.encoding;
  state.hasBOM = d.hasBOM;
  state.origText = d.text;
  state.text = d.text;
  state.dirty = false;
  state.editing = false;
  document.body.classList.remove('editing');
  $('#btnEdit').classList.remove('active');
  $('#btnEdit').textContent = '✎ 编辑';

  state.chapters = parseChapters(state.text);
  $('#emptyState').hidden = true;
  $('#chapterView').hidden = false;
  $('#btnSave').disabled = false;
  $('#btnSaveAs').disabled = false;

  renderTOC();
  updateMeta();

  const pos = loadPos(name);
  const idx = pos && pos.chapter < state.chapters.length ? pos.chapter : 0;
  renderChapter(idx, { scroll: pos ? pos.scroll : 0 });
  updateDirtyUI();
  status('已打开：' + name + '（' + state.chapters.length + ' 章，编码 ' + encLabel(d.encoding) + '）');
}

function encLabel(e) {
  return { 'utf-8': 'UTF-8', gbk: 'GBK', big5: 'Big5', 'utf-16le': 'UTF-16LE', 'utf-16be': 'UTF-16BE' }[e] || e;
}
function updateMeta() {
  const el = $('#fileMeta');
  if (!state.fileName) { el.textContent = '尚未打开文件'; return; }
  el.innerHTML = '';
  const n = document.createElement('div'); n.textContent = state.fileName; n.style.color = 'var(--fg)';
  const m = document.createElement('div'); m.textContent = state.chapters.length + ' 章 · ' + encLabel(state.origEncoding) + (state.handle ? ' · 可写回' : ' · 只读(下载保存)');
  el.appendChild(n); el.appendChild(m);
}

/* ---------------- 保存 ---------------- */
async function doSave() {
  if (!state.chapters.length) return;
  if (state.editing) toggleEdit();
  const enc = effectiveEncoding();
  if (enc === 'big5') { alert('暂不支持保存为 Big5 编码，请改用 UTF-8 保存。'); return; }
  const { bytes, lost } = encodeText(state.text, enc);
  if (lost && lost.length) {
    const sample = Array.from(new Set(lost)).slice(0, 30).join(' ');
    if (!confirm('有 ' + lost.length + ' 个字符无法用当前编码(' + encLabel(enc) + ')表示，将替换为“?”：\n' + sample + '\n\n是否继续保存？')) return;
  }
  if (state.handle && state.handle.createWritable) {
    try {
      const w = await state.handle.createWritable();
      await w.write(bytes);
      await w.close();
      state.origBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      state.origEncoding = enc;
      state.origText = state.text;
      state.dirty = false;
      updateDirtyUI();
      status('✓ 已保存到原文件（' + encLabel(enc) + '）');
      return;
    } catch (e) {
      console.error(e);
      alert('写回原文件失败：' + e.message + '\n将改为下载副本。');
    }
  }
  downloadBytes(bytes, suggestName());
  state.dirty = false;
  updateDirtyUI();
  status('已下载副本（浏览器模式无法直接写回原文件）');
}

async function doSaveAs() {
  if (!state.chapters.length) return;
  if (state.editing) toggleEdit();
  const enc = effectiveEncoding();
  if (enc === 'big5') { alert('暂不支持保存为 Big5 编码，请改用 UTF-8。'); return; }
  const { bytes, lost } = encodeText(state.text, enc);
  if (lost && lost.length && !confirm('有 ' + lost.length + ' 个字符无法用当前编码表示，将替换为“?”。继续？')) return;
  if (window.showSaveFilePicker && window.isSecureContext) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: suggestName(),
        types: [{ description: 'TXT', accept: { 'text/plain': ['.txt'] } }],
      });
      const w = await h.createWritable();
      await w.write(bytes);
      await w.close();
      status('已另存副本');
      return;
    } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  downloadBytes(bytes, suggestName());
  status('已下载副本');
}
function suggestName() {
  const base = (state.fileName || 'novel.txt').replace(/\.txt$/i, '');
  return base + '_edited.txt';
}
function downloadBytes(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name || 'novel.txt';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------------- 状态栏 ---------------- */
function status(msg) { $('#statusLeft').textContent = msg; }
function updateStatus() {
  if (!state.chapters.length) return;
  const c = state.chapters[state.cur];
  $('#statusRight').textContent = (state.cur + 1) + '/' + state.chapters.length + ' 章 · ' + encLabel(effectiveEncoding()) + (state.dirty ? ' · ● 未保存' : '');
}
function updateDirtyUI() {
  const el = $('#statusLeft');
  el.classList.toggle('dirty', state.dirty);
  if (state.dirty) el.textContent = '● 有未保存的修改（Ctrl+S 保存）';
  updateStatus();
}

/* ---------------- 事件绑定 ---------------- */
function bind() {
  $('#btnOpen').addEventListener('click', openFile);
  $('#btnSave').addEventListener('click', doSave);
  $('#btnSaveAs').addEventListener('click', doSaveAs);
  $('#btnEdit').addEventListener('click', toggleEdit);
  $('#btnPrev').addEventListener('click', prevChapter);
  $('#btnNext').addEventListener('click', nextChapter);

  $('#toc').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    gotoChapter(+li.dataset.i);
    if (window.innerWidth <= 820) document.body.classList.remove('toc-open');
  });
  $('#tocSearch').addEventListener('input', filterTOC);
  $('#btnSidebar').addEventListener('click', toggleSidebar);

  $('#selEncoding').addEventListener('change', () => {
    if (!state.origBuffer) return;
    const sel = $('#selEncoding').value;
    const d = decodeBuffer(state.origBuffer, sel === 'auto' ? null : sel);
    state.origEncoding = d.encoding;
    state.hasBOM = d.hasBOM;
    state.origText = d.text;
    state.text = d.text;
    state.dirty = false;
    state.editing = false;
    document.body.classList.remove('editing');
    state.chapters = parseChapters(state.text);
    renderTOC(); updateMeta(); renderChapter(0, {}); updateDirtyUI();
    status('已按 ' + encLabel(d.encoding) + ' 重新解码');
  });

  // 字体
  $$('[data-font]').forEach(b => b.addEventListener('click', () => {
    state.prefs.font = Math.max(13, Math.min(34, state.prefs.font + (+b.dataset.font) * 1));
    applyPrefs(); savePrefs();
  }));
  // 行距
  $$('[data-lh]').forEach(b => b.addEventListener('click', () => {
    state.prefs.lh = Math.max(1.4, Math.min(3, Math.round((state.prefs.lh + (+b.dataset.lh) * 0.1) * 10) / 10));
    applyPrefs(); savePrefs();
  }));
  $('#selTheme').addEventListener('change', e => { state.prefs.theme = e.target.value; applyPrefs(); savePrefs(); });
  $('#selWidth').addEventListener('change', e => { state.prefs.width = e.target.value; applyPrefs(); savePrefs(); });

  // 文件选择框（回退）
  $('#fileInput').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    loadFile(null, f.name, buf);
    e.target.value = '';
  });

  // 拖拽（用 dataTransfer.types 判断，避免遮罩卡住）
  const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', e => { if (hasFiles(e)) { e.preventDefault(); $('#dropzone').hidden = false; } });
  window.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('dragleave', e => { if (e.relatedTarget === null) $('#dropzone').hidden = true; });
  window.addEventListener('drop', async e => {
    e.preventDefault(); $('#dropzone').hidden = true;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    loadFile(null, f.name, buf);
  });

  // 键盘
  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = e.target.isContentEditable || tag === 'input' || tag === 'select' || tag === 'textarea';
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); return; }
    if (e.key === 'Escape' && state.editing) { toggleEdit(); return; }
    if (typing) return;
    if (e.key === 'ArrowLeft') { prevChapter(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { nextChapter(); e.preventDefault(); }
  });

  // 滚动保存位置
  $('#viewport').addEventListener('scroll', savePos, { passive: true });

  // 关闭前提醒
  window.addEventListener('beforeunload', e => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

/* ---------------- 初始化 ---------------- */
function init() {
  loadPrefs();
  applyPrefs();
  bind();
  updateStatus();
  const secure = window.isSecureContext && !!window.showOpenFilePicker;
  if (!secure) {
    status('提示：当前为“只读打开 + 下载保存”模式；用 start.bat 通过本地服务器打开可“直接写回原文件”。');
  }
}

document.addEventListener('DOMContentLoaded', init);
