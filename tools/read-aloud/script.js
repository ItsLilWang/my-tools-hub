/* =========================================
   READ ALOUD TOOL
   - Tab Reader: dán text -> hiện bản sạch cho Edge Read Aloud
   - Tab Learn EN: dịch VI <-> EN, luôn đọc to phần tiếng Anh
   ========================================= */

// ---------- 1. Lấy các element trên trang ----------
const $ = (id) => document.getElementById(id);

const DOM = {
  app: $("app"),
  tabBtns: document.querySelectorAll(".tab-btn"),
  tabReader: $("tab-reader"),
  tabLearn: $("tab-learn"),

  // Reader
  rawText: $("raw-text"),
  readerCount: $("reader-count"),
  readerClearBtn: $("reader-clear-btn"),
  renderBtn: $("render-btn"),
  readerView: $("reader-view"),
  readerContent: $("reader-content"),
  exitReaderBtn: $("exit-reader-btn"),

  // Learn
  dirBtn: $("dir-btn"),
  dirInner: $("dir-inner"),
  srcLabel: $("src-label"),
  srcText: $("src-text"),
  learnClearBtn: $("learn-clear-btn"),
  autoSpeak: $("auto-speak"),
  translateBtn: $("translate-btn"),
  translateLabel: $("translate-label"),
  outLabel: $("out-label"),
  outText: $("out-text"),
  engineTag: $("engine-tag"),
  speakBtn: $("speak-btn"),
  stopBtn: $("stop-btn"),
  copyBtn: $("copy-btn"),
  copyLabel: $("copy-label"),
  voiceSelect: $("voice-select"),
  rateRange: $("rate-range"),
  rateValue: $("rate-value"),
  historyList: $("history-list"),
  clearHistoryBtn: $("clear-history-btn"),
};

// ---------- 2. Lưu/đọc localStorage an toàn ----------
// Bọc try/catch vì có trình duyệt chặn storage (tab ẩn danh...)
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* không lưu được thì thôi, tool vẫn chạy */
    }
  },
};

// ---------- 3. Chuyển tab ----------
function switchTab(name) {
  DOM.tabBtns.forEach((btn) =>
    btn.classList.toggle("neu-active", btn.dataset.tab === name)
  );
  DOM.tabReader.classList.toggle("hidden", name !== "reader");
  DOM.tabLearn.classList.toggle("hidden", name !== "learn");
  store.set("ra_tab", name);
}

DOM.tabBtns.forEach((btn) =>
  btn.addEventListener("click", () => switchTab(btn.dataset.tab))
);

/* =========================================
   TAB 1: READER
   ========================================= */

// Đếm số từ cho vui
function updateReaderCount() {
  const words = DOM.rawText.value.trim().split(/\s+/).filter(Boolean).length;
  DOM.readerCount.textContent = `${words} words`;
}

// Biến text thành các thẻ <p>, dùng textContent để
// mấy ký tự như < > trong text không làm vỡ trang
function renderParagraphs(text) {
  DOM.readerContent.innerHTML = "";
  const lines = text.split("\n").filter((line) => line.trim() !== "");

  lines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line.trim();
    DOM.readerContent.appendChild(p);
  });
}

function openReader() {
  const text = DOM.rawText.value;
  if (!text.trim()) {
    DOM.rawText.focus();
    return;
  }
  renderParagraphs(text);
  speechSynthesis.cancel(); // lỡ tab Learn đang đọc thì tắt

  // Ẩn toàn bộ app (header, tab, nút có chữ) -> Edge chỉ còn nội dung để đọc
  DOM.app.classList.add("hidden");
  DOM.readerView.classList.remove("hidden");
  DOM.exitReaderBtn.classList.remove("hidden");
  window.scrollTo(0, 0);
}

function closeReader() {
  DOM.readerView.classList.add("hidden");
  DOM.exitReaderBtn.classList.add("hidden");
  DOM.app.classList.remove("hidden");
  // Text cũ vẫn giữ nguyên trong ô nhập
}

DOM.rawText.addEventListener("input", updateReaderCount);
DOM.renderBtn.addEventListener("click", openReader);
DOM.exitReaderBtn.addEventListener("click", closeReader);

// Nút xoá nhanh ô Reader
DOM.readerClearBtn.addEventListener("click", () => {
  DOM.rawText.value = "";
  updateReaderCount();
  DOM.rawText.focus();
});

// Phím Esc cũng thoát Reader
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !DOM.readerView.classList.contains("hidden")) {
    closeReader();
  }
});

/* =========================================
   TAB 2: LEARN EN — CHIỀU DỊCH
   ========================================= */

// Mỗi chiều dịch có: ngôn ngữ nguồn/đích + chữ hiển thị
const DIRECTIONS = {
  "vi-en": {
    sl: "vi",
    tl: "en",
    srcLabel: "Tiếng Việt",
    outLabel: "English",
    placeholder:
      "Nhập câu tiếng Việt cần dịch, ví dụ: Hôm nay tôi hơi mệt nhưng vẫn muốn hoàn thành công việc.",
    outPlaceholder: "Bản dịch tiếng Anh sẽ hiển thị tại đây.",
  },
  "en-vi": {
    sl: "en",
    tl: "vi",
    srcLabel: "English",
    outLabel: "Tiếng Việt",
    placeholder: "Enter an English sentence to translate, e.g. I'm a bit tired, but I still want to finish my work.",
    outPlaceholder: "Bản dịch tiếng Việt sẽ hiển thị tại đây.",
  },
};

let dir = store.get("ra_dir", "vi-en");
if (!DIRECTIONS[dir]) dir = "vi-en";

