/* =========================================================
   1. KÉT SẮT (mã hoá bằng password)
   Ví dụ đời thường:
   - Password  = chìa khoá m nhớ trong đầu
   - salt      = "muối" ngẫu nhiên, để 2 người cùng pass vẫn ra 2 chìa khác nhau
   - key       = chìa thật, làm từ password + salt (PBKDF2, băm 250.000 lần cho khó dò)
   - AES-GCM   = cái két. Sai chìa thì không mở được, cũng không sửa lén được
   localStorage chỉ chứa két đã khoá ("mymark_vault"), KHÔNG có pass, KHÔNG có data rõ.
   ========================================================= */
const VAULT_KEY = 'mymark_vault';
const LEGACY_KEY = 'mymark_bookmarks';   // data chưa mã hoá từ bản P1
const PBKDF2_ITER = 250000;
let cryptoKey = null;   // chìa đang cầm trong RAM, reload trang là mất → phải nhập lại

// Chuyển qua lại giữa bytes và chuỗi base64 để cất vào localStorage
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function readVault() {
  try { return JSON.parse(localStorage.getItem(VAULT_KEY)); } catch { return null; }
}

// Thứ được nhét vào két: chỉ có bookmark (bản cũ có token gist → giờ bỏ luôn)
function payload() { return { bookmarks }; }
function applyPayload(d) { bookmarks = Array.isArray(d) ? d : (d.bookmarks || []); }

let currentPin = '';   // PIN đang dùng, chỉ nằm trong RAM — để Nhập .dat khỏi hỏi lại

// Khoá data lại rồi cất vào localStorage (mỗi lần lưu dùng iv mới)
// savedAt = giờ lưu, dùng để so "két nào mới hơn" giữa máy và repo
async function writeVault(data, key, saltB64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
  localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 2, savedAt: Date.now(), salt: saltB64, iv: toB64(iv), data: toB64(cipher) }));
  updateExportBadge();
}

// Tạo két mới bằng password mới (dùng cho: tạo lần đầu + đổi pass)
async function createVault(password, data) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  await writeVault(data, key, toB64(salt));
  cryptoKey = key;
}

// Thử mở két (mặc định két trên máy, hoặc két từ file .dat). Sai pass → AES-GCM báo lỗi → null
async function openVault(password, vault = readVault()) {
  try {
    const key = await deriveKey(password, fromB64(vault.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(vault.iv) }, key, fromB64(vault.data));
    return { key, data: JSON.parse(new TextDecoder().decode(plain)) };
  } catch { return null; }
}

// Lưu: hàng đợi nhỏ để 2 lần lưu sát nhau không giẫm lên nhau
let saveChain = Promise.resolve();
function saveBookmarks() {
  if (!cryptoKey) return;
  const snapshot = JSON.parse(JSON.stringify(payload()));
  saveChain = saveChain.then(() => writeVault(snapshot, cryptoKey, readVault().salt))
    .catch(() => toast('Không lưu được (localStorage bị chặn hoặc đầy)', 'fa-triangle-exclamation'));
}

/* =========================================================
   1b. KÉT Ở NHÀ = file vault.dat trong repo
   Ví dụ đời thường:
   - localStorage = cái túi mang theo (mỗi trình duyệt 1 túi, incognito thì túi rỗng)
   - vault.dat    = cái két để ở nhà (nằm trên web, máy nào/incognito nào cũng lấy được)
   - Mở tool → so giờ lưu (savedAt) → cái nào mới hơn thì dùng cái đó
   - Muốn cập nhật két ở nhà: Xuất .dat → thay tools/mymark/vault.dat → push
   ========================================================= */
const REPO_VAULT_URL = './vault.dat';
const EXPORTED_KEY = 'mymark_exported_at';   // savedAt của lần Xuất .dat gần nhất
const BACKUP_KEY = 'mymark_vault_prev';      // bản trên máy trước khi bị két repo đè (phòng hờ)

