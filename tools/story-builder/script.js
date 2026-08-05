const STORAGE_KEY = "story-builder-v1";
const sections = document.querySelectorAll("[data-collapsible]");
const toast = document.getElementById("toast");
const fileInput = document.getElementById("fileInput");
const characterList = document.getElementById("characterList");
const promptOutput = document.getElementById("promptOutput");
const storageInputs = [...document.querySelectorAll("[data-storage]")];

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
  prompt: "",
};

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch (error) {
    console.error("Unable to load storage", error);
    return { ...defaults };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  showToast("Saved");
}

function showToast(message) {
  const translations = {
    Saved: "Saved",
    Deleted: "Deleted",
    "Prompt generated": "Prompt generated",
    "Exported TXT": "Exported TXT",
    "Exported Markdown": "Exported Markdown",
    "Exported JSON": "Exported JSON",
    Copied: "Copied",
    "Unable to copy": "Unable to copy",
    Cleared: "Cleared",
    "Imported JSON": "Imported JSON",
    "Imported TXT": "Imported TXT",
    "Character added": "Character added",
    Reordered: "Reordered",
    "Invalid JSON file": "Invalid JSON file",
  };
  toast.textContent = translations[message] || message;
  toast.classList.add("visible");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(
    () => toast.classList.remove("visible"),
    1800,
  );
}

function syncInputs() {
  storageInputs.forEach((input) => {
    const key = input.dataset.storage;
    input.value = state[key] || "";
    adjustHeight(input);
  });
}

function adjustHeight(textarea) {
  if (textarea.tagName !== "TEXTAREA") return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function recordInput(event) {
  const target = event.target;
  if (!target.dataset.storage) return;
  const key = target.dataset.storage;
  state[key] = target.value;
  saveStateSilently();
}

function saveStateSilently() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function buildCharacterCard(character = {}, index) {
  const card = document.createElement("div");
  card.className = "card draggable";
  card.draggable = true;
  card.dataset.type = "character";
  card.dataset.index = index;
  card.innerHTML = `
    <div class="card-header">
      <div>
        <h4 class="card-title">${character.name || "New character"}</h4>
        <div class="card-meta">${character.role || "No role set"}</div>
      </div>
      <button class="secondary delete-button">Delete</button>
    </div>
    <div class="card-row">
      <div class="small-row">
        <label class="card-field">Name <span class="tooltip-icon" title="Main or supporting character name.">?</span>
            <input type="text" data-field="name" value="${escapeValue(character.name)}" placeholder="Name" />
          </label>
        <label class="card-field">Age <span class="tooltip-icon" title="Character age or age range.">?</span>
            <input type="text" data-field="age" value="${escapeValue(character.age)}" placeholder="Age" />
          </label>
      </div>
      <div class="small-row">
        <label class="card-field">Role <span class="tooltip-icon" title="Main, antagonist, side, etc.">?</span>
            <input type="text" data-field="role" value="${escapeValue(character.role)}" placeholder="Role" />
          </label>
        <label class="card-field">Personality <span class="tooltip-icon" title="Key character traits.">?</span>
            <input type="text" data-field="personality" value="${escapeValue(character.personality)}" placeholder="Personality" />
          </label>
      </div>
      <label class="card-field">Goal <span class="tooltip-icon" title="What the character wants or tries to achieve.">?</span>
        <textarea data-field="goal" placeholder="Goal">${escapeValue(character.goal)}</textarea>
      </label>
      <label class="card-field">Secret <span class="tooltip-icon" title="Hidden detail that can affect the plot.">?</span>
        <textarea data-field="secret" placeholder="Secret">${escapeValue(character.secret)}</textarea>
      </label>
      <label class="card-field">Relationship <span class="tooltip-icon" title="Character's connection to others in the story.">?</span>
        <textarea data-field="relationship" placeholder="Relationship">${escapeValue(character.relationship)}</textarea>
      </label>
    </div>
  `;
  attachCardEvents(card, index, "characters");
  return card;
}

function attachCardEvents(card, index, listKey) {
  const deleteButton = card.querySelector(".delete-button");
  deleteButton.addEventListener("click", () => {
    state[listKey].splice(index, 1);
    refreshLists();
    saveStateSilently();
    showToast("Deleted");
  });

  const inputs = card.querySelectorAll("[data-field]");
  inputs.forEach((input) => {
    input.addEventListener("input", (event) => {
      const field = event.target.dataset.field;
      const value = event.target.value;
      const item = state[listKey][index];
      item[field] = value;
      const title = card.querySelector(".card-title");
      title.textContent = item.name || "New character";
      saveStateSilently();
      if (input.tagName === "TEXTAREA") adjustHeight(input);
    });
    if (input.tagName === "TEXTAREA") adjustHeight(input);
  });

  if (card.draggable) {
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);
  }
}

