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
  schedulePush();   // lưu xong → hẹn giờ đẩy lên server
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
   1b. ĐỒNG BỘ VỚI SERVER (Cloudflare Worker)
   Ví dụ đời thường:
   - localStorage = cái túi mang theo (mỗi trình duyệt 1 túi, incognito thì túi rỗng)
   - Worker       = ông bảo vệ giữ tủ đồ trên mạng, máy nào cũng tới lấy được
   - Vé vào cửa   = làm từ CHÍNH mật khẩu nhưng bằng "muối" khác
                    → bảo vệ chỉ soát vé, KHÔNG mở được két
   - Rule: két nào mới hơn (savedAt) thì thắng
   ========================================================= */
const SYNC_URL = 'https://mymark-sync.inukuma-boutique.workers.dev/vault';
const AUTH_SALT = 'mymark-sync-auth-v1';   // PHẢI khớp với mymark-hash-helper.html
const AUTH_ITER = 300000;
const SYNCED_KEY = 'mymark_synced_at';     // savedAt của bản mà server đang giữ (theo lần sync gần nhất)
const BACKUP_KEY = 'mymark_vault_prev';    // bản trên máy trước khi bị bản server đè (phòng hờ)
const PUSH_DELAY = 2500;                   // sửa xong chờ 2.5s không đụng gì nữa mới đẩy (debounce)
const MIN_PASS = 8;                        // mật khẩu mới tối thiểu 8 ký tự

let authToken = null;     // vé vào cửa, chỉ nằm trong RAM
let pushTimer = null;
let syncChain = Promise.resolve();   // hàng đợi: mỗi lúc chỉ 1 việc sync chạy
let lastPullAt = 0;
let syncState = 'off';

// Mật khẩu → vé vào cửa (giống hệt cách mymark-hash-helper.html làm)
async function deriveToken(password) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(password.trim().normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(AUTH_SALT), iterations: AUTH_ITER, hash: 'SHA-256' }, base, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const getSyncedAt = () => Number(localStorage.getItem(SYNCED_KEY)) || 0;
const setSyncedAt = (t) => { try { localStorage.setItem(SYNCED_KEY, String(t)); } catch {} };

// Gõ cửa server. Không ném lỗi, luôn trả về { status } cho dễ xử lý
async function callServer(method, token, body) {
  try {
    const res = await fetch(SYNC_URL, {
      method, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return { status: 'auth' };
    if (res.status === 409) return { status: 'stale', data };
    if (!res.ok) return { status: 'error', data };
    return { status: 'ok', data };
  } catch { return { status: 'offline' }; }
}

// Lấy két trên server về (chưa mở) → status: ok | empty | auth | offline | error
async function pullRemote(token = authToken) {
  const r = await callServer('GET', token);
  lastPullAt = Date.now();
  if (r.status !== 'ok') return r;
  if (r.data.empty) return { status: 'empty' };
  try {
    const v = JSON.parse(r.data.vault);
    if (v && v.salt && v.iv && v.data) return { status: 'ok', vault: v };
  } catch {}
  return { status: 'error' };
}

// Cất két từ server vào túi (giữ bản cũ làm backup)
function storeRemote(v) {
  try {
    const old = localStorage.getItem(VAULT_KEY);
    if (old) localStorage.setItem(BACKUP_KEY, old);
    localStorage.setItem(VAULT_KEY, JSON.stringify(v));
  } catch {}
  setSyncedAt(v.savedAt || 0);
}

// Bản server mới hơn → mở bằng mật khẩu đang dùng rồi thay vào
async function applyRemote(v) {
  if ((readVault()?.savedAt || 0) >= (v.savedAt || 0)) return pushLocal();   // vừa sửa thêm → bản mình mới hơn
  const res = await openVault(currentPin, v);
  if (!cryptoKey) return;   // đã bấm khoá trong lúc chờ
  if (!res) { setSyncState('mismatch'); return; }
  storeRemote(v);
  cryptoKey = res.key; applyPayload(res.data);
  render();
  setSyncState('synced');
  toast('Đã lấy bản mới hơn từ server', 'fa-cloud-arrow-down');
}

// Đẩy két trong túi lên server (nếu có thay đổi chưa đẩy)
async function pushLocal() {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!authToken || !raw) return;
  const savedAt = JSON.parse(raw).savedAt || 0;
  if (savedAt <= getSyncedAt()) { setSyncState('synced'); return; }
  setSyncState('syncing');
  const r = await callServer('PUT', authToken, { savedAt, vault: raw });
  if (r.status === 'ok') {
    setSyncedAt(savedAt);
    setSyncState('synced');
  } else if (r.status === 'stale') {
    // Máy khác vừa lưu bản mới hơn → bản đó thắng
    toast('Máy khác vừa lưu bản mới hơn → tải bản đó về', 'fa-cloud-arrow-down');
    await syncInner();
  } else setSyncState(r.status);
}

// Sync đầy đủ: kéo về → so giờ lưu → bản nào mới hơn thì thắng
async function syncInner() {
  if (!authToken) return;
  await saveChain;   // chờ lần lưu dở dang xong
  setSyncState('syncing');
  const r = await pullRemote();
  if (!authToken) return;
  if (r.status !== 'ok' && r.status !== 'empty') { setSyncState(r.status); return; }
  const localAt = readVault()?.savedAt || 0;
  const remoteAt = r.status === 'ok' ? (r.vault.savedAt || 0) : 0;
  setSyncedAt(remoteAt);
  if (remoteAt > localAt) return applyRemote(r.vault);
  if (localAt > remoteAt) return pushLocal();
  setSyncState('synced');
}

// Mọi việc sync đi qua hàng đợi, không giẫm chân nhau
function queueSync(fn) {
  syncChain = syncChain.then(fn).catch(() => setSyncState('error'));
  return syncChain;
}
function syncNow() {
  clearTimeout(pushTimer); pushTimer = null;
  return queueSync(syncInner);
}
function schedulePush() {
  if (!authToken) return;
  setSyncState('pending');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; queueSync(pushLocal); }, PUSH_DELAY);
}
// Đang hẹn giờ đẩy → đẩy luôn (dùng khi khoá / rời tab)
function flushPush() {
  if (!pushTimer) return syncChain;
  clearTimeout(pushTimer); pushTimer = null;
  return queueSync(pushLocal);
}