// Tải vault.dat từ repo (thêm ?t= để không dính cache cũ của GitHub Pages)
async function fetchRepoVault() {
  try {
    const res = await fetch(`${REPO_VAULT_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;   // chưa có file → thôi
    const v = JSON.parse(await res.text());
    return v && v.salt && v.iv && v.data ? v : null;
  } catch { return null; }
}

// Badge trên header: còn thay đổi chưa xuất .dat hay chưa
function updateExportBadge() {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  let pending = false;
  try {
    const v = readVault();
    const exp = localStorage.getItem(EXPORTED_KEY);
    pending = !!v && (exp === null || (v.savedAt || 0) > Number(exp));
  } catch {}
  el.innerHTML = pending
    ? '<span class="text-amber-400"><i class="fa-solid fa-file-export"></i> <span class="hidden md:inline">Chưa xuất</span></span>'
    : '<span class="text-gray-500"><i class="fa-solid fa-circle-check"></i> <span class="hidden md:inline">Đã xuất</span></span>';
  el.title = pending ? 'Có thay đổi chưa xuất .dat · bấm để xuất' : 'Bản trên máy đã xuất · bấm để xuất lại';
}

// Xuất két ra file vault.dat (chỉ chứa bookmark, đã khoá bằng PIN hiện tại)
async function exportDat() {
  if (!cryptoKey) return;
  saveChain = saveChain.then(() => writeVault(payload(), cryptoKey, readVault().salt));
  await saveChain;
  const content = localStorage.getItem(VAULT_KEY);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' }));
  a.download = 'vault.dat';
  a.click();
  URL.revokeObjectURL(a.href);
  localStorage.setItem(EXPORTED_KEY, String(JSON.parse(content).savedAt));
  updateExportBadge();
  toast('Đã xuất vault.dat → thay vào tools/mymark/ rồi push', 'fa-file-export');
}

/* =========================================================
   2. STATE – "trạng thái" hiện tại của trang
   ========================================================= */
let bookmarks = [];   // chỉ có data sau khi mở khoá
let state = { tag: 'all', sort: 'newest', search: '' };
let editingId = null;   // null = đang thêm mới, có id = đang sửa
let formTags = [];      // tag đang nhập trong form

/* =========================================================
   3. HELPER nhỏ
   ========================================================= */
const $ = (s) => document.querySelector(s);

// Chống chèn HTML độc (title/url do mình nhập nhưng cứ an toàn)
function esc(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}
// Bỏ dấu tiếng Việt để so sánh: "Đồ Gia Dụng" → "do gia dung"
function norm(str = '') {
  return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour12: false }) + ' ' + fmtDate(iso);
}
function toast(msg, icon = 'fa-circle-check') {
  const t = $('#toast');
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${esc(msg)}`;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* =========================================================
   4. LỌC + SẮP XẾP
   ========================================================= */
function getVisible() {
  const q = norm(state.search); // search cũng không cần gõ dấu
  let list = bookmarks.filter(b => {
    const okTag = state.tag === 'all' || (b.tags || []).includes(state.tag);
    const okSearch = !q || norm([b.title, b.url, ...(b.tags || [])].join(' ')).includes(q);
    return okTag && okSearch;
  });
  if (state.sort === 'popular') {
    list.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0) || new Date(b.date) - new Date(a.date));
  } else {
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return list;
}

/* =========================================================
   5. RENDER TAGS (sidebar desktop + chip ngang trên mobile)
   ========================================================= */
function renderTags() {
  const counts = getTagCounts();
  const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));

  // nếu tag đang chọn đã bị xoá hết bookmark → quay về "Tất cả"
  if (state.tag !== 'all' && !counts[state.tag]) state.tag = 'all';

  const items = [{ key: 'all', label: 'Tất cả', count: bookmarks.length, icon: 'fa-layer-group' },
                 ...tags.map(t => ({ key: t, label: t, count: counts[t], icon: 'fa-hashtag' }))];

  // Sidebar (desktop)
  $('#tagCloud').innerHTML = items.map(it =>
    `<div class="tag ${state.tag === it.key ? 'active' : ''}" data-tag="${esc(it.key)}" title="${esc(it.label)} (${it.count})">
       <i class="fa-solid ${it.icon}"></i><span class="label">${esc(it.label)}</span><span class="count label">${it.count}</span>
     </div>`).join('');

  // Chip ngang (mobile)
  $('#tagBar').innerHTML = items.map(it =>
    `<span class="tag-chip ${state.tag === it.key ? 'active' : ''}" data-tag="${esc(it.key)}">
       <i class="fa-solid ${it.icon}"></i>${esc(it.label)} <span class="count">${it.count}</span>
     </span>`).join('');
}

// Danh sách tất cả tag + số lần dùng (dùng cho gợi ý)
function getTagCounts() {
  const counts = {};
  bookmarks.forEach(b => (b.tags || []).forEach(t => counts[t] = (counts[t] || 0) + 1));
  return counts;
}