// Hiện chữ xám gợi ý trong khung kết quả khi chưa có bản dịch
function showOutPlaceholder() {
  DOM.outText.innerHTML = "";
  const span = document.createElement("span");
  span.className = "text-gray-600 text-base";
  span.dataset.placeholder = "1";
  span.textContent = DIRECTIONS[dir].outPlaceholder;
  DOM.outText.appendChild(span);
  DOM.engineTag.textContent = "";
  renderShadow();
}

function applyDirection() {
  const d = DIRECTIONS[dir];
  DOM.dirInner.classList.toggle("is-reversed", dir === "en-vi");
  DOM.srcLabel.textContent = d.srcLabel;
  DOM.outLabel.textContent = d.outLabel;
  DOM.srcText.placeholder = d.placeholder;
  DOM.srcText.lang = d.sl; // giúp trình duyệt kiểm tra chính tả đúng ngôn ngữ
}

function setDirection(newDir) {
  dir = newDir;
  store.set("ra_dir", dir);
  applyDirection();
}

// Bấm công tắc: đổi chiều. Nếu đã có bản dịch thì đảo luôn 2 bên cho tiện
DOM.dirBtn.addEventListener("click", () => {
  clearAiResult();
  const src = DOM.srcText.value.trim();
  const out = currentOutput();
  setDirection(dir === "vi-en" ? "en-vi" : "vi-en");

  if (src && out) {
    DOM.srcText.value = out;
    showOutput(src, "");
  } else {
    showOutPlaceholder();
  }
});

/* =========================================
   TAB 2: LEARN EN — DỊCH
   ========================================= */

// Engine chính: Google Translate (endpoint không chính thức, dịch tự nhiên)
async function translateGoogle(text, sl, tl) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("Google lỗi " + res.status);
  const data = await res.json();

  // Kết quả là mảng các câu: [[["Hello", "Xin chào"], ...], ...]
  return data[0].map((part) => part[0]).join("");
}

// Engine dự phòng: MyMemory (chính thức, có giới hạn mỗi ngày)
async function translateMyMemory(text, sl, tl) {
  const url =
    `https://api.mymemory.translated.net/get?langpair=${sl}|${tl}&q=` +
    encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("MyMemory lỗi " + res.status);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails);

  return data.responseData.translatedText;
}

// Thử Google trước, hỏng thì chuyển MyMemory
async function translate(text, sl, tl) {
  try {
    return { out: await translateGoogle(text, sl, tl), engine: "Google" };
  } catch (err) {
    console.warn("Google fail, chuyển MyMemory:", err);
    return { out: await translateMyMemory(text, sl, tl), engine: "MyMemory" };
  }
}

function showOutput(text, engine) {
  DOM.outText.textContent = text;
  DOM.engineTag.textContent = engine ? `· via ${engine}` : "";
  renderShadow();
}

// Lấy bản dịch đang hiển thị (bỏ qua chữ gợi ý xám)
function currentOutput() {
  return DOM.outText.querySelector("[data-placeholder]")
    ? ""
    : DOM.outText.textContent.trim();
}

// Câu tiếng Anh để đọc: VI->EN thì là bản dịch, EN->VI thì là câu m gõ
function currentEnglish() {
  return dir === "vi-en" ? currentOutput() : DOM.srcText.value.trim();
}

async function handleTranslate() {
  const src = DOM.srcText.value.trim();
  if (!src) {
    DOM.srcText.focus();
    return;
  }

  const { sl, tl } = DIRECTIONS[dir];
  DOM.translateBtn.disabled = true;
  DOM.translateLabel.textContent = "Đang dịch...";
  clearAiResult();

  // VI -> EN: đổi từ viết tắt / văn nói (t, m, ko, đc...) sang chữ đầy đủ trước khi dịch
  const toSend = dir === "vi-en" ? normalizeVi(src) : src;

  try {
    const { out, engine } = await translate(toSend, sl, tl);
    showOutput(out, engine);
    if (toSend !== src) {
      DOM.engineTag.textContent += " · đã chuẩn hoá viết tắt";
      DOM.engineTag.title = "Câu đã gửi dịch: " + toSend;
    } else {
      DOM.engineTag.title = "";
    }

    // Lịch sử luôn lưu theo cặp vi/en, kèm chiều dịch
    const vi = dir === "vi-en" ? src : out;
    const en = dir === "vi-en" ? out : src;
    addHistory({ vi, en, dir });

    if (DOM.autoSpeak.checked) speak(en);
  } catch (err) {
    console.error(err);
    DOM.outText.innerHTML =
      '<span data-placeholder="1" class="text-gray-500 text-base">Không thể dịch lúc này. Vui lòng kiểm tra kết nối mạng và thử lại.</span>';
    DOM.engineTag.textContent = "";
    renderShadow();
  } finally {
    DOM.translateBtn.disabled = false;
    DOM.translateLabel.textContent = "Dịch";
  }
}

DOM.translateBtn.addEventListener("click", handleTranslate);

// Ctrl + Enter (hoặc Cmd + Enter trên Mac) để dịch nhanh
DOM.srcText.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleTranslate();
  }
});

// Nút xoá nhanh: xoá cả câu gõ lẫn bản dịch, dừng đọc, focus lại để gõ tiếp
DOM.learnClearBtn.addEventListener("click", () => {
  DOM.srcText.value = "";
  clearAiResult();
  stopShadow();
  speechSynthesis.cancel();
  showOutPlaceholder();
  DOM.srcText.focus();
});

/* =========================================
   TAB 2: LEARN EN — ĐỌC TO (Web Speech API)
   ========================================= */

let englishVoices = [];