function escapeValue(value = "") {
  return String(value || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function refreshLists() {
  characterList.innerHTML = "";
  state.characters.forEach((character, index) => {
    characterList.appendChild(buildCharacterCard(character, index));
  });
}

function addCharacter() {
  state.characters.push({
    name: "",
    age: "",
    role: "",
    personality: "",
    goal: "",
    secret: "",
    relationship: "",
  });
  refreshLists();
  saveStateSilently();
  showToast("Character added");
}

function handleDragStart(event) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    "text/plain",
    JSON.stringify({
      type: event.currentTarget.dataset.type,
      index: Number(event.currentTarget.dataset.index),
    }),
  );
  event.currentTarget.classList.add("dragging");
}

function handleDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
}

function handleDragOver(event) {
  event.preventDefault();
  const target = event.target.closest(".card");
  if (!target) return;
  target.style.borderTop = "2px solid #5ea8ff";
}

function handleDragLeave(event) {
  const target = event.target.closest(".card");
  if (target) target.style.borderTop = "";
}

function handleDrop(event) {
  event.preventDefault();
  const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
  const targetCard = event.target.closest(".card");
  if (!targetCard || targetCard.dataset.type !== payload.type) return;
  const fromIndex = payload.index;
  const toIndex = Number(targetCard.dataset.index);
  if (fromIndex === toIndex) return;
  const list = state[`${payload.type}s`];
  const moved = list.splice(fromIndex, 1)[0];
  list.splice(toIndex, 0, moved);
  refreshLists();
  saveStateSilently();
  showToast("Reordered");
}

function attachDragDrop(listElement) {
  listElement.addEventListener("dragover", handleDragOver);
  listElement.addEventListener("dragleave", handleDragLeave);
  listElement.addEventListener("drop", handleDrop);
}

function toggleCollapse(event) {
  const button = event.target.closest(".collapse-toggle");
  if (!button) return;
  const panel = button.closest("[data-collapsible]");
  if (!panel) return;
  panel.classList.toggle("collapsed");
  button.textContent = panel.classList.contains("collapsed")
    ? "Expand"
    : "Collapse";
}