/* =========================================================
   6. RENDER GRID (masonry kiểu Pinterest)
   - Tính số cột theo độ rộng màn hình
   - Chia card lần lượt vào từng cột: 1→2→3→1→2...
   ========================================================= */
function getColumnCount() {
  const w = $('#grid').clientWidth || window.innerWidth;
  // tối đa 5 cột, mỗi cột tối thiểu ~280px → hình to hơn
  return Math.min(5, Math.max(2, Math.floor(w / 280)));
}

function cardHTML(b) {
  const domain = getDomain(b.url);
  const letter = esc(domain.charAt(0).toUpperCase());
  const thumb = b.thumbnail
    ? `<img src="${esc(b.thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'thumb-fallback',textContent:'${letter}'}))">`
    : `<div class="thumb-fallback">${letter}</div>`;
  return `
  <div class="bookmark-card" data-id="${b.id}">
    <a class="preview-frame" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" data-open>${thumb}</a>
    <div class="px-4 pt-3 pb-4">
      <h3 class="text-white font-bold text-[0.95rem] leading-snug break-words">${esc(b.title || domain)}</h3>
      <a class="block text-xs text-gray-500 hover:text-red-400 mt-1 truncate" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer" data-open>
        <i class="fa-solid fa-link text-[0.65rem]"></i> ${esc(domain)}
      </a>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-3 whitespace-nowrap" title="${fmtTime(b.date)}">
        <span class="meta-views text-red-400 font-semibold"><i class="fa-regular fa-eye"></i> ${b.clickCount || 0}</span>
        <span class="text-gray-700">•</span>
        <span><i class="fa-regular fa-calendar"></i> ${fmtDate(b.date)}</span>
      </div>
      ${(b.tags || []).length ? `<div class="flex flex-wrap gap-1.5 mt-3">${b.tags.map(t => `<span class="tag-chip sm" data-tag="${esc(t)}">#${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="card-actions">
      <button class="kebab-btn" data-kebab><i class="fa-solid fa-ellipsis-vertical"></i></button>
      <div class="dropdown">
        <button data-act="edit"><i class="fa-solid fa-pen"></i> Sửa</button>
        <button data-act="delete" class="danger"><i class="fa-solid fa-trash"></i> Xóa</button>
      </div>
    </div>
  </div>`;
}

function renderGrid() {
  const list = getVisible();
  const grid = $('#grid');
  $('#resultCount').textContent = `${list.length} bookmark`;

  if (!list.length) {
    grid.innerHTML = `<div class="neu-pressed flex-1 flex flex-col items-center justify-center gap-3 p-10 min-h-[300px] text-gray-500">
      <i class="fa-regular fa-bookmark text-4xl text-gray-600"></i>
      <p>${bookmarks.length ? 'Không tìm thấy bookmark nào.' : 'Chưa có bookmark nào. Bấm nút <b class="text-red-500">+</b> để thêm nhé.'}</p>
    </div>`;
    return;
  }
  const cols = Array.from({ length: getColumnCount() }, () => []);
  list.forEach((b, i) => cols[i % cols.length].push(cardHTML(b)));
  grid.innerHTML = cols.map(c => `<div class="masonry-column">${c.join('')}</div>`).join('');
}

function render() { renderTags(); renderGrid(); }

/* =========================================================
   7. MODAL THÊM / SỬA
   ========================================================= */
function renderChips() {
  const wrap = $('#tagWrap');
  wrap.querySelectorAll('.chip').forEach(c => c.remove());
  formTags.forEach((t, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `#${esc(t)} <button type="button" data-i="${i}"><i class="fa-solid fa-xmark"></i></button>`;
    wrap.insertBefore(chip, $('#fTag'));
  });
}
// Thêm 1 tag vào form (không trùng)
function pushTag(t) {
  t = String(t).trim().replace(/^#/, '');
  if (t && !formTags.includes(t)) formTags.push(t);
  $('#fTag').value = '';
  renderChips();
  closeSuggest();
}

/* ----- Gợi ý tag (không phân biệt dấu) -----
   suggestItems: danh sách đang hiện, phần tử cuối có thể là "+ Tạo tag mới"
   hlIndex: dòng đang sáng (mặc định 0 = gợi ý đầu tiên) */
let suggestItems = [];
let hlIndex = 0;

function buildSuggest() {
  const raw = $('#fTag').value.trim().replace(/^#/, '');
  const q = norm(raw);
  if (!q) { closeSuggest(); return; }
  const counts = getTagCounts();
  const matches = Object.keys(counts)
    .filter(t => !formTags.includes(t) && norm(t).includes(q))
    // ưu tiên tag BẮT ĐẦU bằng chữ đang gõ, rồi tới tag dùng nhiều
    .sort((a, b) => (norm(b).startsWith(q) - norm(a).startsWith(q)) || counts[b] - counts[a])
    .slice(0, 8)
    .map(t => ({ type: 'tag', value: t, count: counts[t] }));
  const exact = Object.keys(counts).some(t => norm(t) === q);
  if (!exact) matches.push({ type: 'create', value: raw });
  suggestItems = matches;
  hlIndex = 0;
  renderSuggest();
}
function renderSuggest() {
  const box = $('#tagSuggest');
  if (!suggestItems.length) { closeSuggest(); return; }
  box.innerHTML = suggestItems.map((it, i) => it.type === 'tag'
    ? `<div class="opt ${i === hlIndex ? 'hl' : ''}" data-si="${i}"><i class="fa-solid fa-hashtag"></i>${esc(it.value)}<span class="cnt">${it.count}</span></div>`
    : `<div class="opt create ${i === hlIndex ? 'hl' : ''}" data-si="${i}"><i class="fa-solid fa-plus"></i>Tạo tag "${esc(it.value)}"</div>`
  ).join('');
  box.classList.add('open');
  box.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
}
function closeSuggest() {
  suggestItems = [];
  $('#tagSuggest').classList.remove('open');
}

// Lỡ gõ tag mà chưa Enter rồi bấm Lưu → lấy luôn gợi ý đầu tiên
function addTagFromInput() {
  if (!$('#fTag').value.trim()) return;
  buildSuggest();
  if (suggestItems.length) pushTag(suggestItems[0].value);
}
function updateThumbPreview() {
  const url = $('#fThumb').value.trim();
  const box = $('#thumbPreview');
  if (!url) { box.classList.add('hidden'); return; }
  const img = box.querySelector('img');
  img.onload = () => box.classList.remove('hidden');
  img.onerror = () => box.classList.add('hidden');
  img.referrerPolicy = 'no-referrer';
  img.src = url;
}
function openModal(bm = null) {
  editingId = bm ? bm.id : null;
  $('#modalTitle').textContent = bm ? 'Sửa bookmark' : 'Thêm bookmark';
  $('#submitBtn').textContent = bm ? 'Cập nhật' : 'Lưu lại';
  $('#fUrl').value = bm?.url || '';
  $('#fTitle').value = bm?.title || '';
  $('#fThumb').value = bm?.thumbnail || '';
  formTags = bm ? [...(bm.tags || [])] : (state.tag !== 'all' ? [state.tag] : []);
  renderChips();
  updateThumbPreview();
  $('#bmModal').classList.add('open');
  setTimeout(() => $('#fUrl').focus(), 50);
}
function closeModal() { $('#bmModal').classList.remove('open'); }

$('#bmForm').addEventListener('submit', (e) => {
  e.preventDefault();
  addTagFromInput(); // lỡ gõ tag mà quên Enter
  const url = $('#fUrl').value.trim();
  const data = {
    url,
    title: $('#fTitle').value.trim() || getDomain(url),
    thumbnail: $('#fThumb').value.trim(),
    tags: [...formTags],
  };
  if (editingId) {
    const b = bookmarks.find(x => x.id === editingId);
    Object.assign(b, data);
    toast('Đã cập nhật');
  } else {
    bookmarks.push({ id: uid(), ...data, clickCount: 0, date: new Date().toISOString() });
    toast('Đã thêm bookmark');
  }
  saveBookmarks();
  closeModal();
  render();
});

$('#fTag').addEventListener('input', buildSuggest);
$('#fTag').addEventListener('keydown', (e) => {
  const open = $('#tagSuggest').classList.contains('open');
  if (e.key === 'ArrowDown' && open) { e.preventDefault(); hlIndex = (hlIndex + 1) % suggestItems.length; renderSuggest(); }
  else if (e.key === 'ArrowUp' && open) { e.preventDefault(); hlIndex = (hlIndex - 1 + suggestItems.length) % suggestItems.length; renderSuggest(); }
  else if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    if (open && suggestItems[hlIndex]) pushTag(suggestItems[hlIndex].value);
    else addTagFromInput();
  }
  else if (e.key === 'Escape' && open) { e.stopPropagation(); closeSuggest(); }
  else if (e.key === 'Backspace' && !e.target.value && formTags.length) { formTags.pop(); renderChips(); }
});
// Click chuột vào gợi ý (mousedown để chạy trước khi input mất focus)
$('#tagSuggest').addEventListener('mousedown', (e) => {
  const opt = e.target.closest('[data-si]');
  if (opt) { e.preventDefault(); pushTag(suggestItems[+opt.dataset.si].value); $('#fTag').focus(); }
});
$('#fTag').addEventListener('blur', () => setTimeout(closeSuggest, 100));
$('#tagWrap').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-i]');
  if (btn) { formTags.splice(+btn.dataset.i, 1); renderChips(); }
  else $('#fTag').focus();
});
$('#fThumb').addEventListener('input', updateThumbPreview);
$('#fabAdd').addEventListener('click', () => openModal());
// Chỉ đóng popup khi bấm nút X (bấm ra ngoài không mất form nữa)
$('#bmModal').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeModal();
});