// Badge trên header: trạng thái đồng bộ, bấm vào = sync lại ngay
const SYNC_UI = {
  syncing:  ['text-gray-400',  'fa-arrows-rotate fa-spin', 'Đang sync', 'Đang đồng bộ với server...'],
  pending:  ['text-amber-400', 'fa-cloud-arrow-up',        'Chờ sync',  'Có thay đổi, sắp đẩy lên server'],
  synced:   ['text-gray-500',  'fa-circle-check',          'Đã sync',   'Máy và server đã khớp · bấm để sync lại'],
  offline:  ['text-amber-400', 'fa-wifi',                  'Offline',   'Không kết nối được server · bấm để thử lại'],
  auth:     ['text-red-400',   'fa-key',                   'Sai vé',    'Server từ chối: mật khẩu chưa khớp AUTH_HASH trên Cloudflare'],
  mismatch: ['text-red-400',   'fa-lock',                  'Khác pass', 'Két trên server khoá bằng mật khẩu khác'],
  error:    ['text-red-400',   'fa-triangle-exclamation',  'Lỗi sync',  'Server báo lỗi · bấm để thử lại'],
};
function setSyncState(s) {
  const prev = syncState;
  syncState = s;
  const el = document.getElementById('syncBadge');
  if (!el) return;
  const ui = SYNC_UI[s];
  el.innerHTML = ui ? `<span class="${ui[0]}"><i class="fa-solid ${ui[1]}"></i> <span class="hidden md:inline">${ui[2]}</span></span>` : '';
  el.title = ui ? ui[3] : '';
  if (s === prev) return;
  if (s === 'auth') toast('Server từ chối vé → đổi mật khẩu sang passphrase đã tạo AUTH_HASH', 'fa-key');
  if (s === 'mismatch') toast('Két trên server dùng mật khẩu khác', 'fa-lock');
}

// Xuất két ra file vault.dat (bản backup để cất riêng, không cần push nữa)
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
  toast('Đã xuất vault.dat (bản backup)', 'fa-file-export');
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
  metaFor = bm?.url || ''; autoTitle = ''; autoThumb = '';   // sửa bookmark cũ: chưa đổi URL thì khỏi lấy lại
  $('#metaSpin').classList.add('hidden');
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
    if (b) Object.assign(b, data);   // lỡ bản sync về đã xoá cái này → thêm lại như mới
    else bookmarks.push({ id: editingId, ...data, clickCount: 0, date: new Date().toISOString() });
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

