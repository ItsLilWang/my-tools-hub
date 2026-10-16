const STORAGE_KEY = "story-builder-v1";
const toast = document.getElementById("toast");
const characterList = document.getElementById("characterList");
const promptOutput = document.getElementById("promptOutput");
const storageInputs = [...document.querySelectorAll("[data-storage]")];

// Danh sách field của nhân vật — thêm field mới chỉ cần thêm 1 dòng ở đây
const CHARACTER_FIELDS = [
  { key: "name", label: "Name" },
  { key: "age", label: "Age" },
  { key: "role", label: "Role" },
  { key: "personality", label: "Personality" },
  { key: "appearance", label: "Appearance" },
  { key: "goal", label: "Goal" },
  { key: "secret", label: "Secret" },
  { key: "relationship", label: "Relationship" },
];

const defaults = {
  title: "",
  oneLineIdea: "",
  genre: "",
  tone: "",
  ending: "",
  wordCount: "",
  pov: "",
  audience: "",
  theme: "",
  plotHook: "",
  plotOpening: "",
  plotInciting: "",
  plotRising: "",
  plotMidpoint: "",
  plotTwist: "",
  plotClimax: "",
  plotEnding: "",
  plotMoral: "",
  emotionBeginning: "",
  emotionMiddle: "",
  emotionPeak: "",
  emotionEnding: "",
  emotionTakeaway: "",
  characters: [],
};

let state = loadState();

/* =========================================================
   STATE
   ========================================================= */

function emptyCharacter() {
  return Object.fromEntries(CHARACTER_FIELDS.map(({ key }) => [key, ""]));
}

// Đảm bảo nhân vật cũ (chưa có appearance) vẫn đủ field
function normalizeState(raw) {
  const merged = { ...defaults, ...raw };
  delete merged.prompt; // prompt giờ tự sinh, không cần lưu
  merged.characters = Array.isArray(merged.characters)
    ? merged.characters.map((c) => ({ ...emptyCharacter(), ...c }))
    : [];
  return merged;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : {});
  } catch (error) {
    console.error("Unable to load storage", error);
    return normalizeState({});
  }
}

// Mỗi lần dữ liệu đổi: lưu lại + cập nhật prompt (live prompt)
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  promptOutput.value = buildPrompt(state);
  adjustHeight(promptOutput);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(
    () => toast.classList.remove("visible"),
    1800,
  );
}

