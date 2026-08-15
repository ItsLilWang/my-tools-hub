const sceneNameInput = document.getElementById("scene-name");
const sceneContentInput = document.getElementById("scene-content");
const addSceneButton = document.getElementById("add-scene-btn");
const exportButton = document.getElementById("export-btn");
const clearButton = document.getElementById("clear-btn");
const sceneList = document.getElementById("scene-list");
const sceneCount = document.getElementById("scene-count");
const patternPreview = document.getElementById("pattern-preview");
const jsonOutput = document.getElementById("json-output");

const state = {
  baseName: "story_3",
  scenes: [],
};

function safeBaseName(value) {
  const trimmedValue = value.trim();
  return trimmedValue || "scene";
}

function normalizeSceneContent(value) {
  return value.replace(/\r\n/g, "\n").trim();
}

function buildSceneFileName(baseName, sceneNumber) {
  return `${baseName} (${sceneNumber}).png`;
}

function updatePatternPreview() {
  const baseName = safeBaseName(sceneNameInput.value);
  const sceneNumber = state.scenes.length + 1;
  patternPreview.textContent = `${buildSceneFileName(baseName, sceneNumber)}`;
}

function buildJsonPayload() {
  return {
    baseName: safeBaseName(sceneNameInput.value),
    scenes: state.scenes.map((scene) => ({
      scene: scene.scene,
      fileName: scene.fileName,
      content: scene.content,
    })),
  };
}

function createSceneRow(scene) {
  const row = document.createElement("div");
  row.className = "neu-btn p-3 text-sm";

  const topRow = document.createElement("div");
  topRow.className = "flex items-center justify-between gap-3 mb-3";

  const leftBlock = document.createElement("div");
  leftBlock.className = "flex items-center gap-3 min-w-0";

  const indexBadge = document.createElement("span");
  indexBadge.className =
    "w-8 h-8 rounded-full bg-zinc-800 text-red-500 flex items-center justify-center font-bold";
  indexBadge.textContent = scene.scene;

  const fileNameText = document.createElement("span");
  fileNameText.className = "text-gray-300 truncate";
  fileNameText.textContent = scene.fileName;

  leftBlock.appendChild(indexBadge);
  leftBlock.appendChild(fileNameText);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className =
    "neu-btn w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-500";
  removeButton.title = "Remove scene";
  removeButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
  removeButton.addEventListener("click", () => {
    removeScene(scene.scene);
  });

  topRow.appendChild(leftBlock);
  topRow.appendChild(removeButton);

  const textArea = document.createElement("textarea");
  textArea.rows = 3;
  textArea.value = scene.content;
  textArea.className =
    "w-full neu-pressed border-0 outline-none px-3 py-2 text-gray-200 placeholder:text-gray-500 resize-none";
  textArea.placeholder = "Enter scene content here...";
  textArea.addEventListener("input", (event) => {
    scene.content = normalizeSceneContent(event.target.value);
    jsonOutput.textContent = JSON.stringify(buildJsonPayload(), null, 2);
  });

  row.appendChild(topRow);
  row.appendChild(textArea);
  return row;
}

function renderSceneList() {
  sceneList.innerHTML = "";

  if (state.scenes.length === 0) {
    sceneList.innerHTML = `
      <div class="neu-btn p-4 text-sm text-gray-500 text-center">
        No scene added yet. Enter a base name, type the scene content, and click the plus button.
      </div>
    `;
    sceneCount.textContent = "0";
    jsonOutput.textContent = JSON.stringify(buildJsonPayload(), null, 2);
    updatePatternPreview();
    return;
  }

  state.scenes.forEach((scene) => {
    sceneList.appendChild(createSceneRow(scene));
  });

  sceneCount.textContent = String(state.scenes.length);
  jsonOutput.textContent = JSON.stringify(buildJsonPayload(), null, 2);
  updatePatternPreview();
}

function addScene() {
  const baseName = safeBaseName(sceneNameInput.value);
  const nextSceneNumber = state.scenes.length + 1;
  const sceneContent = normalizeSceneContent(sceneContentInput.value);
  const fileName = buildSceneFileName(baseName, nextSceneNumber);

  if (!sceneContent) {
    sceneContentInput.focus();
    return;
  }

  state.scenes.push({
    scene: nextSceneNumber,
    fileName,
    content: sceneContent,
  });

  sceneContentInput.value = "";
  renderSceneList();
  sceneContentInput.focus();
}

function removeScene(sceneNumber) {
  const updatedScenes = state.scenes
    .filter((scene) => scene.scene !== sceneNumber)
    .map((scene, index) => ({
      scene: index + 1,
      fileName: buildSceneFileName(
        safeBaseName(sceneNameInput.value),
        index + 1,
      ),
      content: scene.content || "",
    }));

  state.scenes = updatedScenes;
  renderSceneList();
}

function clearScenes() {
  state.scenes = [];
  renderSceneList();
}

function downloadJson() {
  const payload = buildJsonPayload();
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeBaseName(sceneNameInput.value) || "scene"}-export.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

sceneNameInput.addEventListener("input", () => {
  updatePatternPreview();
  if (state.scenes.length > 0) {
    const baseName = safeBaseName(sceneNameInput.value);
    state.scenes = state.scenes.map((scene, index) => ({
      scene: index + 1,
      fileName: buildSceneFileName(baseName, index + 1),
      content: scene.content || "",
    }));
    renderSceneList();
  }
});

addSceneButton.addEventListener("click", addScene);
exportButton.addEventListener("click", downloadJson);
clearButton.addEventListener("click", clearScenes);
sceneNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addScene();
  }
});
sceneContentInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    addScene();
  }
});

sceneNameInput.value = state.baseName;
renderSceneList();
