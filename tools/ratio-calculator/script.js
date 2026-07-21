// DOM Elements
const inputA = document.getElementById("valA");
const inputB = document.getElementById("valB");
const inputC = document.getElementById("valC");
const inputD = document.getElementById("valD");
const btnCalc = document.getElementById("btnCalc");
const btnClear = document.getElementById("btnClear");

/**
 * Main Logic: A:B = C:D (equivalent to A/B = C/D)
 * Formulae:
 * A = (B * C) / D
 * B = (A * D) / C
 * C = (A * D) / B
 * D = (B * C) / A
 */
function calculateRatio() {
  console.log("[RatioTool] Calculation started...");

  const a = parseFloat(inputA.value);
  const b = parseFloat(inputB.value);
  const c = parseFloat(inputC.value);
  const d = parseFloat(inputD.value);

  const isAEmpty = isNaN(a);
  const isBEmpty = isNaN(b);
  const isCEmpty = isNaN(c);
  const isDEmpty = isNaN(d);

  // Filter out booleans to count exactly how many fields are empty
  const emptyCount = [isAEmpty, isBEmpty, isCEmpty, isDEmpty].filter(
    Boolean,
  ).length;

  if (emptyCount !== 1) {
    console.warn(
      "[RatioTool] Error: User did not leave exactly one field empty.",
    );
    alert("Please enter exactly 3 values to calculate the missing one.");
    return;
  }

  let result = 0;
  let targetInput = null;

  // Calculate missing value
  if (isAEmpty) {
    result = (b * c) / d;
    targetInput = inputA;
  } else if (isBEmpty) {
    result = (a * d) / c;
    targetInput = inputB;
  } else if (isCEmpty) {
    result = (a * d) / b;
    targetInput = inputC;
  } else if (isDEmpty) {
    result = (b * c) / a;
    targetInput = inputD;
  }

  // Handle Division by Zero or invalid math
  if (!isFinite(result)) {
    console.error("[RatioTool] Error: Math error, likely division by zero.");
    alert("Math error! Are you dividing by zero? Check your inputs.");
    return;
  }

  // Display result and trigger highlight
  targetInput.value = formatNumber(result);
  highlightResult(targetInput);

  console.log(
    `[RatioTool] Successfully calculated missing value: ${targetInput.value}`,
  );
}

/**
 * Format numbers: removes trailing zeros and rounds to 4 decimal places max
 */
function formatNumber(num) {
  return Number.isInteger(num) ? num : parseFloat(num.toFixed(4));
}

/**
 * Briefly highlights the calculated input to show user where the result is
 */
function highlightResult(element) {
  element.classList.add("text-red-500", "neu-active");
  setTimeout(() => {
    element.classList.remove("text-red-500", "neu-active");
  }, 1200);
}

/**
 * Clears all input fields
 */
function clearFields() {
  inputA.value = "";
  inputB.value = "";
  inputC.value = "";
  inputD.value = "";
  console.log("[RatioTool] Fields cleared.");
}

// Event Listeners
btnCalc.addEventListener("click", calculateRatio);
btnClear.addEventListener("click", clearFields);

// QoL: Press 'Enter' anywhere on the page to trigger calculation
document.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    calculateRatio();
  }
});