/* ----- 7b. Tự lấy tiêu đề + thumbnail khi dán URL -----
   Nhờ Worker đi lấy giùm (trình duyệt bị luật CORS chặn, server thì không).
   Ô nào bro đã gõ tay thì KHÔNG đè; ô do tool tự điền thì được thay khi đổi URL. */
const META_URL = SYNC_URL.replace(/\/vault$/, '/meta');
let metaTimer = null;
let metaFor = '';                    // URL đang / vừa lấy, để khỏi lấy lại
let autoTitle = '', autoThumb = '';  // giá trị tool tự điền

function scheduleMeta() {
  clearTimeout(metaTimer);
  metaTimer = setTimeout(fetchMeta, 600);   // gõ xong 0.6s mới đi lấy
}

async function fetchMeta() {
  const url = $('#fUrl').value.trim();
  if (!authToken || !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(url) || url === metaFor) return;
  metaFor = url;
  $('#metaSpin').classList.remove('hidden');
  let m = null;
  try {
    const res = await fetch(`${META_URL}?url=${encodeURIComponent(url)}`,
      { headers: { Authorization: `Bearer ${authToken}` }, cache: 'no-store' });
    if (res.ok) m = await res.json();
  } catch {}
  if (metaFor !== url) return;   // trong lúc chờ đã dán URL khác → để lần sau lo
  $('#metaSpin').classList.add('hidden');
  if (!m || !$('#bmModal').classList.contains('open')) return;

  const t = $('#fTitle'), th = $('#fThumb');
  if (m.title && (!t.value.trim() || t.value === autoTitle)) { t.value = autoTitle = m.title; }
  if (m.image && (!th.value.trim() || th.value === autoThumb)) { th.value = autoThumb = m.image; updateThumbPreview(); }
}
$('#fUrl').addEventListener('input', scheduleMeta);

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
  if (act === 'find-replace') {
    $('#frForm').reset(); renderFrPreview();
    $('#frModal').classList.add('open');
    setTimeout(() => $('#frFind').focus(), 50);
  }
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

/* ----- 9b. TÌM & THAY HÀNG LOẠT (vd domain đổi đuôi abc.com → abc.net) -----
   Không phân biệt hoa/thường. Xem trước danh sách sẽ đổi rồi mới bấm Thay. */
const escRe = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FR_FIELDS = { url: 'URL', thumbnail: 'Ảnh', title: 'Tiêu đề' };

// Tính trước: bookmark nào đổi, đổi ô nào thành gì
function frChanges() {
  const find = $('#frFind').value;
  if (!find) return [];
  const rep = $('#frReplace').value;
  const re = new RegExp(escRe(find), 'gi');
  const fields = Object.keys(FR_FIELDS).filter(f => $(`#fr_${f}`).checked);
  return bookmarks.map(b => {
    const ch = {};
    fields.forEach(f => {
      const v = b[f] || '';
      const nv = v.replace(re, () => rep);   // dùng hàm để ký tự $ trong ô "Thay bằng" không bị hiểu sai
      if (nv !== v) ch[f] = nv;
    });
    return Object.keys(ch).length ? { b, ch } : null;
  }).filter(Boolean);
}

function renderFrPreview() {
  const list = frChanges();
  const btn = $('#frApply');
  btn.disabled = !list.length;
  btn.textContent = list.length ? `Thay ${list.length} bookmark` : 'Thay';
  const box = $('#frPreview');
  if (!$('#frFind').value) { box.innerHTML = ''; return; }
  if (!list.length) { box.innerHTML = '<p class="text-sm text-gray-500 py-2">Không có bookmark nào khớp.</p>'; return; }
  box.innerHTML = list.slice(0, 30).map(({ b, ch }) => `
    <div class="fr-row">
      <div class="text-sm text-gray-300 truncate">${esc(b.title || getDomain(b.url))}</div>
      ${Object.keys(ch).map(f => `
        <div class="text-xs truncate"><span class="text-gray-500">${FR_FIELDS[f]}:</span> <span class="text-red-400 line-through">${esc(b[f])}</span></div>
        <div class="text-xs truncate text-green-400"><i class="fa-solid fa-arrow-right text-[0.6rem]"></i> ${esc(ch[f])}</div>`).join('')}
    </div>`).join('')
    + (list.length > 30 ? `<p class="text-xs text-gray-500 pt-2">... và ${list.length - 30} bookmark nữa</p>` : '');
}