/* =========================================================
   8. SỰ KIỆN TRÊN TRANG
   ========================================================= */
// Search (gõ tới đâu lọc tới đó)
$('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; renderGrid(); });

// Sort
document.querySelectorAll('[data-sort]').forEach(btn => btn.addEventListener('click', () => {
  state.sort = btn.dataset.sort;
  document.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('neu-active', b === btn));
  renderGrid();
}));

// Click tag ở sidebar / mobile / trong card
document.addEventListener('click', (e) => {
  const tagEl = e.target.closest('[data-tag]');
  if (tagEl) {
    state.tag = tagEl.dataset.tag;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// Trong grid: mở link (đếm view), menu 3 chấm, sửa, xoá
$('#grid').addEventListener('click', (e) => {
  const card = e.target.closest('.bookmark-card');
  if (!card) return;
  const bm = bookmarks.find(b => b.id === card.dataset.id);

  if (e.target.closest('[data-open]')) {
    bm.clickCount = (bm.clickCount || 0) + 1;
    saveBookmarks();
    // cập nhật số view tại chỗ, không render lại cả grid
    card.querySelector('.meta-views').innerHTML = `<i class="fa-regular fa-eye"></i> ${bm.clickCount}`;
    return; // để link mở tab mới như bình thường
  }
  if (e.target.closest('[data-kebab]')) {
    const dd = card.querySelector('.dropdown');
    const wasOpen = dd.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) { dd.classList.add('open'); card.querySelector('.card-actions').classList.add('show'); }
    e.stopPropagation();
    return;
  }
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'edit') { closeAllDropdowns(); openModal(bm); }
  if (act === 'delete') {
    closeAllDropdowns();
    if (confirm(`Xóa "${bm.title}"?`)) {
      bookmarks = bookmarks.filter(b => b.id !== bm.id);
      saveBookmarks(); render(); toast('Đã xóa', 'fa-trash');
    }
  }
});

function closeAllDropdowns() {
  document.querySelectorAll('.dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.card-actions.show').forEach(d => d.classList.remove('show'));
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dropdown') && !e.target.closest('[data-kebab]') && !e.target.closest('#menuBtn')) closeAllDropdowns();
});
// Phím "/" để nhảy vào ô tìm kiếm (giống Prompt Library)
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.body.classList.contains('locked')) {
    e.preventDefault(); $('#searchInput').focus();
  }
});

