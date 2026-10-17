/* =========================================
   READ ALOUD TOOL
   - Tab Reader: dán text -> hiện bản sạch cho Edge Read Aloud
   - Tab Learn EN: gõ tiếng Việt -> dịch tiếng Anh -> đọc to
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
  renderBtn: $("render-btn"),
  readerView: $("reader-view"),
  readerContent: $("reader-content"),
  exitReaderBtn: $("exit-reader-btn"),

  // Learn
  viText: $("vi-text"),
  autoSpeak: $("auto-speak"),
  translateBtn: $("translate-btn"),
  translateLabel: $("translate-label"),
  enText: $("en-text"),
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

// Phím Esc cũng thoát Reader
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !DOM.readerView.classList.contains("hidden")) {
    closeReader();
  }
});

/* =========================================
   TAB 2: LEARN EN — DỊCH
   ========================================= */

// Engine chính: Google Translate (endpoint không chính thức, dịch tự nhiên)
async function translateGoogle(text) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx&sl=vi&tl=en&dt=t&q=" +
    encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("Google lỗi " + res.status);
  const data = await res.json();

  // Kết quả là mảng các câu: [[["Hello", "Xin chào"], ...], ...]
  return data[0].map((part) => part[0]).join("");
}

// Engine dự phòng: MyMemory (chính thức, có giới hạn mỗi ngày)
async function translateMyMemory(text) {
  const url =
    "https://api.mymemory.translated.net/get?langpair=vi|en&q=" +
    encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error("MyMemory lỗi " + res.status);
  const data = await res.json();
  if (data.responseStatus !== 200) throw new Error(data.responseDetails);

  return data.responseData.translatedText;
}

// Thử Google trước, hỏng thì chuyển MyMemory
async function translate(text) {
  try {
    return { en: await translateGoogle(text), engine: "Google" };
  } catch (err) {
    console.warn("Google fail, chuyển MyMemory:", err);
    return { en: await translateMyMemory(text), engine: "MyMemory" };
  }
}

function showEnglish(en, engine) {
  DOM.enText.textContent = en;
  DOM.engineTag.textContent = engine ? `· via ${engine}` : "";
}

async function handleTranslate() {
  const vi = DOM.viText.value.trim();
  if (!vi) {
    DOM.viText.focus();
    return;
  }

  DOM.translateBtn.disabled = true;
  DOM.translateLabel.textContent = "Đang dịch...";

  try {
    const { en, engine } = await translate(vi);
    showEnglish(en, engine);
    addHistory(vi, en);
    if (DOM.autoSpeak.checked) speak(en);
  } catch (err) {
    console.error(err);
    DOM.enText.innerHTML =
      '<span class="text-gray-500 text-base">Dịch không được, check mạng rồi thử lại nha.</span>';
    DOM.engineTag.textContent = "";
  } finally {
    DOM.translateBtn.disabled = false;
    DOM.translateLabel.textContent = "Dịch";
  }
}

DOM.translateBtn.addEventListener("click", handleTranslate);

// Ctrl + Enter (hoặc Cmd + Enter trên Mac) để dịch nhanh
DOM.viText.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleTranslate();
  }
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

// Hàm đọc chính
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

// Lấy text tiếng Anh đang hiển thị (bỏ qua chữ placeholder xám)
function currentEnglish() {
  return DOM.enText.querySelector("span") ? "" : DOM.enText.textContent.trim();
}

DOM.speakBtn.addEventListener("click", () => speak(currentEnglish()));
DOM.stopBtn.addEventListener("click", () => speechSynthesis.cancel());

DOM.copyBtn.addEventListener("click", async () => {
  const en = currentEnglish();
  if (!en) return;
  try {
    await navigator.clipboard.writeText(en);
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

function addHistory(vi, en) {
  // Xoá bản trùng rồi đẩy câu mới lên đầu
  historyItems = historyItems.filter((h) => h.vi !== vi);
  historyItems.unshift({ vi, en });
  historyItems = historyItems.slice(0, HISTORY_MAX);
  store.set("ra_history", historyItems);
  renderHistory();
}

function renderHistory() {
  DOM.historyList.innerHTML = "";

  if (!historyItems.length) {
    DOM.historyList.innerHTML =
      '<li class="text-sm text-gray-600">Chưa có câu nào.</li>';
    return;
  }

  historyItems.forEach((item) => {
    const li = document.createElement("li");
    li.className =
      "neu-btn px-4 py-3 cursor-pointer flex items-start gap-3 text-left";

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-play text-red-500 text-xs mt-1.5";

    const textBox = document.createElement("div");
    textBox.className = "flex flex-col";

    const enLine = document.createElement("span");
    enLine.className = "text-sm text-gray-200";
    enLine.textContent = item.en;

    const viLine = document.createElement("span");
    viLine.className = "text-xs text-gray-500";
    viLine.textContent = item.vi;

    textBox.append(enLine, viLine);
    li.append(icon, textBox);

    // Bấm vào: đưa câu lên khung chính và đọc lại
    li.addEventListener("click", () => {
      DOM.viText.value = item.vi;
      showEnglish(item.en, "");
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
renderHistory();
updateReaderCount();
switchTab(store.get("ra_tab", "reader"));