function generatePrompt() {
  const story = gatherStoryState();
  const promptParts = [
    `Write a compelling emotional short story based on the following story brief, preserving the ending and keeping pacing natural.`,
    `Length: 1000-2500 words.`,
    `Preserve structure, expand naturally, include realistic dialogue, and avoid AI clichés.`,
    `Do not change the ending.`,
    `Story Brief:`,
    `Title: ${story.title}`,
    `One-line Idea: ${story.oneLineIdea}`,
    `Genre: ${story.genre}`,
    `Tone: ${story.tone}`,
    `Ending: ${story.ending}`,
    `Target Word Count: ${story.wordCount}`,
    `POV: ${story.pov}`,
    `Target Audience: ${story.audience}`,
    `Theme: ${story.theme}`,
    `Characters:`,
  ];

  story.characters.forEach((character) => {
    promptParts.push(
      `- ${character.name || "Unnamed"} (${character.role || "Role"}): ${character.personality || "Personality"}; Goal: ${character.goal || "Goal"}; Secret: ${character.secret || "Secret"}; Relationship: ${character.relationship || "Relationship"}`,
    );
  });

  promptParts.push("");
  promptParts.push("Plot outline:");
  promptParts.push(`Hook: ${story.plotHook}`);
  promptParts.push(`Opening: ${story.plotOpening}`);
  promptParts.push(`Inciting Incident: ${story.plotInciting}`);
  promptParts.push(`Rising Action: ${story.plotRising}`);
  promptParts.push(`Midpoint: ${story.plotMidpoint}`);
  promptParts.push(`Twist: ${story.plotTwist}`);
  promptParts.push(`Climax: ${story.plotClimax}`);
  promptParts.push(`Ending: ${story.plotEnding}`);
  if (story.plotMoral) promptParts.push(`Moral: ${story.plotMoral}`);

  promptParts.push("");
  promptParts.push("Emotional beats:");
  promptParts.push(`Beginning Emotion: ${story.emotionBeginning}`);
  promptParts.push(`Middle Emotion: ${story.emotionMiddle}`);
  promptParts.push(`Peak Emotion: ${story.emotionPeak}`);
  promptParts.push(`Ending Emotion: ${story.emotionEnding}`);
  promptParts.push(`Reader Takeaway: ${story.emotionTakeaway}`);

  story.prompt = promptParts.join("\n");
  promptOutput.value = story.prompt;
  adjustHeight(promptOutput);
  state.prompt = story.prompt;
  saveStateSilently();
  showToast("Prompt generated");
}

function gatherStoryState() {
  const data = { ...state };
  storageInputs.forEach((input) => {
    data[input.dataset.storage] = input.value;
  });
  return data;
}

function exportTxt() {
  const body = buildTxtExport();
  downloadFile("story-brief.txt", body, "text/plain");
  showToast("Exported TXT");
}

function exportMarkdown() {
  const body = buildMarkdownExport();
  downloadFile("story-brief.md", body, "text/markdown");
  showToast("Exported Markdown");
}

