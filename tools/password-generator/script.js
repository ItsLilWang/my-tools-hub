// =========================================
// Password Generator - Tool Logic
// =========================================

// --- DOM References ---
const lengthSlider = document.getElementById("length-slider");
const lengthValue = document.getElementById("length-value");
const charsetToolbar = document.getElementById("charset-toolbar");
const generateBtn = document.getElementById("generate-btn");
const toggleVisibilityBtn = document.getElementById("toggle-visibility-btn");
const outputPassword = document.getElementById("output-password");
const copyBtn = document.getElementById("copy-btn");
const copyBtnLabel = document.getElementById("copy-btn-label");
const visibilityBtnLabel = document.getElementById("visibility-btn-label");
const strengthLabel = document.getElementById("strength-label");
const charsetSize = document.getElementById("charset-size");
const errorMessage = document.getElementById("error-message");

// --- Character Sets ---
const CHARSETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
};

// --- State ---
const charsetOptions = {
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

let isVisible = false;

// =========================================
// Random Helpers
// =========================================

function getSecureRandomIndex(max) {
  const randomBuffer = new Uint32Array(1);
  crypto.getRandomValues(randomBuffer);
  return randomBuffer[0] % max;
}

function pickRandomChar(charset) {
  return charset[getSecureRandomIndex(charset.length)];
}

function shuffleArray(items) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = getSecureRandomIndex(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

// =========================================
// Password Generation
// =========================================

function getActiveCharsets() {
  return Object.entries(charsetOptions)
    .filter(([, enabled]) => enabled)
    .map(([name]) => ({
      name,
      chars: CHARSETS[name],
    }));
}

function buildPool(activeCharsets) {
  return activeCharsets.map((set) => set.chars).join("");
}

function generatePassword(length, activeCharsets) {
  const pool = buildPool(activeCharsets);
  const passwordChars = [];

  activeCharsets.forEach((set) => {
    passwordChars.push(pickRandomChar(set.chars));
  });

  while (passwordChars.length < length) {
    passwordChars.push(pickRandomChar(pool));
  }

  return shuffleArray(passwordChars).join("");
}

function getStrengthScore(length, poolSize, activeCount) {
  const entropy = length * Math.log2(poolSize);
  let label = "Weak";

  if (entropy >= 80 && activeCount >= 3) {
    label = "Strong";
  } else if (entropy >= 50) {
    label = "Medium";
  }

  return { entropy: Math.round(entropy), label };
}

// =========================================
// UI Update Functions
// =========================================

function hideError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function updateLengthDisplay() {
  lengthValue.textContent = lengthSlider.value;
}

function updateCharsetStats() {
  const activeCharsets = getActiveCharsets();
  const pool = buildPool(activeCharsets);

  charsetSize.textContent = `Pool: ${pool.length} characters`;

  if (activeCharsets.length === 0) {
    strengthLabel.textContent = "Strength: —";
    return;
  }

  const { entropy, label } = getStrengthScore(
    Number(lengthSlider.value),
    pool.length,
    activeCharsets.length,
  );

  strengthLabel.textContent = `Strength: ${label} (~${entropy} bits)`;
}

function updateVisibilityButton() {
  const icon = toggleVisibilityBtn.querySelector("i");
  outputPassword.type = isVisible ? "text" : "password";
  visibilityBtnLabel.textContent = isVisible ? "Hide" : "Show";
  icon.className = isVisible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

function toggleCharset(charsetName) {
  charsetOptions[charsetName] = !charsetOptions[charsetName];

  const button = charsetToolbar.querySelector(
    `[data-charset="${charsetName}"]`,
  );

  if (charsetOptions[charsetName]) {
    button.classList.add("neu-active");
  } else {
    button.classList.remove("neu-active");
  }

  updateCharsetStats();
  hideError();
}

function runGeneration() {
  hideError();

  const activeCharsets = getActiveCharsets();
  const length = Number(lengthSlider.value);

  if (activeCharsets.length === 0) {
    outputPassword.value = "";
    showError("Select at least one character type.");
    console.error("Password generation failed: no character sets selected");
    return;
  }

  if (length < activeCharsets.length) {
    showError(
      `Length must be at least ${activeCharsets.length} for selected character types.`,
    );
    console.error("Password generation failed: length too short");
    return;
  }

  const password = generatePassword(length, activeCharsets);
  outputPassword.value = password;
  updateCharsetStats();
  console.log(`Generated password with length ${length}`);
}

async function copyPassword() {
  if (!outputPassword.value) return;

  try {
    await navigator.clipboard.writeText(outputPassword.value);
    copyBtnLabel.textContent = "Copied!";
    copyBtn.classList.add("neu-active");

    setTimeout(() => {
      copyBtnLabel.textContent = "Copy";
      copyBtn.classList.remove("neu-active");
    }, 1500);
  } catch (error) {
    console.error("Failed to copy password:", error);
    copyBtnLabel.textContent = "Failed";
    setTimeout(() => {
      copyBtnLabel.textContent = "Copy";
    }, 1500);
  }
}

function toggleVisibility() {
  isVisible = !isVisible;
  updateVisibilityButton();
}

// =========================================
// Event Listeners
// =========================================

lengthSlider.addEventListener("input", () => {
  updateLengthDisplay();
  updateCharsetStats();
  hideError();
});

charsetToolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-charset]");
  if (!button) return;
  toggleCharset(button.dataset.charset);
});

generateBtn.addEventListener("click", runGeneration);
toggleVisibilityBtn.addEventListener("click", toggleVisibility);
copyBtn.addEventListener("click", copyPassword);

outputPassword.addEventListener("keydown", (event) => {
  event.preventDefault();
});

// Initialize UI
updateLengthDisplay();
updateCharsetStats();
updateVisibilityButton();
runGeneration();
