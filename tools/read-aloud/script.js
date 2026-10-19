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
      "Gõ câu tiếng Việt, ví dụ: Hôm nay t mệt quá nhưng vẫn phải làm cho xong...",
    outPlaceholder: "Bản dịch tiếng Anh sẽ hiện ở đây...",
  },
  "en-vi": {
    sl: "en",
    tl: "vi",
    srcLabel: "English",
    outLabel: "Tiếng Việt",
    placeholder: "Type an English sentence, e.g. I'm exhausted but I still have to finish this...",
    outPlaceholder: "Bản dịch tiếng Việt sẽ hiện ở đây...",
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

  try {
    const { out, engine } = await translate(src, sl, tl);
    showOutput(out, engine);

    // Lịch sử luôn lưu theo cặp vi/en, kèm chiều dịch
    const vi = dir === "vi-en" ? src : out;
    const en = dir === "vi-en" ? out : src;
    addHistory({ vi, en, dir });

    if (DOM.autoSpeak.checked) speak(en);
  } catch (err) {
    console.error(err);
    DOM.outText.innerHTML =
      '<span data-placeholder="1" class="text-gray-500 text-base">Dịch không được, check mạng rồi thử lại nha.</span>';
    DOM.engineTag.textContent = "";
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

// Hàm đọc chính (luôn đọc tiếng Anh)
function speak(text) {
  if (!text) return;
  speechSynthesis.cancel(); // dừng câu đang đọc dở (nếu có)

  const u = new SpeechSynthesisUtterance(text);
  const voice = englishVoices[DOM.voiceSelect.value];
  if (voice) u.voice = voice;
  u.lang = voice ? voice.lang : "en-US";
  u.rate = Number(DOM.rateRange.value);

  speechSynthesis.speak(u);
}

DOM.speakBtn.addEventListener("click", () => speak(currentEnglish()));
DOM.stopBtn.addEventListener("click", () => speechSynthesis.cancel());

DOM.copyBtn.addEventListener("click", async () => {
  const out = currentOutput();
  if (!out) return;
  try {
    await navigator.clipboard.writeText(out);
    DOM.copyLabel.textContent = "Copied!";
  } catch {
    DOM.copyLabel.textContent = "Lỗi copy";
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
      '<li class="text-sm text-gray-600 px-2 py-1">Chưa có câu nào.</li>';
    return;
  }

  historyItems.forEach((item) => {
    const li = document.createElement("li");
    li.className = "history-item px-4 py-3 cursor-pointer flex items-start gap-3";
    li.title = "Bấm để đọc lại";

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
  if (!historyItems.length || !confirm("Xoá hết lịch sử?")) return;
  historyItems = [];
  store.set("ra_history", historyItems);
  renderHistory();
});

// ---------- Khởi động ----------
applyDirection();
showOutPlaceholder();
renderHistory();
updateReaderCount();
switchTab(store.get("ra_tab", "reader"));
