const fontList = {
  sansModern: [
    "Inter",
    "Roboto",
    "Poppins",
    "Montserrat",
    "Open Sans",
    "Lato",
    "Nunito",
    "Raleway",
    "Ubuntu",
    "Rubik",
    "Work Sans",
    "Quicksand",
    "Karla",
    "Fira Sans",
    "Manrope",
    "Barlow",
    "DM Sans",
    "Sora",
    "Plus Jakarta Sans",
    "Figtree",
    "Urbanist",
    "Hanken Grotesk",
    "Space Grotesk",
    "Lexend",
    "Epilogue",
    "Public Sans",
  ],
  displayHeading: [
    "Oswald",
    "Bebas Neue",
    "Outfit",
    "Syne",
    "Teko",
    "Anton",
    "Fjalla One",
    "Righteous",
    "Prompt",
    "Abril Fatface",
    "Coda",
    "Archivo Black",
    "League Spartan",
    "Big Shoulders",
    "Bungee",
    "Passion One",
    "Staatliches",
  ],
  serifClassic: [
    "Playfair Display",
    "Lora",
    "Merriweather",
    "PT Serif",
    "Bitter",
    "Crimson Text",
    "Cormorant Garamond",
    "Zilla Slab",
    "Cinzel",
    "Libre Baskerville",
    "Source Serif Pro",
    "Frank Ruhl Libre",
    "Spectral",
    "DM Serif Display",
    "Noto Serif",
  ],
  handwritingArt: [
    "Dancing Script",
    "Pacifico",
    "Caveat",
    "Satisfy",
    "Permanent Marker",
    "Amatic SC",
    "Courgette",
    "Kalam",
    "Shadows Into Light",
    "Great Vibes",
    "Sacramento",
  ],
  monospaceCode: [
    "Space Mono",
    "Inconsolata",
    "Fira Code",
    "Roboto Mono",
    "IBM Plex Mono",
    "JetBrains Mono",
    "Source Code Pro",
  ],
  vietnameseFriendly: [
    "Be Vietnam Pro",
    "Josefin Sans",
    "Mulish",
    "Sarabun",
    "Prompt",
    "Inter",
    "Roboto",
    "Nunito",
    "Quicksand",
    "Montserrat",
    "Lora",
    "Baloo 2",
    "Comfortaa",
  ],
};

// Tỉ lệ khung preview: [width_units, height_units]
const RATIOS = {
  "1/1": [1, 1],
  "3/4": [3, 4],
  "16/9": [16, 9],
};
let currentRatio = "16/9";

const categoryLabels = {
  sansModern: "Sans / Modern",
  displayHeading: "Display / Heading",
  serifClassic: "Serif / Classic",
  handwritingArt: "Handwriting / Art",
  monospaceCode: "Monospace / Code",
  vietnameseFriendly: "Vietnamese-friendly",
};

// Mảng font đầy đủ, có filter trùng (như Inter, Prompt xuất hiện ở nhiều nhóm)
let allUniqueFonts = [...new Set(Object.values(fontList).flat())];

// Cache font đã load để không gọi lại Google Fonts nhiều lần
const loadedFonts = new Set();
// Font custom user tự nhập (để random/lưu lại option)
const customFonts = new Set();

const DEFAULTS = {
  "text-1-input": { font: "Oswald", size: "70px", weight: "800" },
  "text-2-input": { font: "Inter", size: "24px", weight: "400" },
};

