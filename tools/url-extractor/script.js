// =========================================
// URL Extractor - Tool Logic
// =========================================

// --- DOM References ---
const inputText = document.getElementById("input-text");
const outputText = document.getElementById("output-text");
const extractBtn = document.getElementById("extract-btn");
const dedupeBtn = document.getElementById("dedupe-btn");
const clearBtn = document.getElementById("clear-btn");
const copyBtn = document.getElementById("copy-btn");
const copyBtnLabel = document.getElementById("copy-btn-label");
const urlCount = document.getElementById("url-count");
const charCount = document.getElementById("char-count");

// --- State ---
let dedupeEnabled = true;

// Matches http(s) URLs and www. prefixed domains
const URL_PATTERN =
  /(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

// Trailing punctuation often attached to URLs in plain text
const TRAILING_PUNCTUATION = /[.,;:!?)}\]'"]+$/;

// =========================================
// Extraction Functions
// =========================================

function cleanUrl(rawUrl) {
  let url = rawUrl.trim();

  while (TRAILING_PUNCTUATION.test(url)) {
    url = url.replace(TRAILING_PUNCTUATION, "");
  }

  if (url.startsWith("www.")) {
    url = `https://${url}`;
  }

  return url;
}

function extractUrls(text) {
  const matches = text.match(URL_PATTERN);
  if (!matches) return [];

  const cleaned = matches.map(cleanUrl).filter(Boolean);

  if (dedupeEnabled) {
    return [...new Set(cleaned)];
  }

  return cleaned;
}

// =========================================
// UI Update Functions
// =========================================

function updateStats(urls) {
  urlCount.textContent = `${urls.length} URL${urls.length === 1 ? "" : "s"} found`;
  charCount.textContent = `${inputText.value.length} characters`;
}

function renderOutput(urls) {
  outputText.value = urls.join("\n");
  updateStats(urls);
}

function runExtraction() {
  const urls = extractUrls(inputText.value);
  renderOutput(urls);
  console.log(`Extracted ${urls.length} URL(s)`);
}

function toggleDedupe() {
  dedupeEnabled = !dedupeEnabled;
  dedupeBtn.dataset.active = String(dedupeEnabled);

  if (dedupeEnabled) {
    dedupeBtn.classList.add("neu-active");
  } else {
    dedupeBtn.classList.remove("neu-active");
  }

  if (inputText.value.trim()) {
    runExtraction();
  }
}

function clearAll() {
  inputText.value = "";
  outputText.value = "";
  updateStats([]);
  inputText.focus();
  console.log("Input and output cleared");
}

async function copyOutput() {
  if (!outputText.value) return;

  try {
    await navigator.clipboard.writeText(outputText.value);
    copyBtnLabel.textContent = "Copied!";
    copyBtn.classList.add("neu-active");

    setTimeout(() => {
      copyBtnLabel.textContent = "Copy All";
      copyBtn.classList.remove("neu-active");
    }, 1500);
  } catch (error) {
    console.error("Failed to copy URLs:", error);
    copyBtnLabel.textContent = "Failed";
    setTimeout(() => {
      copyBtnLabel.textContent = "Copy All";
    }, 1500);
  }
}

// =========================================
// Event Listeners
// =========================================

inputText.addEventListener("input", runExtraction);
extractBtn.addEventListener("click", runExtraction);
dedupeBtn.addEventListener("click", toggleDedupe);
clearBtn.addEventListener("click", clearAll);
copyBtn.addEventListener("click", copyOutput);

// Initialize stats on load
updateStats([]);