// Esc chỉ đóng menu, KHÔNG đóng popup (tránh lỡ tay mất form)
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllDropdowns(); });

// Back to top: cuộn xuống > 400px thì hiện nút
window.addEventListener('scroll', () => {
  $('#backTop').classList.toggle('show', window.scrollY > 400);
}, { passive: true });
$('#backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* =========================================================
   9. MENU DỮ LIỆU: Xuất / Nhập JSON / Xoá hết
   (P3 sẽ thêm Backup .dat có mã hoá)
   ========================================================= */
$('#menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const m = $('#mainMenu'); const wasOpen = m.classList.contains('open');
  closeAllDropdowns(); if (!wasOpen) m.classList.add('open');
});
$('#mainMenu').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  closeAllDropdowns();
  if (act === 'export-dat') exportDat();
  if (act === 'import') $('#importFile').click();
  if (act === 'change-pass') {
    $('#passForm').reset(); $('#passError').textContent = '';
    $('#passModal').classList.add('open');
    setTimeout(() => $('#pOld').focus(), 50);
  }
  if (act === 'clear-all' && confirm('Xóa TOÀN BỘ bookmark? Không hoàn tác được.')) {
    bookmarks = []; saveBookmarks(); render(); toast('Đã xóa toàn bộ', 'fa-trash');
  }
});