function buildFontUrl(fontName) {
  const urlName = fontName.trim().replace(/\s+/g, "+");
  // Xin đủ các weight phổ biến. Google Fonts sẽ tự bỏ qua weight nào font không hỗ trợ,
  // nên font nào có sẵn weight gì thì mình có đúng weight đó (không bị giả bold/thin nữa).
  return `https://fonts.googleapis.com/css2?family=${urlName}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
}

// Tải 1 font cụ thể từ Google Fonts, verify là font có tồn tại thật không.
// Trả về true/false.
async function ensureFontLoaded(fontName) {
  const key = fontName.trim();
  if (!key) return false;
  if (loadedFonts.has(key)) return true;

  const url = buildFontUrl(key);
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return false; // Google trả lỗi -> font không tồn tại
    const css = await res.text();
    // Google Fonts khi không tìm thấy family vẫn trả 200 nhưng css rỗng/không có @font-face
    if (!css.includes("@font-face") && !css.includes("font-family")) {
      return false;
    }
    const styleTag = document.createElement("style");
    styleTag.setAttribute("data-font", key);
    styleTag.innerHTML = css;
    document.head.appendChild(styleTag);
    loadedFonts.add(key);
    return true;
  } catch (err) {
    console.error("Font load failed:", key, err);
    return false;
  }
}

function initFonts() {
  const selects = document.querySelectorAll(".font-picker");

  selects.forEach((select) => {
    populateSelectOptions(select);

    select.addEventListener("change", async (e) => {
      const value = e.target.value;
      const targetId = e.target.getAttribute("data-target");
      if (value) {
        await selectFontFor(targetId, value, select);
      }
    });
  });

  // Set giá trị + load font mặc định (lazy, chỉ 2 font ban đầu)
  Object.entries(DEFAULTS).forEach(async ([targetId, cfg]) => {
    const select = document.querySelector(
      `.font-picker[data-target="${targetId}"]`,
    );
    if (select) select.value = cfg.font;
    await ensureFontLoaded(cfg.font);
    const el = document.getElementById(targetId);
    if (el) el.style.fontFamily = `"${cfg.font}", sans-serif`;
  });

  // Custom font inputs
  document.querySelectorAll(".custom-font-form").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleCustomFontSubmit(form);
    });
  });
}

function populateSelectOptions(select) {
  const fragment = document.createDocumentFragment();

  Object.entries(fontList).forEach(([catKey, fonts]) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = categoryLabels[catKey] || catKey;
    fonts.forEach((font) => {
      const option = document.createElement("option");
      option.value = font;
      option.textContent = font;
      optgroup.appendChild(option);
    });
    fragment.appendChild(optgroup);
  });

  select.appendChild(fragment);
}

// Thêm 1 font custom vào tất cả select (dạng optgroup riêng), để chọn lại sau này
function addCustomFontOption(fontName) {
  if (customFonts.has(fontName)) return;
  customFonts.add(fontName);
  allUniqueFonts.push(fontName);

  document.querySelectorAll(".font-picker").forEach((select) => {
    let group = select.querySelector('optgroup[label="Custom"]');
    if (!group) {
      group = document.createElement("optgroup");
      group.label = "Custom";
      select.prepend(group);
    }
    const option = document.createElement("option");
    option.value = fontName;
    option.textContent = fontName;
    group.appendChild(option);
  });
}

async function selectFontFor(targetId, fontName, selectEl) {
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;

  if (selectEl) selectEl.disabled = true;
  const ok = await ensureFontLoaded(fontName);
  if (selectEl) selectEl.disabled = false;

  if (ok) {
    targetEl.style.fontFamily = `"${fontName}", sans-serif`;
  } else {
    alert(`Không load được font "${fontName}", thử font khác nha fen.`);
  }
}

async function handleCustomFontSubmit(form) {
  const input = form.querySelector(".custom-font-input");
  const statusEl = form.querySelector(".custom-font-status");
  const targetId = input.getAttribute("data-target");
  const fontName = input.value.trim();

  if (!fontName) return;

  statusEl.textContent = "Đang kiểm tra...";
  statusEl.className = "custom-font-status text-[10px] text-gray-500 ml-1";
  input.disabled = true;

  const ok = await ensureFontLoaded(fontName);

  input.disabled = false;

  if (ok) {
    addCustomFontOption(fontName);
    const select = document.querySelector(
      `.font-picker[data-target="${targetId}"]`,
    );
    if (select) select.value = fontName;
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.style.fontFamily = `"${fontName}", sans-serif`;

    statusEl.textContent = "✓ Đã áp dụng";
    statusEl.className = "custom-font-status text-[10px] text-red-500 ml-1";
    input.value = "";
  } else {
    statusEl.textContent = "✗ Không tìm thấy font này trên Google Fonts";
    statusEl.className = "custom-font-status text-[10px] text-orange-400 ml-1";
  }
}

window.onload = () => {
  initFonts();
  fitCanvasToContainer();
};

function updateStyle(elementId, property, value) {
  const el = document.getElementById(elementId);
  if (el) el.style[property] = value;
}

function changeRatio(ratio, btnElement) {
  currentRatio = ratio;
  fitCanvasToContainer();

  document.querySelectorAll(".ratio-btn").forEach((btn) => {
    btn.classList.remove("neu-active", "text-red-500");
    btn.classList.add("text-gray-500");
  });

  btnElement.classList.remove("text-gray-500");
  btnElement.classList.add("neu-active", "text-red-500");
}

// Tính kích thước canvas kiểu "contain-fit": ưu tiên cố định chiều cao
function fitCanvasToContainer() {
  const canvas = document.getElementById("preview-canvas");
  if (!canvas) return;
  const wrapper = canvas.parentElement;
  if (!wrapper) return;

  const [rw, rh] = RATIOS[currentRatio] || RATIOS["16/9"];
  const availableWidth = wrapper.clientWidth;
  const availableHeight = window.innerHeight * 0.62;

  // Lấy chiều cao display làm chuẩn cố định
  let height = availableHeight;
  let width = height * (rw / rh);

  // Chỉ scale lại nếu chiều ngang bị tràn khung (dành cho mobile)
  if (width > availableWidth) {
    width = availableWidth;
    height = width * (rh / rw);
  }

  canvas.style.width = Math.floor(width) + "px";
  canvas.style.height = Math.floor(height) + "px";
}

// Debounce nhẹ cho resize/orientation change
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitCanvasToContainer, 120);
});
window.addEventListener("orientationchange", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitCanvasToContainer, 120);
});

function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const isHidden =
    panel.classList.contains("hidden") || panel.style.display === "none";
  panel.classList.remove("hidden");
  panel.style.display = isHidden ? "flex" : "none";
}

function toggleLock(btn, targetId) {
  const icon = btn.querySelector("i");
  const target = document.getElementById(targetId);
  if (!icon || !target) return;

  const isUnlocked = icon.classList.contains("fa-lock-open");

  icon.classList.replace(
    isUnlocked ? "fa-lock-open" : "fa-lock",
    isUnlocked ? "fa-lock" : "fa-lock-open",
  );
  btn.classList.toggle("text-red-500", isUnlocked);
  btn.classList.toggle("text-gray-500", !isUnlocked);
  target.setAttribute("data-locked", isUnlocked ? "true" : "false");
}

async function randomFonts() {
  const targets = ["text-1-input", "text-2-input"];
  for (const id of targets) {
    const el = document.getElementById(id);
    if (el && el.getAttribute("data-locked") !== "true") {
      const randomFont =
        allUniqueFonts[Math.floor(Math.random() * allUniqueFonts.length)];
      const select = document.querySelector(
        `.font-picker[data-target="${id}"]`,
      );
      await selectFontFor(id, randomFont, select);
      if (select) select.value = randomFont;
    }
  }
}

function swapFonts() {
  const el1 = document.getElementById("text-1-input");
  const el2 = document.getElementById("text-2-input");

  if (
    !el1 ||
    !el2 ||
    el1.getAttribute("data-locked") === "true" ||
    el2.getAttribute("data-locked") === "true"
  ) {
    alert("Mở khóa font trước khi Swap nha bro!");
    return;
  }

  const s1 = document.querySelector('.font-picker[data-target="text-1-input"]');
  const s2 = document.querySelector('.font-picker[data-target="text-2-input"]');

  if (s1 && s2) {
    const tempVal = s1.value;
    s1.value = s2.value;
    s2.value = tempVal;

    s1.dispatchEvent(new Event("change"));
    s2.dispatchEvent(new Event("change"));
  }
}

function resetAll() {
  Object.entries(DEFAULTS).forEach(async ([targetId, cfg]) => {
    const el = document.getElementById(targetId);
    const select = document.querySelector(
      `.font-picker[data-target="${targetId}"]`,
    );
    if (!el) return;

    el.setAttribute("data-locked", "false");
    await ensureFontLoaded(cfg.font);
    el.style.fontFamily = `"${cfg.font}", sans-serif`;
    el.style.fontSize = cfg.size;
    el.style.fontWeight = cfg.weight;
    if (select) select.value = cfg.font;
  });

  // Reset lock icons về unlocked
  document.querySelectorAll('[title="Khóa"]').forEach((btn) => {
    const icon = btn.querySelector("i");
    if (icon) {
      icon.classList.remove("fa-lock");
      icon.classList.add("fa-lock-open");
    }
    btn.classList.remove("text-red-500");
    btn.classList.add("text-gray-500");
  });

  // Reset ratio về 16:9
  currentRatio = "16/9";
  fitCanvasToContainer();
  document.querySelectorAll(".ratio-btn").forEach((btn) => {
    btn.classList.remove("neu-active", "text-red-500");
    btn.classList.add("text-gray-500");
  });
  const btn169 = document.querySelector('.ratio-btn[data-ratio="16/9"]');
  if (btn169) {
    btn169.classList.remove("text-gray-500");
    btn169.classList.add("neu-active", "text-red-500");
  }
}

function downloadInfo() {
  const s1 = document.querySelector('.font-picker[data-target="text-1-input"]');
  const s2 = document.querySelector('.font-picker[data-target="text-2-input"]');
  if (!s1 || !s2) return;

  const f1 = s1.value;
  const f2 = s2.value;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

  const content = `=== FONTLAB NEUMORPHISM ===\nTạo lúc: ${now.toLocaleString("vi-VN")}\n\nText 1: ${f1} -> https://fonts.google.com/specimen/${f1.replace(/ /g, "+")}\nText 2: ${f2} -> https://fonts.google.com/specimen/${f2.replace(/ /g, "+")}\n`;

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `fontlab-combo-${stamp}.txt`;
  a.click();

  URL.revokeObjectURL(url);
}