// Lấy danh sách giọng tiếng Anh, ưu tiên giọng "Natural" của Edge
function loadVoices() {
  const all = speechSynthesis.getVoices();
  if (!all.length) return; // chưa tải xong, đợi sự kiện voiceschanged

  englishVoices = all
    .filter((v) => v.lang.toLowerCase().startsWith("en"))
    .sort((a, b) => {
      const score = (v) =>
        (/natural/i.test(v.name) ? 2 : 0) + (v.lang === "en-US" ? 1 : 0);
      return score(b) - score(a);
    });

  DOM.voiceSelect.innerHTML = "";
  if (!englishVoices.length) {
    DOM.voiceSelect.innerHTML = "<option>Không có giọng tiếng Anh</option>";
    return;
  }

  englishVoices.forEach((v, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${v.name.replace("Microsoft ", "")} (${v.lang})`;
    DOM.voiceSelect.appendChild(opt);
  });

  // Chọn lại giọng m đã chọn lần trước (nếu còn)
  const saved = store.get("ra_voice", null);
  const savedIndex = englishVoices.findIndex((v) => v.name === saved);
  DOM.voiceSelect.value = savedIndex >= 0 ? savedIndex : 0;
}

speechSynthesis.addEventListener("voiceschanged", loadVoices);
loadVoices();

DOM.voiceSelect.addEventListener("change", () => {
  const v = englishVoices[DOM.voiceSelect.value];
  if (v) store.set("ra_voice", v.name);
});

// Thanh tốc độ
function updateRateLabel() {
  DOM.rateValue.textContent = `${Number(DOM.rateRange.value).toFixed(1)}x`;
}
DOM.rateRange.value = store.get("ra_rate", 1);
updateRateLabel();
DOM.rateRange.addEventListener("input", () => {
  updateRateLabel();
  store.set("ra_rate", Number(DOM.rateRange.value));
});

// Đọc 1 đoạn tiếng Anh, trả về Promise -> chờ được tới khi đọc xong.
// Có "lưới an toàn" hẹn giờ: lỡ trình duyệt không báo đọc xong thì vẫn chạy tiếp
function speakRaw(text) {
  return new Promise((resolve) => {
    if (!text) return resolve();
    speechSynthesis.cancel(); // dừng câu đang đọc dở (nếu có)

    const u = new SpeechSynthesisUtterance(text);
    const voice = englishVoices[DOM.voiceSelect.value];
    if (voice) u.voice = voice;
    u.lang = voice ? voice.lang : "en-US";
    u.rate = Number(DOM.rateRange.value);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(safety);
      resolve();
    };
    const words = text.split(/\s+/).length;
    const safety = setTimeout(finish, (words * 700) / u.rate + 4000);
    u.onend = finish;
    u.onerror = finish;

    speechSynthesis.speak(u);
  });
}

// Đọc thường (nút Đọc, lịch sử...): tắt Shadowing nếu đang chạy
function speak(text) {
  stopShadow();
  speakRaw(text);
}

DOM.speakBtn.addEventListener("click", () => speak(currentEnglish()));
DOM.stopBtn.addEventListener("click", () => {
  stopShadow();
  speechSynthesis.cancel();
});

DOM.copyBtn.addEventListener("click", async () => {
  const out = currentOutput();
  if (!out) return;
  try {
    await navigator.clipboard.writeText(out);
    DOM.copyLabel.textContent = "Copied!";
  } catch {
    DOM.copyLabel.textContent = "Không sao chép được";
  }
  setTimeout(() => (DOM.copyLabel.textContent = "Copy"), 1200);
});

/* =========================================
   TAB 2: LEARN EN — LỊCH SỬ
   ========================================= */

const HISTORY_MAX = 30;
let historyItems = store.get("ra_history", []);

function addHistory(item) {
  // Xoá bản trùng (cùng câu tiếng Anh) rồi đẩy câu mới lên đầu
  historyItems = historyItems.filter((h) => h.en !== item.en);
  historyItems.unshift(item);
  historyItems = historyItems.slice(0, HISTORY_MAX);
  store.set("ra_history", historyItems);
  renderHistory();
}

function renderHistory() {
  DOM.historyList.innerHTML = "";

  if (!historyItems.length) {
    DOM.historyList.innerHTML =
      '<li class="text-sm text-gray-600 px-2 py-1">Chưa có câu nào. Các câu đã dịch sẽ được lưu tại đây.</li>';
    return;
  }

  historyItems.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item px-4 py-3 cursor-pointer flex items-start gap-3";
    li.title = "Nhấn để nghe lại";

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-play text-gray-500 text-xs mt-1.5 shrink-0";

    const textBox = document.createElement("div");
    textBox.className = "flex flex-col gap-0.5 min-w-0";

    const enLine = document.createElement("span");
    enLine.className = "text-sm text-gray-200 break-words";
    enLine.textContent = item.en;

    const viLine = document.createElement("span");
    viLine.className = "text-xs text-gray-500 break-words";
    viLine.textContent = item.vi;

    textBox.append(enLine, viLine);
    li.append(icon, textBox);

    // Bấm vào: đưa câu lên khung chính (đúng chiều dịch cũ) và đọc lại
    li.addEventListener("click", () => {
      clearAiResult();
      const itemDir = DIRECTIONS[item.dir] ? item.dir : "vi-en";
      setDirection(itemDir);
      DOM.srcText.value = itemDir === "vi-en" ? item.vi : item.en;
      showOutput(itemDir === "vi-en" ? item.en : item.vi, "");
      speak(item.en);
    });

    DOM.historyList.appendChild(li);
  });
}

DOM.clearHistoryBtn.addEventListener("click", () => {
  if (!historyItems.length || !confirm("Xoá toàn bộ lịch sử dịch? Thao tác này không thể hoàn tác.")) return;
  historyItems = [];
  store.set("ra_history", historyItems);
  renderHistory();
});


/* =========================================
   TAB 2: LUYỆN NHẠI (SHADOWING)
   A. Tách câu thành cụm ngắn
   B. Đọc từng cụm -> nghỉ cho m nhại -> cụm tiếp
   C. Bấm vào từ -> xem IPA
   ========================================= */

// ---------- A. Tách cụm ----------
// Từ nối: cắt TRƯỚC những từ này khi cụm quá dài
const CONNECTORS = new Set([
  "and", "but", "or", "so", "because", "when", "while", "if", "that",
  "which", "who", "where", "although", "though", "after", "before",
  "until", "since", "than", "unless", "whether", "then",
]);
// Giới từ: chỉ cắt trước chúng khi cụm đã khá dài (tránh tách "have / to")
const PREPOSITIONS = new Set([
  "for", "over", "with", "in", "on", "at", "from", "about", "into",
  "during", "through", "without", "between", "under", "across", "around",
]);
const MIN_WORDS = 3; // cụm ngắn nhất
const MAX_WORDS = 7; // dài hơn thì tìm chỗ cắt

// Cắt 1 đoạn (không còn dấu câu) thành các cụm vừa miệng
function splitLongPiece(piece) {
  const words = piece.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_WORDS) return [piece];

  const out = [];
  let current = [];
  words.forEach((word, i) => {
    const bare = word.toLowerCase().replace(/[^a-z']/g, "");
    const left = words.length - i; // số từ còn lại tính cả từ này
    const atConnector = current.length >= MIN_WORDS && CONNECTORS.has(bare);
    const atPreposition = current.length >= MAX_WORDS - 2 && PREPOSITIONS.has(bare);
    const tooLong = current.length >= MAX_WORDS + 3;
    // Cắt trước từ nối / giới từ, hoặc cắt cưỡng bức nếu quá dài (miễn phần sau không quá cụt)
    if ((atConnector || atPreposition || tooLong) && left >= 2) {
      out.push(current.join(" "));
      current = [];
    }
    current.push(word);
  });
  if (current.length) out.push(current.join(" "));
  return out;
}

function splitChunks(text) {
  const chunks = [];
  // 1. Tách câu theo . ! ?
  const sentences = text.split(/(?<=[.!?…])\s+/).filter((t) => t.trim());
  sentences.forEach((sentence) => {
    // 2. Tách tiếp theo dấu phẩy, chấm phẩy, hai chấm, gạch ngang (giữ dấu lại)
    const pieces = sentence.split(/(?<=[,;:—–])\s+|\s+(?=[—–]\s)/).filter((t) => t.trim());
    // 3. Cụm nào vẫn dài thì cắt ở từ nối
    pieces.forEach((piece) => chunks.push(...splitLongPiece(piece.trim())));
  });

  // Gộp cụm quá cụt (1-2 từ) vào cụm trước cho tự nhiên
  const merged = [];
  chunks.forEach((c) => {
    const n = c.split(/\s+/).length;
    const prev = merged[merged.length - 1];
    if (prev && n < 2 && !/[.!?…]$/.test(prev)) {
      merged[merged.length - 1] = `${prev} ${c}`;
    } else {
      merged.push(c);
    }
  });
  return merged;
}

// ---------- Vẽ danh sách cụm ----------
let chunks = [];

const SHADOW_EL = {
  btn: $("shadow-btn"),
  icon: $("shadow-icon"),
  label: $("shadow-label"),
  status: $("shadow-status"),
  statusText: $("shadow-status-text"),
  bar: $("turn-bar"),
  list: $("chunk-list"),
  ipa: $("ipa-box"),
};

function renderShadow() {
  stopShadow();
  const english = currentEnglish();
  chunks = english ? splitChunks(english) : [];
  SHADOW_EL.list.innerHTML = "";

  if (!chunks.length) {
    SHADOW_EL.list.innerHTML =
      '<p class="text-sm text-gray-600 px-1">Sau khi dịch, câu tiếng Anh sẽ được chia thành các cụm ngắn tại đây để bạn luyện nói theo.</p>';
    SHADOW_EL.btn.disabled = true;
    SHADOW_EL.btn.classList.add("opacity-50");
    return;
  }
  SHADOW_EL.btn.disabled = false;
  SHADOW_EL.btn.classList.remove("opacity-50");

  chunks.forEach((chunk, index) => {
    const row = document.createElement("div");
    row.className = "chunk";
    row.dataset.index = index;

    const play = document.createElement("button");
    play.className = "chunk-play neu-btn";
    play.title = "Đọc cụm này";
    play.innerHTML = '<i class="fa-solid fa-play"></i>';
    play.addEventListener("click", () => {
      speak(chunk);
      highlightChunk(index);
    });

    const text = document.createElement("div");
    text.className = "chunk-text";
    // Mỗi từ là 1 span bấm được để xem IPA
    chunk.split(/\s+/).forEach((token, i) => {
      if (i) text.appendChild(document.createTextNode(" "));
      const span = document.createElement("span");
      span.className = "word";
      span.textContent = token;
      span.addEventListener("click", () => pickWord(span, token));
      text.appendChild(span);
    });

    row.append(play, text);
    SHADOW_EL.list.appendChild(row);
  });
}

function highlightChunk(index) {
  SHADOW_EL.list.querySelectorAll(".chunk").forEach((row) =>
    row.classList.toggle("is-active", Number(row.dataset.index) === index)
  );
}

// ---------- Nút chọn Lặp / Nghỉ ----------
const shadowSettings = {
  repeat: store.get("ra_repeat", 1),
  pause: store.get("ra_pause", 1.5),
};

document.querySelectorAll("[data-seg]").forEach((group) => {
  const key = group.dataset.seg;
  const buttons = group.querySelectorAll(".seg-btn");
  const paint = () =>
    buttons.forEach((b) =>
      b.classList.toggle("neu-active", Number(b.dataset.value) === shadowSettings[key])
    );
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      shadowSettings[key] = Number(b.dataset.value);
      store.set(`ra_${key}`, shadowSettings[key]);
      paint();
    })
  );
  paint();
});

// ---------- B. Chạy Shadowing ----------
// runId: mỗi lần bấm Start tăng lên; vòng lặp cũ thấy runId đổi thì tự dừng
let runId = 0;
let shadowRunning = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setStatus(text, mode) {
  SHADOW_EL.status.classList.toggle("hidden", !text);
  SHADOW_EL.statusText.textContent = text || "";
  SHADOW_EL.statusText.className =
    "whitespace-nowrap " + (mode === "you" ? "text-red-500 font-bold" : "text-gray-400");
}

// Thanh đỏ chạy hết trong `ms` mili-giây (thời gian m nhại)
function runTurnBar(ms) {
  const bar = SHADOW_EL.bar;
  bar.style.transition = "none";
  bar.style.width = "0%";
  void bar.offsetWidth; // ép trình duyệt vẽ lại trước khi chạy animation
  bar.style.transition = `width ${ms}ms linear`;
  bar.style.width = "100%";
}

function resetTurnBar() {
  SHADOW_EL.bar.style.transition = "none";
  SHADOW_EL.bar.style.width = "0%";
}

function paintShadowButton() {
  SHADOW_EL.icon.className = shadowRunning
    ? "fa-solid fa-stop"
    : "fa-solid fa-microphone-lines";
  SHADOW_EL.label.textContent = shadowRunning ? "Dừng" : "Shadowing";
}

function stopShadow() {
  if (!shadowRunning) return;
  runId++;
  shadowRunning = false;
  speechSynthesis.cancel();
  setStatus("");
  resetTurnBar();
  highlightChunk(-1);
  paintShadowButton();
}

async function startShadow() {
  if (!chunks.length) return;
  const myRun = ++runId;
  shadowRunning = true;
  paintShadowButton();
  const alive = () => myRun === runId;

  for (let i = 0; i < chunks.length && alive(); i++) {
    for (let rep = 1; rep <= shadowSettings.repeat && alive(); rep++) {
      highlightChunk(i);
      const tag = `Cụm ${i + 1}/${chunks.length}` +
        (shadowSettings.repeat > 1 ? ` · lần ${rep}/${shadowSettings.repeat}` : "");

      // 1. Nghe
      setStatus(`🔊 Nghe · ${tag}`, "listen");
      resetTurnBar();
      const t0 = performance.now();
      await speakRaw(chunks[i]);
      if (!alive()) return;

      // 2. Đến lượt m: nghỉ bằng thời gian vừa đọc x hệ số, tối thiểu 1.2s
      const turn = Math.max(1200, (performance.now() - t0) * shadowSettings.pause);
      setStatus(`🎤 Đến lượt bạn · ${tag}`, "you");
      runTurnBar(turn);
      await sleep(turn);
    }
  }

  if (alive()) {
    shadowRunning = false;
    paintShadowButton();
    resetTurnBar();
    highlightChunk(-1);
    setStatus("✅ Hoàn thành! Nhấn Shadowing để luyện lại.", "listen");
  }
}

SHADOW_EL.btn.addEventListener("click", () => {
  if (shadowRunning) stopShadow();
  else startShadow();
});

// ---------- C. Bấm từ -> xem IPA ----------
// IPA lấy từ từ điển nhúng sẵn (ipa-dict.js, ~40k từ thông dụng, giọng Mỹ):
// tra ngay trong máy, không phụ thuộc mạng. Chỉ tải file khi bấm từ lần đầu.
// Nghĩa của từ thì thử lấy thêm từ Free Dictionary API, lỗi cũng không sao.

let ipaDictPromise = null;
function loadIpaDict() {
  if (window.IPA_DICT) return Promise.resolve(window.IPA_DICT);
  if (!ipaDictPromise) {
    // Dùng thẻ <script> thay vì fetch -> mở file trực tiếp trên máy (file://) vẫn chạy
    ipaDictPromise = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "ipa-dict.js";
      tag.onload = () => resolve(window.IPA_DICT || {});
      tag.onerror = () => {
        ipaDictPromise = null; // cho phép thử lại lần sau
        reject(new Error("Không tải được ipa-dict.js"));
      };
      document.head.appendChild(tag);
    });
  }
  return ipaDictPromise;
}

// Thử thêm dạng gốc cho từ chia đuôi: finished -> finish, tries -> try...
function wordVariants(word) {
  const v = [word];
  const add = (x) => x.length > 1 && !v.includes(x) && v.push(x);
  if (word.endsWith("'s")) add(word.slice(0, -2));
  if (word.endsWith("ies")) add(word.slice(0, -3) + "y");
  if (word.endsWith("es")) add(word.slice(0, -2));
  if (word.endsWith("s")) add(word.slice(0, -1));
  if (word.endsWith("ied")) add(word.slice(0, -3) + "y");
  if (word.endsWith("ed")) { add(word.slice(0, -2)); add(word.slice(0, -1)); }
  if (word.endsWith("ing")) { add(word.slice(0, -3)); add(word.slice(0, -3) + "e"); }
  return v;
}

async function localIpa(word) {
  const dict = await loadIpaDict();
  for (const v of wordVariants(word)) {
    if (dict[v]) return { base: v, ipa: dict[v] };
  }
  return null;
}

// Nghĩa (tiếng Anh) từ Free Dictionary API — có hẹn giờ 5s, lỗi thì trả null
const defCache = new Map();
async function fetchDefinition(word) {
  if (defCache.has(word)) return defCache.get(word);
  let result = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      "https://api.dictionaryapi.dev/api/v2/entries/en/" + encodeURIComponent(word),
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const entry = Array.isArray(data) ? data[0] : null;
      const meaning = (entry && entry.meanings && entry.meanings[0]) || {};
      const def = ((meaning.definitions || [])[0] || {}).definition || "";
      const ipa = (entry && (entry.phonetic ||
        ((entry.phonetics || []).find((p) => p.text) || {}).text)) || "";
      result = { pos: meaning.partOfSpeech || "", def, ipa };
    }
  } catch (err) {
    console.warn("Không lấy được nghĩa:", err);
  }
  defCache.set(word, result);
  return result;
}

function showIpa(word, ipaInfo) {
  const box = SHADOW_EL.ipa;
  box.innerHTML = "";
  box.className = "neu-pressed px-4 py-3 text-sm flex flex-col gap-1.5";

  const top = document.createElement("div");
  top.className = "flex flex-wrap items-center gap-x-3 gap-y-1";

  const w = document.createElement("span");
  w.className = "text-lg font-bold text-white";
  w.textContent = word;

  const ipa = document.createElement("span");
  ipa.className = "text-lg text-red-500";
  ipa.textContent = ipaInfo ? ipaInfo.ipa : "";

  const play = document.createElement("button");
  play.className = "neu-btn px-3 py-1 text-xs text-gray-300";
  play.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  play.title = "Đọc từ này";
  play.addEventListener("click", () => speak(word));

  // Link Cambridge để nghe giọng người thật / xem chi tiết
  const link = document.createElement("a");
  link.className = "text-xs text-gray-500 hover:text-red-500 transition ml-auto";
  link.href =
    "https://dictionary.cambridge.org/dictionary/english/" +
    encodeURIComponent((ipaInfo && ipaInfo.base) || word);
  link.target = "_blank";
  link.rel = "noopener";
  link.innerHTML = 'Cambridge <i class="fa-solid fa-arrow-up-right-from-square"></i>';

  top.append(w, ipa, play, link);

  const sub = document.createElement("span");
  sub.className = "text-xs text-gray-500";
  const parts = [];
  if (ipaInfo && ipaInfo.base !== word) parts.push(`dạng gốc: ${ipaInfo.base}`);
  if (!ipaInfo) parts.push("Từ này chưa có trong từ điển IPA, đang tra cứu trực tuyến...");
  sub.textContent = parts.join(" · ");

  box.append(top, sub);
  return { ipaEl: ipa, subEl: sub, parts };
}

let pickToken = 0; // bấm từ khác nhanh -> bỏ kết quả của lần bấm cũ

async function pickWord(span, token) {
  const word = token.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z']+|[^a-z']+$/g, "");
  if (!word) return;
  const myPick = ++pickToken;

  SHADOW_EL.list.querySelectorAll(".word.is-picked").forEach((el) => el.classList.remove("is-picked"));
  span.classList.add("is-picked");
  speak(word);

  // 1. IPA từ từ điển nhúng sẵn (nhanh, không cần mạng)
  let ipaInfo = null;
  try {
    ipaInfo = await localIpa(word);
  } catch (err) {
    console.error(err);
  }
  if (myPick !== pickToken) return;
  const ui = showIpa(word, ipaInfo);

  // 2. Nghĩa từ API (có thì hiện thêm, không có thì thôi)
  const extra = await fetchDefinition(ipaInfo ? ipaInfo.base : word);
  if (myPick !== pickToken) return;

  const parts = ui.parts.filter((p) => !p.startsWith("Từ này chưa có"));
  if (!ipaInfo && extra && extra.ipa) ui.ipaEl.textContent = extra.ipa;
  if (!ipaInfo && !(extra && extra.ipa)) parts.push("Không tìm thấy IPA cho từ này. Bạn có thể xem trên Cambridge.");
  if (extra && extra.pos) parts.push(extra.pos);
  if (extra && extra.def) parts.push(extra.def);
  ui.subEl.textContent = parts.join(" · ");
}


/* =========================================
   TAB 2: CHUẨN HOÁ VIẾT TẮT + NATURAL ENGLISH (AI)
   A. normalizeVi: "t mệt vãi, ko làm đc" -> "tôi mệt quá, không làm được"
   B. Gemini gợi ý cách nói tự nhiên (casual / neutral + ghi chú)
   C. Hỏi AI: sao chép câu hỏi và mở Claude, không cần key
   ========================================= */

// ---------- A. Từ điển viết tắt / văn nói ----------
// Chỉ thay khi khớp NGUYÊN TỪ (không đụng vào giữa từ khác)
const VI_SHORTHAND = {
  // xưng hô
  t: "tôi", tao: "tôi", tui: "tôi", tớ: "tôi",
  m: "bạn", mày: "bạn", mi: "bạn",
  mk: "mình", mik: "mình",
  ổng: "ông ấy", bả: "bà ấy",
  ae: "anh em", ny: "người yêu", ck: "chồng", vk: "vợ",
  // phủ định / khẳng định
  ko: "không", k: "không", kh: "không", hok: "không", hông: "không",
  hong: "không", khum: "không", hem: "không", kg: "không",
  đc: "được", dc: "được", đk: "được", dk: "được",
  oke: "ổn", oki: "ổn", okela: "ổn",
  // từ hay dùng
  r: "rồi", rùi: "rồi", vs: "với", j: "gì",
  ntn: "như thế nào", kb: "không biết", bik: "biết", bít: "biết",
  ng: "người", nma: "nhưng mà", nhma: "nhưng mà",
  z: "vậy", dz: "vậy", zậy: "vậy", dzậy: "vậy",
  thik: "thích", iu: "yêu", cx: "cũng", cg: "cũng", lun: "luôn",
  trc: "trước", lm: "làm", ns: "nói", nc: "nói chuyện",
  bh: "bây giờ", bjo: "bây giờ", h: "giờ", ms: "mới", đag: "đang",
  hnay: "hôm nay", hqua: "hôm qua", tks: "cảm ơn", thks: "cảm ơn",
  // nhấn mạnh
  vãi: "quá", vl: "quá", vcl: "quá", vkl: "quá", vch: "quá",
};

function normalizeVi(text) {
  return text.normalize("NFC").replace(/[\p{L}\p{M}]+/gu, (word) => {
    const full = VI_SHORTHAND[word.toLowerCase()];
    if (!full) return word;
    // Giữ viết hoa chữ đầu nếu từ gốc viết hoa (đầu câu)
    return word[0] !== word[0].toLowerCase()
      ? full[0].toUpperCase() + full.slice(1)
      : full;
  });
}

// ---------- Cài đặt AI ----------
const AI_DEFAULT_MODEL = "gemini-flash-latest";

const AI_EL = {
  btn: $("ai-btn"),
  label: $("ai-label"),
  askBtn: $("ask-ai-btn"),
  askLabel: $("ask-ai-label"),
  settingsBtn: $("ai-settings-btn"),
  settings: $("ai-settings"),
  key: $("ai-key"),
  keyToggle: $("ai-key-toggle"),
  model: $("ai-model"),
  saved: $("ai-saved"),
  result: $("ai-result"),
};

AI_EL.key.value = store.get("ra_ai_key", "");
AI_EL.model.value = store.get("ra_ai_model", AI_DEFAULT_MODEL);

let savedTimer = null;
function flashSaved() {
  AI_EL.saved.textContent = "Đã lưu";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => (AI_EL.saved.textContent = ""), 1200);
}

AI_EL.key.addEventListener("input", () => {
  store.set("ra_ai_key", AI_EL.key.value.trim());
  flashSaved();
});
AI_EL.model.addEventListener("input", () => {
  store.set("ra_ai_model", AI_EL.model.value.trim() || AI_DEFAULT_MODEL);
  flashSaved();
});
AI_EL.keyToggle.addEventListener("click", () => {
  const show = AI_EL.key.type === "password";
  AI_EL.key.type = show ? "text" : "password";
  AI_EL.keyToggle.querySelector("i").className = show
    ? "fa-solid fa-eye-slash"
    : "fa-solid fa-eye";
});
AI_EL.settingsBtn.addEventListener("click", () => {
  AI_EL.settings.classList.toggle("hidden");
  AI_EL.settingsBtn.classList.toggle("neu-active", !AI_EL.settings.classList.contains("hidden"));
});

// ---------- B. Gọi Gemini ----------
function buildAiPrompt(source, isVietnamese, machine) {
  return [
    "You are an American English speaking coach for a Vietnamese learner.",
    isVietnamese
      ? `The learner wants to say this in English (written in casual Vietnamese, may contain shorthand or slang): """${source}"""`
      : `The learner wrote this English sentence and wants it to sound natural: """${source}"""`,
    machine ? `Machine translation for reference (often too literal): """${machine}"""` : "",
    "Give natural American English ways to say it, the way a native speaker would actually say it.",
    'Return ONLY JSON in this exact shape: {"casual": "...", "neutral": "...", "notes": ["...", "..."]}',
    "- casual: everyday spoken American English between friends; contractions are fine; avoid profanity and heavy slang unless the original is clearly very informal.",
    "- neutral: polite and natural, suitable for work or talking to strangers.",
    "- notes: 2-3 short notes written in Vietnamese explaining key phrase choices or useful expressions (quote the English phrase). Each note under 25 words.",
    "Keep the original meaning. Do not add new information.",
  ].filter(Boolean).join("\n");
}

// Lỗi từ Google -> câu dễ hiểu
function aiErrorMessage(status, message) {
  const msg = String(message || "");
  if (status === 400 && /api key/i.test(msg)) return "API key không hợp lệ. Vui lòng kiểm tra lại key trong phần cài đặt.";
  if (status === 403) return "Key bị từ chối. Nếu bạn đã giới hạn key, hãy kiểm tra lại trang web và API được phép.";
  if (status === 404) return `Không tìm thấy model "${AI_EL.model.value}". Vui lòng kiểm tra tên model trong phần cài đặt.`;
  if (status === 429) return "Đã hết lượt sử dụng miễn phí trong lúc này. Vui lòng thử lại sau, hoặc dùng nút Hỏi AI.";
  if (status >= 500) return "Máy chủ Gemini đang bận. Vui lòng thử lại sau ít phút.";
  return "Không thể gọi AI lúc này" + (msg ? `: ${msg}` : ".");
}

async function callGemini(prompt) {
  const key = store.get("ra_ai_key", "");
  const model = store.get("ra_ai_model", AI_DEFAULT_MODEL) || AI_DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=` +
    encodeURIComponent(key);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(aiErrorMessage(res.status, data.error && data.error.message));
  }

  // Ghép các phần chữ (bỏ phần "suy nghĩ" nếu model có trả về)
  const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, "");
  const json = JSON.parse(clean);
  if (!json.casual && !json.neutral) throw new Error("AI trả về kết quả không đúng định dạng. Vui lòng thử lại.");
  return json;
}