// Gộp danh sách bookmark vào data hiện có, bỏ qua URL đã tồn tại → trả về số cái mới
function mergeBookmarks(data) {
  if (!Array.isArray(data)) data = data.bookmarks || [];
  if (!Array.isArray(data)) return 0;
  const existing = new Set(bookmarks.map(b => b.url));
  let added = 0;
  data.forEach(raw => {
    if (!raw || !raw.url || existing.has(raw.url)) return;
    // Viết tay cho tiện: tags ghi "a, b, c" cũng được
    const tags = Array.isArray(raw.tags) ? raw.tags.map(String)
      : typeof raw.tags === 'string' ? raw.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    bookmarks.push({
      id: String(raw.id || uid()),
      title: raw.title || getDomain(raw.url),
      url: raw.url,
      thumbnail: raw.thumbnail || '',
      tags,
      clickCount: Number(raw.clickCount) || 0,
      date: raw.date && !isNaN(new Date(raw.date)) ? new Date(raw.date).toISOString() : new Date().toISOString(),
    });
    existing.add(raw.url); added++;
  });
  return added;
}

// Hộp hỏi PIN của file .dat (khi PIN file khác PIN đang dùng)
// tryOpen(pin) trả về kết quả nếu đúng, null nếu sai → sai thì hỏi lại, bấm X thì trả null
function askPin(tryOpen) {
  return new Promise((resolve) => {
    const m = $('#pinModal'), form = $('#pinForm'), input = $('#pinInput'), err = $('#pinError');
    form.reset(); err.textContent = '';
    m.classList.add('open');
    setTimeout(() => input.focus(), 50);
    const done = (val) => { m.classList.remove('open'); form.onsubmit = null; m.onclick = null; resolve(val); };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const r = await tryOpen(input.value);
      if (r) done(r); else { err.textContent = 'Sai PIN.'; input.select(); }
    };
    m.onclick = (ev) => { if (ev.target.closest('[data-close]')) done(null); };
  });
}

// Nhập: file .json (viết tay, chữ rõ) hoặc .dat (két đã khoá) → gộp vào
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { toast('File không hợp lệ (JSON sai cú pháp?)', 'fa-triangle-exclamation'); return; }

  if (data && data.salt && data.iv && data.data) {          // là két .dat
    let res = currentPin ? await openVault(currentPin, data) : null;   // thử PIN hiện tại trước
    if (!res) res = await askPin(pin => openVault(pin, data));
    if (!res) return;                                         // bấm X huỷ
    data = res.data;
  }
  const added = mergeBookmarks(data);
  saveBookmarks(); render();
  toast(`Đã nhập ${added} bookmark`);
});

/* =========================================================
   10. KHOÁ / MỞ KHOÁ / ĐỔI PASS / QUÊN PASS
   ========================================================= */
function showLock(mode) {
  // mode: 'setup' = chưa có pass, tạo mới | 'unlock' = đã có pass, nhập để mở
  const ls = $('#lockScreen');
  ls.className = 'lock-screen mode-' + mode;
  document.body.classList.add('locked');
  $('#lockForm').reset();
  $('#lockError').textContent = '';
  $('#lPass2').required = mode === 'setup';
  $('#lockSub').innerHTML = mode === 'setup' ? 'Tạo mật khẩu' : '';
  $('#lockSubmit').textContent = mode === 'setup' ? 'Tạo mật khẩu' : 'Mở khoá';
  setTimeout(() => $('#lPass').focus(), 50);
}

function unlockDone() {
  document.body.classList.remove('locked');
  render();
}

