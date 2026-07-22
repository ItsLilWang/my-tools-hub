// =========================================
// Case Converter - Tool Logic
// =========================================

// --- DOM References ---
const inputText = document.getElementById("input-text");
const outputText = document.getElementById("output-text");
const caseToolbar = document.getElementById("case-toolbar");
const copyBtn = document.getElementById("copy-btn");
const copyBtnLabel = document.getElementById("copy-btn-label");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");

// --- State ---
let activeCase = null;

// =========================================
// Case Conversion Functions
// =========================================

function toSentenceCase(text) {
  const lower = text.toLowerCase();
  // Capitalize the first letter after start of string or after . ! ?
  return lower.replace(/(^\s*\w|[.!?]\s*\w)/g, (match) => match.toUpperCase());
}

function toLowerCase(text) {
  return text.toLowerCase();
}

function toUpperCase(text) {
  return text.toUpperCase();
}

function toCapitalizedCase(text) {
  return text.replace(/\w\S*/g, (word) => {
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function toAlternatingCase(text) {
  return text
    .split("")
    .map((char, index) => {
      return index % 2 === 0 ? char.toLowerCase() : char.toUpperCase();
    })
    .join("");
}

function toTitleCase(text) {
  // Small words that stay lowercase unless they are the first word
  const minorWords = [
    "a",
    "an",
    "the",
    "and",
    "but",
    "or",
    "for",
    "nor",
    "on",
    "at",
    "to",
    "from",
    "by",
    "in",
    "of",
  ];

  const words = text.toLowerCase().split(" ");

  return words
    .map((word, index) => {
      if (word.length === 0) return word;
      if (index !== 0 && minorWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function toInverseCase(text) {
  return text
    .split("")
    .map((char) => {
      if (char === char.toUpperCase() && char !== char.toLowerCase()) {
        return char.toLowerCase();
      } else if (char === char.toLowerCase() && char !== char.toUpperCase()) {
        return char.toUpperCase();
      }
      return char;
    })
    .join("");
}

// Map each case type to its conversion function
const caseConverters = {
  sentence: toSentenceCase,
  lower: toLowerCase,
  upper: toUpperCase,
  capitalized: toCapitalizedCase,
  alternating: toAlternatingCase,
  title: toTitleCase,
  inverse: toInverseCase,
};

// =========================================
// UI Update Functions
// =========================================

function updateActiveButton(caseType) {
  const buttons = caseToolbar.querySelectorAll("button[data-case]");
  buttons.forEach((btn) => {
    if (btn.dataset.case === caseType) {
      btn.classList.add("neu-active");
    } else {
      btn.classList.remove("neu-active");
    }
  });
}

function updateCounts(text) {
  const chars = text.length;
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  charCount.textContent = `${chars} characters`;
  wordCount.textContent = `${words} words`;
}

function applyCase(caseType) {
  const converter = caseConverters[caseType];
  if (!converter) {
    console.error(`No converter found for case type: ${caseType}`);
    return;
  }

  const converted = converter(inputText.value);
  outputText.value = converted;
  activeCase = caseType;
  updateActiveButton(caseType);
  updateCounts(converted);
}

async function copyOutput() {
  if (!outputText.value) return;

  try {
    await navigator.clipboard.writeText(outputText.value);
    copyBtnLabel.textContent = "Copied!";
    copyBtn.classList.add("neu-active");

    setTimeout(() => {
      copyBtnLabel.textContent = "Copy";
      copyBtn.classList.remove("neu-active");
    }, 1500);
  } catch (error) {
    console.error("Failed to copy text:", error);
    copyBtnLabel.textContent = "Failed";
    setTimeout(() => {
      copyBtnLabel.textContent = "Copy";
    }, 1500);
  }
}

// =========================================
// Event Listeners
// =========================================

// Re-apply the active case conversion live as the user types
inputText.addEventListener("input", () => {
  if (activeCase) {
    applyCase(activeCase);
  } else {
    updateCounts(inputText.value);
  }
});

// Handle case button clicks
caseToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-case]");
  if (!button) return;
  applyCase(button.dataset.case);
});

// Handle copy button click
copyBtn.addEventListener("click", copyOutput);

// Initialize counts on load
updateCounts("");