$('#frForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const list = frChanges();
  if (!list.length) return;
  list.forEach(({ b, ch }) => Object.assign(b, ch));
  saveBookmarks(); render();
  $('#frModal').classList.remove('open');
  toast(`Đã thay ${list.length} bookmark`, 'fa-right-left');
});
['#frFind', '#frReplace'].forEach(sel => $(sel).addEventListener('input', renderFrPreview));
document.querySelectorAll('#frForm input[type=checkbox]').forEach(c => c.addEventListener('change', renderFrPreview));
$('#frModal').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) $('#frModal').classList.remove('open');
});

/* =========================================================
   10. KHOÁ / MỞ KHOÁ / ĐỔI PASS / QUÊN PASS
   ========================================================= */
const LOCK_SUB = {
  setup: `Tạo mật khẩu mới (≥ ${MIN_PASS} ký tự)`,
  unlock: '',
  remote: 'Máy này chưa có két · nhập mật khẩu để tải từ server',
};
function showLock(mode) {
  // mode: 'setup'  = tạo két mới
  //       'unlock' = máy này có két, nhập pass để mở
  //       'remote' = máy này chưa có két (vd tab ẩn danh) → tải từ server
  const ls = $('#lockScreen');
  ls.className = 'lock-screen mode-' + mode;
  document.body.classList.add('locked');
  $('#lockForm').reset();
  $('#lockError').textContent = '';
  $('#lPass2').required = mode === 'setup';
  $('#lockSub').textContent = LOCK_SUB[mode];
  $('#lockSubmit').textContent = mode === 'setup' ? 'Tạo mật khẩu' : 'Mở khoá';
  setTimeout(() => $('#lPass').focus(), 50);
}
const lockMode = () => ['setup', 'remote', 'unlock'].find(m => $('#lockScreen').classList.contains('mode-' + m));

function unlockDone() {
  document.body.classList.remove('locked');
  render();
}

// Mở bằng két trên server (máy chưa có két, hoặc két trên máy dùng pass cũ)
// → trả về 'ok' | 'empty' | 'auth' | 'mismatch' | 'offline' | 'error'
async function remoteUnlock(pass) {
  const token = await deriveToken(pass);
  const r = await pullRemote(token);
  if (r.status !== 'ok') return r.status;
  const res = await openVault(pass, r.vault);
  if (!res) return 'mismatch';
  storeRemote(r.vault);
  cryptoKey = res.key; currentPin = pass; authToken = token;
  applyPayload(res.data);
  unlockDone();
  setSyncState('synced');
  return 'ok';
}

// Tạo két mới. Server đã có két thì KHÔNG tạo (tránh đè mất bookmark)
async function doSetup(pass) {
  const token = await deriveToken(pass);
  const r = await pullRemote(token);
  if (r.status === 'ok') {
    showLock('remote');
    $('#lockError').textContent = 'Server đã có két khoá bằng mật khẩu này → bấm Mở khoá.';
    return;
  }
  // Nếu còn data chưa mã hoá từ bản P1 thì gom vào két luôn, rồi xoá bản rõ
  let legacy = [];
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || []; } catch {}
  bookmarks = legacy;
  try {
    localStorage.removeItem(SYNCED_KEY);
    await createVault(pass, payload());
  } catch {
    $('#lockError').textContent = 'Trình duyệt đang chặn lưu trữ (localStorage).';
    return;
  }
  currentPin = pass; authToken = token;
  localStorage.removeItem(LEGACY_KEY);
  toast(legacy.length ? `Đã khoá ${legacy.length} bookmark cũ` : 'Đã tạo mật khẩu');
  unlockDone();
  if (r.status === 'empty') syncNow();   // server trống → đẩy két mới lên
  else setSyncState(r.status);           // auth / offline / error → báo trên badge
}

// Mở két trên máy. Sai pass → thử két trên server (có thể máy khác vừa đổi pass)
async function doLocalUnlock(pass) {
  const res = await openVault(pass);
  if (res) {
    cryptoKey = res.key; currentPin = pass; applyPayload(res.data);
    unlockDone();
    // Làm vé ở nền rồi sync, không bắt chờ
    deriveToken(pass).then(t => { if (cryptoKey && currentPin === pass) { authToken = t; syncNow(); } });
    return;
  }
  if (await remoteUnlock(pass) === 'ok') { toast('Mật khẩu đã đổi ở máy khác → đã tải két mới', 'fa-cloud-arrow-down'); return; }
  $('#lockError').textContent = 'Sai mật khẩu.';
  $('#lPass').select();
}