$('#lockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('#lPass').value;
  const isSetup = $('#lockScreen').classList.contains('mode-setup');
  const err = $('#lockError');
  const btn = $('#lockSubmit');

  if (isSetup) {
    if (pass.length < 4) { err.textContent = 'Mật khẩu tối thiểu 4 ký tự.'; return; }
    if (pass !== $('#lPass2').value) { err.textContent = 'Hai mật khẩu không khớp.'; return; }
  }
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

  if (isSetup) {
    // Nếu còn data chưa mã hoá từ bản P1 thì gom vào két luôn, rồi xoá bản rõ
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || []; } catch {}
    bookmarks = legacy;
    try {
      await createVault(pass, payload());
      currentPin = pass;
      localStorage.removeItem(LEGACY_KEY);
      toast(legacy.length ? `Đã khoá ${legacy.length} bookmark cũ` : 'Đã tạo mật khẩu');
      unlockDone();
    } catch {
      err.textContent = 'Trình duyệt đang chặn lưu trữ (localStorage).';
    }
  } else {
    const res = await openVault(pass);
    if (res) {
      cryptoKey = res.key; currentPin = pass; applyPayload(res.data); unlockDone();
      updateExportBadge();
    }
    else { err.textContent = 'Sai mật khẩu.'; $('#lPass').select(); }
  }
  btn.disabled = false;
  btn.textContent = isSetup ? 'Tạo mật khẩu' : 'Mở khoá';
});

// Khoá lại: vứt chìa + PIN + data khỏi RAM
$('#lockBtn').addEventListener('click', async () => {
  await saveChain;
  cryptoKey = null; currentPin = ''; bookmarks = [];
  closeModal();
  document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
  $('#grid').innerHTML = '';
  showLock('unlock');
});

// Quên pass: xoá két trên máy → tạo pass mới (mất bookmark trên máy; vault.dat trong repo vẫn còn)
$('#forgotBtn').addEventListener('click', () => {
  const ans = prompt('Xoá toàn bộ bookmark để đặt pass mới? Gõ XOA để xác nhận:');
  if (ans && ans.trim().toUpperCase() === 'XOA') {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(EXPORTED_KEY);
    bookmarks = []; cryptoKey = null; currentPin = '';
    showLock('setup');
    toast('Đã xoá dữ liệu, tạo mật khẩu mới nhé', 'fa-trash');
  }
});

// Bấm badge = xuất .dat
$('#syncBadge').addEventListener('click', exportDat);

// Đổi pass: kiểm tra pass cũ → khoá lại data bằng pass mới
$('#passForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#passError');
  const nw = $('#pNew').value;
  if (nw.length < 4) { err.textContent = 'Mật khẩu mới tối thiểu 4 ký tự.'; return; }
  if (nw !== $('#pNew2').value) { err.textContent = 'Hai mật khẩu mới không khớp.'; return; }
  await saveChain; // chờ lần lưu trước xong
  if (!(await openVault($('#pOld').value))) { err.textContent = 'Mật khẩu hiện tại sai.'; return; }
  await createVault(nw, payload());
  currentPin = nw;
  $('#passModal').classList.remove('open');
  toast('Đã đổi mật khẩu', 'fa-key');
});
$('#passModal').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) $('#passModal').classList.remove('open');
});

/* =========================================================
   11. KHỞI CHẠY
   ========================================================= */
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGrid, 150); });

if (!window.crypto?.subtle) {
  document.body.innerHTML = '<p style="padding:40px;text-align:center">Trình duyệt không hỗ trợ mã hoá (cần mở qua https hoặc localhost).</p>';
} else {
  boot();
}

async function boot() {
  // Đang tải két ở nhà (vault.dat) → khoá nút mở tạm
  showLock('unlock');
  $('#lockSub').innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải vault.dat...';
  $('#lockSubmit').disabled = true;

  const remote = await fetchRepoVault();
  let local = null;
  try { local = readVault(); } catch {}
  // Rule: két nào mới hơn thì dùng két đó (két cũ không có savedAt = coi như 0)
  if (remote && (!local || (remote.savedAt || 0) > (local.savedAt || 0))) {
    try {
      if (local) localStorage.setItem(BACKUP_KEY, JSON.stringify(local));
      localStorage.setItem(VAULT_KEY, JSON.stringify(remote));
      localStorage.setItem(EXPORTED_KEY, String(remote.savedAt || 0));   // bản này chính là bản đã xuất
      if (local) toast('Đã lấy bản mới hơn từ repo', 'fa-cloud-arrow-down');
    } catch {}
  }

  $('#lockSubmit').disabled = false;
  let hasVault = false;
  try { hasVault = !!readVault(); } catch {}
  showLock(hasVault ? 'unlock' : 'setup');
}