function exportJson() {
  const payload = JSON.stringify(gatherStoryState(), null, 2);
  downloadFile("story-brief.json", payload, "application/json");
  showToast("Exported JSON");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildTxtExport() {
  const story = gatherStoryState();
  const lines = [];
  lines.push("==================================================");
  lines.push("STORY BRIEF");
  lines.push("==================================================");
  lines.push(`Title: ${story.title}`);
  lines.push(`One-line Idea: ${story.oneLineIdea}`);
  lines.push(`Genre: ${story.genre}`);
  lines.push(`Tone: ${story.tone}`);
  lines.push(`Ending: ${story.ending}`);
  lines.push(`Target Word Count: ${story.wordCount}`);
  lines.push(`POV: ${story.pov}`);
  lines.push(`Target Audience: ${story.audience}`);
  lines.push(`Theme: ${story.theme}`);
  lines.push("");
  lines.push("CHARACTERS");
  lines.push("----------------");
  story.characters.forEach((character) => {
    lines.push(`${character.name}`);
    lines.push(`Age: ${character.age}`);
    lines.push(`Role: ${character.role}`);
    lines.push(`Personality: ${character.personality}`);
    lines.push(`Goal: ${character.goal}`);
    lines.push(`Secret: ${character.secret}`);
    lines.push(`Relationship: ${character.relationship}`);
    lines.push("");
  });
  lines.push("PLOT");
  lines.push("----------------");
  lines.push(`Hook: ${story.plotHook}`);
  lines.push(`Opening: ${story.plotOpening}`);
  lines.push(`Inciting Incident: ${story.plotInciting}`);
  lines.push(`Rising Action: ${story.plotRising}`);
  lines.push(`Midpoint: ${story.plotMidpoint}`);
  lines.push(`Twist: ${story.plotTwist}`);
  lines.push(`Climax: ${story.plotClimax}`);
  lines.push(`Ending: ${story.plotEnding}`);
  if (story.plotMoral) lines.push(`Moral: ${story.plotMoral}`);
  lines.push("");
  lines.push("EMOTIONAL BEATS");
  lines.push("----------------");
  lines.push(`Beginning Emotion: ${story.emotionBeginning}`);
  lines.push(`Middle Emotion: ${story.emotionMiddle}`);
  lines.push(`Peak Emotion: ${story.emotionPeak}`);
  lines.push(`Ending Emotion: ${story.emotionEnding}`);
  lines.push(`Reader Takeaway: ${story.emotionTakeaway}`);
  return lines.join("\n");
}

function buildMarkdownExport() {
  const story = gatherStoryState();
  const lines = [];
  lines.push("# Story Brief");
  lines.push("");
  lines.push(`**Title:** ${story.title}`);
  lines.push(`**One-line Idea:** ${story.oneLineIdea}`);
  lines.push(`**Genre:** ${story.genre}`);
  lines.push(`**Tone:** ${story.tone}`);
  lines.push(`**Ending:** ${story.ending}`);
  lines.push(`**Target Word Count:** ${story.wordCount}`);
  lines.push(`**POV:** ${story.pov}`);
  lines.push(`**Target Audience:** ${story.audience}`);
  lines.push(`**Theme:** ${story.theme}`);
  lines.push("");
  if (story.characters.length) {
    lines.push("## Characters");
    story.characters.forEach((character) => {
      lines.push(`### ${character.name || "Unnamed Character"}`);
      lines.push(`- **Age:** ${character.age}`);
      lines.push(`- **Role:** ${character.role}`);
      lines.push(`- **Personality:** ${character.personality}`);
      lines.push(`- **Goal:** ${character.goal}`);
      lines.push(`- **Secret:** ${character.secret}`);
      lines.push(`- **Relationship:** ${character.relationship}`);
      lines.push("");
    });
  }
  lines.push("## Plot");
  lines.push(`- **Hook:** ${story.plotHook}`);
  lines.push(`- **Opening:** ${story.plotOpening}`);
  lines.push(`- **Inciting Incident:** ${story.plotInciting}`);
  lines.push(`- **Rising Action:** ${story.plotRising}`);
  lines.push(`- **Midpoint:** ${story.plotMidpoint}`);
  lines.push(`- **Twist:** ${story.plotTwist}`);
  lines.push(`- **Climax:** ${story.plotClimax}`);
  lines.push(`- **Ending:** ${story.plotEnding}`);
  if (story.plotMoral) lines.push(`- **Moral:** ${story.plotMoral}`);
  lines.push("");
  lines.push("## Emotional Beats");
  lines.push(`- **Beginning Emotion:** ${story.emotionBeginning}`);
  lines.push(`- **Middle Emotion:** ${story.emotionMiddle}`);
  lines.push(`- **Peak Emotion:** ${story.emotionPeak}`);
  lines.push(`- **Ending Emotion:** ${story.emotionEnding}`);
  lines.push(`- **Reader Takeaway:** ${story.emotionTakeaway}`);
  return lines.join("\n");
}

function copyText(value) {
  navigator.clipboard.writeText(value).then(
    () => showToast("Copied"),
    () => showToast("Unable to copy"),
  );
}

function copyPrompt() {
  copyText(promptOutput.value);
}

function copyBrief() {
  copyText(buildTxtExport());
}

function clearAll() {
  if (!confirm("Clear all data and reset the story builder?")) return;
  state = { ...defaults };
  syncInputs();
  refreshLists();
  promptOutput.value = "";
  saveStateSilently();
  showToast("Cleared");
}

function importJson() {
  fileInput.accept = "application/json";
  fileInput.onchange = handleJsonImport;
  fileInput.click();
}

function handleJsonImport(event) {
  const file = event.target.files[0];
  fileInput.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      state = { ...defaults, ...incoming };
      syncInputs();
      refreshLists();
      promptOutput.value = state.prompt || "";
      adjustHeight(promptOutput);
      saveStateSilently();
      showToast("Imported JSON");
    } catch (error) {
      showToast("Invalid JSON file");
    }
  };
  reader.readAsText(file);
}

function importTxt() {
  fileInput.accept = "text/plain";
  fileInput.onchange = handleTxtImport;
  fileInput.click();
}