// Escape đủ cả dấu nháy — tên có dấu " không làm vỡ ô input
function escapeHtml(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* =========================================================
   INPUTS
   ========================================================= */

function syncInputs() {
  storageInputs.forEach((input) => {
    input.value = state[input.dataset.storage] || "";
    adjustHeight(input);
  });
}

function adjustHeight(textarea) {
  if (textarea.tagName !== "TEXTAREA") return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function recordInput(event) {
  const key = event.target.dataset.storage;
  if (!key) return;
  state[key] = event.target.value;
  adjustHeight(event.target);
  persist();
}

/* =========================================================
   CHARACTERS
   ========================================================= */

function buildCharacterCard(character, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.index = index;

  const input = (key, placeholder) =>
    `<input type="text" data-field="${key}" value="${escapeHtml(character[key])}" placeholder="${placeholder}" />`;
  const textarea = (key, placeholder) =>
    `<textarea data-field="${key}" placeholder="${placeholder}">${escapeHtml(character[key])}</textarea>`;

  card.innerHTML = `
    <div class="card-header">
      <div class="card-heading">
        <span class="drag-handle" draggable="true" title="Kéo để đổi thứ tự">⋮⋮</span>
        <div>
          <h4 class="card-title">${escapeHtml(character.name) || "New character"}</h4>
          <div class="card-meta">${escapeHtml(character.role) || "No role set"}</div>
        </div>
      </div>
      <button class="secondary small delete-button">Delete</button>
    </div>
    <div class="card-row">
      <div class="small-row">
        <label class="card-field">Name <span class="tooltip-icon" title="Main or supporting character name.">?</span>
          ${input("name", "Name")}
        </label>
        <label class="card-field">Age <span class="tooltip-icon" title="Character age or age range.">?</span>
          ${input("age", "Age")}
        </label>
      </div>
      <div class="small-row">
        <label class="card-field">Role <span class="tooltip-icon" title="Main, antagonist, side, etc.">?</span>
          ${input("role", "Role")}
        </label>
        <label class="card-field">Personality <span class="tooltip-icon" title="Key character traits.">?</span>
          ${input("personality", "Personality")}
        </label>
      </div>
      <label class="card-field">Appearance <span class="tooltip-icon" title="Ngoại hình: tóc, mắt, dáng người, trang phục, phụ kiện, đặc điểm nhận dạng.">?</span>
        ${textarea("appearance", "e.g. long silver hair, violet eyes, slim, black school uniform with red ribbon, small scar on left cheek")}
      </label>
      <label class="card-field">Goal <span class="tooltip-icon" title="What the character wants or tries to achieve.">?</span>
        ${textarea("goal", "Goal")}
      </label>
      <label class="card-field">Secret <span class="tooltip-icon" title="Hidden detail that can affect the plot.">?</span>
        ${textarea("secret", "Secret")}
      </label>
      <label class="card-field">Relationship <span class="tooltip-icon" title="Character's connection to others in the story.">?</span>
        ${textarea("relationship", "Relationship")}
      </label>
    </div>
  `;
  attachCardEvents(card, index);
  return card;
}

function attachCardEvents(card, index) {
  card.querySelector(".delete-button").addEventListener("click", () => {
    const name = state.characters[index].name || "this character";
    if (!confirm(`Xoá ${name}?`)) return;
    state.characters.splice(index, 1);
    refreshLists();
    persist();
    showToast("Deleted");
  });

  card.querySelectorAll("[data-field]").forEach((input) => {
    input.addEventListener("input", (event) => {
      const item = state.characters[index];
      item[event.target.dataset.field] = event.target.value;
      // Cập nhật cả tên lẫn role trên header card
      card.querySelector(".card-title").textContent =
        item.name || "New character";
      card.querySelector(".card-meta").textContent = item.role || "No role set";
      adjustHeight(input);
      persist();
    });
  });

  const handle = card.querySelector(".drag-handle");
  handle.addEventListener("dragstart", handleDragStart);
  handle.addEventListener("dragend", handleDragEnd);
}

function refreshLists() {
  characterList.innerHTML = "";
  if (!state.characters.length) {
    characterList.innerHTML = `<p class="empty-hint">Chưa có nhân vật nào — bấm “+ Add Character”.</p>`;
    return;
  }
  state.characters.forEach((character, index) => {
    characterList.appendChild(buildCharacterCard(character, index));
  });
  // Textarea phải nằm trong DOM rồi mới đo được chiều cao
  characterList.querySelectorAll("textarea").forEach(adjustHeight);
}

function addCharacter() {
  state.characters.push(emptyCharacter());
  refreshLists();
  persist();
  showToast("Character added");
  const cards = characterList.querySelectorAll(".card");
  const last = cards[cards.length - 1];
  last?.scrollIntoView({ behavior: "smooth", block: "center" });
  last?.querySelector('[data-field="name"]')?.focus({ preventScroll: true });
}

/* =========================================================
   DRAG & DROP (chỉ kéo bằng tay cầm ⋮⋮, để không vướng khi bôi chữ)
   ========================================================= */

let dragFromIndex = null;

function clearDropMarkers() {
  characterList
    .querySelectorAll(".drop-target")
    .forEach((el) => el.classList.remove("drop-target"));
}

function handleDragStart(event) {
  const card = event.currentTarget.closest(".card");
  dragFromIndex = Number(card.dataset.index);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", "character");
  event.dataTransfer.setDragImage(card, 20, 20);
  card.classList.add("dragging");
}

function handleDragEnd(event) {
  event.currentTarget.closest(".card")?.classList.remove("dragging");
  clearDropMarkers();
  dragFromIndex = null;
}

function handleDragOver(event) {
  if (dragFromIndex === null) return;
  event.preventDefault();
  clearDropMarkers();
  event.target.closest(".card")?.classList.add("drop-target");
}

function handleDrop(event) {
  if (dragFromIndex === null) return;
  event.preventDefault();
  clearDropMarkers();
  const targetCard = event.target.closest(".card");
  if (!targetCard) return;
  const toIndex = Number(targetCard.dataset.index);
  if (dragFromIndex === toIndex) return;
  const moved = state.characters.splice(dragFromIndex, 1)[0];
  state.characters.splice(toIndex, 0, moved);
  dragFromIndex = null;
  refreshLists();
  persist();
  showToast("Reordered");
}

function toggleCollapse(event) {
  const button = event.target.closest(".collapse-toggle");
  const panel = button?.closest("[data-collapsible]");
  if (!panel) return;
  panel.classList.toggle("collapsed");
  button.textContent = panel.classList.contains("collapsed")
    ? "Expand"
    : "Collapse";
}

/* =========================================================
   PROMPT
   ========================================================= */

// Chỉ thêm dòng khi có nội dung — prompt không đầy "Title: " trống
function pushIf(list, label, value) {
  const text = String(value || "").trim();
  if (text) list.push(`${label}: ${text}`);
}

function describeCharacter(character) {
  const head = [character.role, character.age && `age ${character.age}`]
    .filter(Boolean)
    .join(", ");
  const lines = [`- ${character.name || "Unnamed"}${head ? ` (${head})` : ""}`];
  CHARACTER_FIELDS.filter(
    ({ key }) => !["name", "role", "age"].includes(key),
  ).forEach(({ key, label }) => {
    const value = String(character[key] || "").trim();
    if (value) lines.push(`  ${label}: ${value}`);
  });
  return lines.join("\n");
}

function buildPrompt(story) {
  const length = String(story.wordCount || "").trim() || "1000-2500";
  const parts = [
    "Write a compelling emotional short story based on the following story brief.",
    `Length: ${length} words.`,
    "Preserve the structure, expand naturally, keep pacing natural, include realistic dialogue, and avoid AI clichés.",
    "Keep each character's appearance consistent with the descriptions below.",
    "Do not change the ending.",
    "",
    "Story Brief:",
  ];
  pushIf(parts, "Title", story.title);
  pushIf(parts, "One-line Idea", story.oneLineIdea);
  pushIf(parts, "Genre", story.genre);
  pushIf(parts, "Tone", story.tone);
  pushIf(parts, "Ending", story.ending);
  pushIf(parts, "POV", story.pov);
  pushIf(parts, "Target Audience", story.audience);
  pushIf(parts, "Theme", story.theme);

  if (story.characters.length) {
    parts.push("", "Characters:");
    story.characters.forEach((c) => parts.push(describeCharacter(c)));
  }

  const plot = [];
  pushIf(plot, "Hook", story.plotHook);
  pushIf(plot, "Opening", story.plotOpening);
  pushIf(plot, "Inciting Incident", story.plotInciting);
  pushIf(plot, "Rising Action", story.plotRising);
  pushIf(plot, "Midpoint", story.plotMidpoint);
  pushIf(plot, "Twist", story.plotTwist);
  pushIf(plot, "Climax", story.plotClimax);
  pushIf(plot, "Ending", story.plotEnding);
  pushIf(plot, "Message", story.plotMoral);
  if (plot.length) parts.push("", "Plot outline:", ...plot);

  const emotion = [];
  pushIf(emotion, "Beginning Emotion", story.emotionBeginning);
  pushIf(emotion, "Middle Emotion", story.emotionMiddle);
  pushIf(emotion, "Peak Emotion", story.emotionPeak);
  pushIf(emotion, "Ending Emotion", story.emotionEnding);
  pushIf(emotion, "Reader Takeaway", story.emotionTakeaway);
  if (emotion.length) parts.push("", "Emotional beats:", ...emotion);

  return parts.join("\n");
}

/* =========================================================
   COPY BRIEF (giữ đúng mẫu cũ)
   ========================================================= */

function buildBrief() {
  const story = state;
  const lines = [
    "==================================================",
    "STORY BRIEF",
    "==================================================",
    `Title: ${story.title}`,
    `One-line Idea: ${story.oneLineIdea}`,
    `Genre: ${story.genre}`,
    `Tone: ${story.tone}`,
    `Ending: ${story.ending}`,
    `Target Word Count: ${story.wordCount}`,
    `POV: ${story.pov}`,
    `Target Audience: ${story.audience}`,
    `Theme: ${story.theme}`,
    "",
    "CHARACTERS",
    "----------------",
  ];
  story.characters.forEach((character) => {
    lines.push(character.name || "Unnamed");
    CHARACTER_FIELDS.filter(({ key }) => key !== "name").forEach(
      ({ key, label }) => lines.push(`${label}: ${character[key] || ""}`),
    );
    lines.push("");
  });
  lines.push(
    "PLOT",
    "----------------",
    `Hook: ${story.plotHook}`,
    `Opening: ${story.plotOpening}`,
    `Inciting Incident: ${story.plotInciting}`,
    `Rising Action: ${story.plotRising}`,
    `Midpoint: ${story.plotMidpoint}`,
    `Twist: ${story.plotTwist}`,
    `Climax: ${story.plotClimax}`,
    `Ending: ${story.plotEnding}`,
  );
  if (story.plotMoral) lines.push(`Moral: ${story.plotMoral}`);
  lines.push(
    "",
    "EMOTIONAL BEATS",
    "----------------",
    `Beginning Emotion: ${story.emotionBeginning}`,
    `Middle Emotion: ${story.emotionMiddle}`,
    `Peak Emotion: ${story.emotionPeak}`,
    `Ending Emotion: ${story.emotionEnding}`,
    `Reader Takeaway: ${story.emotionTakeaway}`,
  );
  return lines.join("\n");
}

function copyText(value, label) {
  navigator.clipboard.writeText(value).then(
    () => showToast(`Copied ${label}`),
    () => showToast("Unable to copy"),
  );
}

// Làm xong 1 story -> Clear All để bắt đầu story mới sạch sẽ
function clearAll() {
  if (!confirm("Xoá hết để bắt đầu story mới? (Nhớ Copy Brief trước nếu cần)"))
    return;
  state = normalizeState({});
  syncInputs();
  refreshLists();
  persist();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("Cleared");
}

/* =========================================================
   INIT
   ========================================================= */

function initNavigation() {
  document.querySelectorAll(".sidebar-nav button").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.scroll);
      target.classList.remove("collapsed");
      const toggle = target.querySelector(".collapse-toggle");
      if (toggle) toggle.textContent = "Collapse";
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      button.blur(); // để menu bubble trên mobile tự thu lại
    });
  });
}

function initEvents() {
  storageInputs.forEach((input) =>
    input.addEventListener("input", recordInput),
  );

  document.addEventListener("click", (event) => {
    if (event.target.closest(".collapse-toggle")) toggleCollapse(event);
  });

  document
    .getElementById("addCharacter")
    .addEventListener("click", addCharacter);
  document
    .getElementById("copyPrompt")
    .addEventListener("click", () => copyText(promptOutput.value, "prompt"));
  document
    .getElementById("copyBrief")
    .addEventListener("click", () => copyText(buildBrief(), "brief"));
  document.getElementById("btnClear").addEventListener("click", clearAll);

  characterList.addEventListener("dragover", handleDragOver);
  characterList.addEventListener("drop", handleDrop);
}

function initialize() {
  syncInputs();
  refreshLists();
  initNavigation();
  initEvents();
  persist();
}

initialize();