const REMOTE_ERR = {
  auth: 'Sai mật khẩu (server từ chối).',
  mismatch: 'Sai mật khẩu.',
  empty: 'Server chưa có két nào → bấm "Tạo két mới" bên dưới.',
  offline: 'Không kết nối được server.',
  error: 'Server báo lỗi, thử lại sau.',
};
async function doRemoteUnlock(pass) {
  const s = await remoteUnlock(pass);
  if (s === 'ok') return;
  $('#lockError').textContent = REMOTE_ERR[s] || REMOTE_ERR.error;
  $('#lPass').select();
}

$('#lockForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('#lPass').value;
  const mode = lockMode();
  const err = $('#lockError');
  const btn = $('#lockSubmit');

  if (mode === 'setup') {
    if (pass.trim().length < MIN_PASS) { err.textContent = `Mật khẩu tối thiểu ${MIN_PASS} ký tự.`; return; }
    if (pass !== $('#lPass2').value) { err.textContent = 'Hai mật khẩu không khớp.'; return; }
  }
  err.textContent = '';
  btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
  try {
    if (mode === 'setup') await doSetup(pass);
    else if (mode === 'remote') await doRemoteUnlock(pass);
    else await doLocalUnlock(pass);
  } finally {
    btn.disabled = false;
    btn.textContent = lockMode() === 'setup' ? 'Tạo mật khẩu' : 'Mở khoá';
  }
});

// Máy chưa có két, server cũng chưa có → tạo mới
$('#newVaultBtn').addEventListener('click', () => showLock('setup'));

// Khoá lại: đẩy nốt thay đổi lên server, rồi vứt chìa + vé + data khỏi RAM
$('#lockBtn').addEventListener('click', async () => {
  await saveChain;
  await flushPush();
  await syncChain;
  cryptoKey = null; currentPin = ''; authToken = null; bookmarks = [];
  setSyncState('off');
  closeModal();
  document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
  $('#grid').innerHTML = '';
  showLock(readVault() ? 'unlock' : 'remote');
});

// Quên pass: xoá két trên máy (bản trên server vẫn còn)
$('#forgotBtn').addEventListener('click', () => {
  const ans = prompt('Xoá két trên máy này? (bản trên server vẫn còn) Gõ XOA để xác nhận:');
  if (ans && ans.trim().toUpperCase() === 'XOA') {
    localStorage.removeItem(VAULT_KEY);
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(SYNCED_KEY);
    bookmarks = []; cryptoKey = null; currentPin = ''; authToken = null;
    showLock('remote');
    toast('Đã xoá két trên máy', 'fa-trash');
  }
});

// Bấm badge = sync lại ngay
$('#syncBadge').addEventListener('click', () => { if (authToken) syncNow(); });

// Đổi pass: kiểm tra pass cũ → khoá lại data bằng pass mới → đẩy lên server bằng vé mới
$('#passForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#passError');
  const nw = $('#pNew').value;
  if (nw.trim().length < MIN_PASS) { err.textContent = `Mật khẩu mới tối thiểu ${MIN_PASS} ký tự.`; return; }
  if (nw !== $('#pNew2').value) { err.textContent = 'Hai mật khẩu mới không khớp.'; return; }
  await saveChain; // chờ lần lưu trước xong
  if (!(await openVault($('#pOld').value))) { err.textContent = 'Mật khẩu hiện tại sai.'; return; }
  authToken = await deriveToken(nw);
  await createVault(nw, payload());
  currentPin = nw;
  flushPush();
  $('#passModal').classList.remove('open');
  toast('Đã đổi mật khẩu', 'fa-key');
});
$('#passModal').addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) $('#passModal').classList.remove('open');
});

// Rời tab → đẩy liền. Quay lại tab (sau 30s) → kéo bản mới về. Có mạng lại → sync
document.addEventListener('visibilitychange', () => {
  if (!authToken) return;
  if (document.visibilityState === 'hidden') flushPush();
  else if (Date.now() - lastPullAt > 30000) syncNow();
});
window.addEventListener('online', () => { if (authToken) syncNow(); });

/* =========================================================
   11. KHỞI CHẠY
   ========================================================= */
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderGrid, 150); });

if (!window.crypto?.subtle) {
  document.body.innerHTML = '<p style="padding:40px;text-align:center">Trình duyệt không hỗ trợ mã hoá (cần mở qua https hoặc localhost).</p>';
} else {
  let hasVault = false;
  try { hasVault = !!readVault(); } catch {}
  showLock(hasVault ? 'unlock' : 'remote');
}