function handleTxtImport(event) {
  const file = event.target.files[0];
  fileInput.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = reader.result;
    parseTxtImport(text);
  };
  reader.readAsText(file);
}

function parseTxtImport(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const imported = { ...defaults };
  const section = { current: "" };
  lines.forEach((line) => {
    if (!line) return;
    if (line.startsWith("STORY BRIEF")) {
      section.current = "brief";
      return;
    }
    if (line.startsWith("CHARACTERS")) {
      section.current = "characters";
      return;
    }
    if (line.startsWith("PLOT")) {
      section.current = "plot";
      return;
    }
    if (line.startsWith("EMOTIONAL BEATS")) {
      section.current = "emotion";
      return;
    }

    switch (section.current) {
      case "brief":
        parseKeyValue(line, imported);
        break;
      case "plot":
        parseKeyValue(line, imported);
        break;
      case "emotion":
        parseKeyValue(line, imported);
        break;
      case "characters":
        parseListItem(line, imported.characters);
        break;
    }
  });
  state = { ...defaults, ...imported };
  syncInputs();
  refreshLists();
  saveStateSilently();
  showToast("Imported TXT");
}

function parseKeyValue(line, target) {
  const [rawKey, ...rest] = line.split(":");
  const key = rawKey.trim().toLowerCase().replace(/ /g, "");
  const value = rest.join(":").trim();
  const mapping = {
    title: "title",
    "one-lineidea": "oneLineIdea",
    genre: "genre",
    tone: "tone",
    ending: "ending",
    targetwordcount: "wordCount",
    pov: "pov",
    targetaudience: "audience",
    theme: "theme",
    hook: "plotHook",
    opening: "plotOpening",
    incitingincident: "plotInciting",
    risingaction: "plotRising",
    midpoint: "plotMidpoint",
    twist: "plotTwist",
    climax: "plotClimax",
    moral: "plotMoral",
    beginningemotion: "emotionBeginning",
    middleemotion: "emotionMiddle",
    peakemotion: "emotionPeak",
    endingemotion: "emotionEnding",
    readertakeaway: "emotionTakeaway",
  };
  if (mapping[key]) {
    target[mapping[key]] = value;
  }
}

function parseListItem(line, list) {
  if (line.startsWith("- ")) {
    list.push({
      name: line.slice(2),
      age: "",
      role: "",
      personality: "",
      goal: "",
      secret: "",
      relationship: "",
    });
  }
}

function initNavigation() {
  document.querySelectorAll(".sidebar-nav button").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.scroll);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function initEvents() {
  storageInputs.forEach((input) => {
    input.addEventListener("input", recordInput);
    if (input.tagName === "TEXTAREA") {
      input.addEventListener("input", (event) => adjustHeight(event.target));
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest(".collapse-toggle")) toggleCollapse(event);
  });
  document
    .getElementById("addCharacter")
    .addEventListener("click", addCharacter);
  document
    .getElementById("btnGenerate")
    .addEventListener("click", generatePrompt);
  document.getElementById("exportTxt").addEventListener("click", exportTxt);
  document.getElementById("exportMd").addEventListener("click", exportMarkdown);
  document.getElementById("exportJson").addEventListener("click", exportJson);
  document.getElementById("copyPrompt").addEventListener("click", copyPrompt);
  document.getElementById("copyBrief").addEventListener("click", copyBrief);
  document.getElementById("importJson").addEventListener("click", importJson);
  document.getElementById("importTxt").addEventListener("click", importTxt);
  document
    .getElementById("btnClearConfirm")
    .addEventListener("click", clearAll);
  attachDragDrop(characterList);

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      exportTxt();
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copyPrompt();
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      exportMarkdown();
    }
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "j") {
      event.preventDefault();
      exportJson();
    }
  });
}

function initialize() {
  syncInputs();
  refreshLists();
  promptOutput.value = state.prompt || "";
  adjustHeight(promptOutput);
  initNavigation();
  initEvents();
}

initialize();