// ---------- Hiển thị kết quả AI ----------
function clearAiResult() {
  AI_EL.result.innerHTML = "";
  AI_EL.result.classList.add("hidden");
}

function showAiMessage(text) {
  AI_EL.result.innerHTML = "";
  const p = document.createElement("p");
  p.className = "text-sm text-gray-500 px-1";
  p.textContent = text;
  AI_EL.result.appendChild(p);
  AI_EL.result.classList.remove("hidden");
}

// Chọn 1 câu AI làm câu tiếng Anh chính -> Mimic + lịch sử dùng câu này
function useSentence(sentence, card) {
  const vi = dir === "vi-en" ? DOM.srcText.value.trim() : currentOutput();
  if (dir === "vi-en") {
    showOutput(sentence, "AI");
  } else {
    DOM.srcText.value = sentence;
    renderShadow();
  }
  // Thay bản dịch máy của cùng câu tiếng Việt trong lịch sử, tránh bị trùng 2 dòng
  historyItems = historyItems.filter((h) => h.vi !== vi);
  addHistory({ vi, en: sentence, dir });
  AI_EL.result.querySelectorAll(".ai-card").forEach((c) => c.classList.remove("is-chosen"));
  card.classList.add("is-chosen");
}

function miniButton(html, title, onClick) {
  const b = document.createElement("button");
  b.className = "ai-mini neu-btn";
  b.innerHTML = html;
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function renderAiResult(json) {
  AI_EL.result.innerHTML = "";
  const rows = [
    ["Casual", "Văn nói hằng ngày", json.casual],
    ["Neutral", "Lịch sự, dùng ở chỗ làm", json.neutral],
  ];

  rows.forEach(([tag, hint, sentence]) => {
    if (!sentence) return;
    const card = document.createElement("div");
    card.className = "ai-card";

    const head = document.createElement("div");
    head.className = "flex flex-wrap items-center justify-between gap-2";
    const label = document.createElement("span");
    label.className = "flex items-baseline gap-2";
    label.innerHTML = `<span class="ai-tag">${tag}</span>`;
    const hintEl = document.createElement("span");
    hintEl.className = "text-xs text-gray-600";
    hintEl.textContent = hint;
    label.appendChild(hintEl);

    const actions = document.createElement("div");
    actions.className = "flex gap-2";
    actions.append(
      miniButton('<i class="fa-solid fa-volume-high"></i> Đọc', "Đọc câu này", () => speak(sentence)),
      miniButton('<i class="fa-regular fa-copy"></i> Copy', "Sao chép", async (e) => {
        const btn = e.currentTarget;
        try {
          await navigator.clipboard.writeText(sentence);
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Đã chép';
        } catch {
          btn.textContent = "Không sao chép được";
        }
        setTimeout(() => (btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy'), 1200);
      }),
      miniButton('<i class="fa-solid fa-check"></i> Dùng câu này', "Dùng câu này cho Mimic và lưu vào lịch sử", () =>
        useSentence(sentence, card)
      )
    );
    head.append(label, actions);

    const text = document.createElement("p");
    text.className = "text-lg text-gray-100 leading-relaxed";
    text.textContent = sentence;

    card.append(head, text);
    AI_EL.result.appendChild(card);
  });

  const notes = Array.isArray(json.notes) ? json.notes.filter(Boolean) : [];
  if (notes.length) {
    const box = document.createElement("ul");
    box.className = "flex flex-col gap-1.5 px-1 text-sm text-gray-400";
    notes.forEach((n) => {
      const li = document.createElement("li");
      li.className = "flex gap-2";
      const dot = document.createElement("span");
      dot.className = "text-red-500";
      dot.textContent = "•";
      const t = document.createElement("span");
      t.textContent = n;
      li.append(dot, t);
      box.appendChild(li);
    });
    AI_EL.result.appendChild(box);
  }
  AI_EL.result.classList.remove("hidden");
}

async function handleAi() {
  const src = DOM.srcText.value.trim();
  if (!src) {
    DOM.srcText.focus();
    return;
  }
  if (!store.get("ra_ai_key", "")) {
    AI_EL.settings.classList.remove("hidden");
    AI_EL.settingsBtn.classList.add("neu-active");
    showAiMessage("Vui lòng nhập Gemini API key trong phần cài đặt để dùng tính năng này.");
    AI_EL.key.focus();
    return;
  }

  AI_EL.btn.disabled = true;
  AI_EL.label.textContent = "Đang xử lý...";
  showAiMessage("AI đang soạn cách nói tự nhiên hơn...");

  try {
    const isVi = dir === "vi-en";
    const machine = isVi ? currentOutput() : "";
    renderAiResult(await callGemini(buildAiPrompt(src, isVi, machine)));
  } catch (err) {
    console.error(err);
    showAiMessage(
      err instanceof SyntaxError
        ? "AI trả về kết quả không đúng định dạng. Vui lòng thử lại."
        : err.message || "Không thể kết nối tới AI. Vui lòng kiểm tra mạng và thử lại."
    );
  } finally {
    AI_EL.btn.disabled = false;
    AI_EL.label.textContent = "Tự nhiên hơn";
  }
}

AI_EL.btn.addEventListener("click", handleAi);

// ---------- C. Hỏi AI (không cần key) ----------
AI_EL.askBtn.addEventListener("click", async () => {
  const src = DOM.srcText.value.trim();
  if (!src) {
    DOM.srcText.focus();
    return;
  }
  const isVi = dir === "vi-en";
  const prompt = [
    "Tôi đang học tiếng Anh-Mỹ.",
    isVi ? `Tôi muốn nói câu này bằng tiếng Anh: "${src}"` : `Tôi viết câu tiếng Anh này, muốn nó tự nhiên hơn: "${src}"`,
    "Hãy cho tôi:",
    "1. Cách nói tự nhiên hằng ngày (casual) như người Mỹ thật sự nói",
    "2. Cách nói lịch sự (neutral), dùng ở chỗ làm",
    "3. Giải thích ngắn bằng tiếng Việt các cụm từ đáng học",
  ].join("\n");

  // Mở tab trước (trình duyệt chỉ cho mở tab ngay khi bấm), rồi mới sao chép
  window.open("https://claude.ai/new", "_blank", "noopener");
  try {
    await navigator.clipboard.writeText(prompt);
    AI_EL.askLabel.textContent = "Đã sao chép, dán vào Claude";
  } catch {
    AI_EL.askLabel.textContent = "Không sao chép được";
  }
  setTimeout(() => (AI_EL.askLabel.textContent = "Hỏi AI"), 2500);
});

// ---------- Khởi động ----------
applyDirection();
showOutPlaceholder();
renderHistory();
updateReaderCount();
switchTab(store.get("ra_tab", "reader"));
