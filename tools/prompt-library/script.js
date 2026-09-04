const STORAGE_KEY = "prompt-library-prompts-v1";

const promptList = document.getElementById("prompt-list");
const totalCount = document.getElementById("total-count");
const statsBadge = document.getElementById("stats-badge");
const addBtn = document.getElementById("add-btn");
const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("close-modal");
const cancelModalBtn = document.getElementById("cancel-modal");
const promptForm = document.getElementById("prompt-form");
const modalTitle = document.getElementById("modal-title");
const modalDescription = document.getElementById("modal-description");
const formBody = document.getElementById("form-body");
const deleteSummary = document.getElementById("delete-summary");
const deleteTitle = document.getElementById("delete-title");
const titleInput = document.getElementById("title");
const contentInput = document.getElementById("content");
const imageUrlInput = document.getElementById("image-url");
const submitBtn = document.getElementById("submit-btn");
const previewImage = document.getElementById("preview-image");
const formError = document.getElementById("form-error");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");

// DOM elements for Backup
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");

// Search element
const searchInput = document.getElementById("search-input");
let searchQuery = "";

let prompts = [];
let activeMode = "add";
let editingId = null;

const samplePrompts = [
  {
    id: crypto.randomUUID(),
    title: "Product Launch Email",
    content:
      "Write a warm launch email for a new AI app, highlight the value, invite users to try the beta, and keep the tone energetic.",
    imageUrl: "",
    copyCount: 0,
  },
  {
    id: crypto.randomUUID(),
    title: "Weekly Team Summary",
    content:
      "Summarize the team's progress in a concise executive style. Mention completed work, blockers, and next steps.",
    imageUrl: "",
    copyCount: 0,
  },
  {
    id: crypto.randomUUID(),
    title: "Social Caption",
    content:
      "Create a polished Instagram caption for a design product launch. Make it short, punchy, and slightly premium.",
    imageUrl: "",
    copyCount: 0,
  },
];

function normalizePrompt(prompt) {
  return {
    ...prompt,
    copyCount: Number.isFinite(Number(prompt.copyCount))
      ? Math.max(0, Number(prompt.copyCount))
      : 0,
  };
}

function loadPrompts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      prompts = samplePrompts;
      savePrompts();
      return;
    }

    const parsed = JSON.parse(stored);
    prompts =
      Array.isArray(parsed) && parsed.length > 0
        ? parsed.map(normalizePrompt)
        : samplePrompts;
  } catch (error) {
    console.error("Failed to read prompts from storage", error);
    prompts = samplePrompts;
  }
}

function savePrompts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPreviewImage(title, content) {
  const safeTitle = escapeHtml(title || "Prompt");
  const safeContent = escapeHtml(content || "Write your next prompt here...");
  const lines = safeContent
    .split(/\n|\.\s+/)
    .filter(Boolean)
    .slice(0, 4);
  const lineMarkup = lines
    .map((line) => {
      const normalized = line.length > 46 ? `${line.slice(0, 43)}...` : line;
      return `<text x="26" y="${120 + lines.indexOf(line) * 28}" fill="#f5f5f4" font-size="16" font-family="Segoe UI, Arial, sans-serif">${normalized}</text>`;
    })
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="560">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#111827" />
          <stop offset="100%" stop-color="#ef4444" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" rx="36" />
      <rect x="28" y="28" width="844" height="504" rx="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" />
      <circle cx="760" cy="120" r="90" fill="rgba(255,255,255,0.16)" />
      <text x="40" y="132" fill="#fda4af" font-size="26" font-family="Segoe UI, Arial, sans-serif" font-weight="700">Prompt Preview</text>
      <text x="40" y="184" fill="#f9fafb" font-size="36" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${safeTitle}</text>
      ${lineMarkup}
      <text x="40" y="468" fill="#e5e7eb" font-size="20" font-family="Segoe UI, Arial, sans-serif">Hover to zoom • Local library</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolvePreviewSrc(prompt) {
  if (prompt.imageUrl && prompt.imageUrl.trim()) {
    return prompt.imageUrl.trim();
  }
  return buildPreviewImage(prompt.title, prompt.content);
}

function showLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add("active");
}

function hideLightbox() {
  lightbox.classList.remove("active");
}

function attachLightboxHandlers() {
  const frames = promptList.querySelectorAll(".preview-frame");
  frames.forEach((frame) => {
    const img = frame.querySelector("img");
    if (!img) return;
    frame.addEventListener("mouseenter", () => showLightbox(img.src));
    frame.addEventListener("mouseleave", hideLightbox);
  });
}

function renderPrompts() {
  // Thực hiện lọc mảng dựa trên realtime text search
  const filteredPrompts = prompts
    .filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery) ||
        p.content.toLowerCase().includes(searchQuery),
    )
    .sort(
      (firstPrompt, secondPrompt) =>
        secondPrompt.copyCount - firstPrompt.copyCount,
    );

  if (!filteredPrompts.length) {
    promptList.innerHTML = `
      <div class="neu-pressed p-6 text-center text-gray-400 md:col-span-2">
        <p class="text-lg font-semibold text-white">No prompts found</p>
        <p class="mt-2">Try a different search keyword.</p>
      </div>
    `;
    totalCount.textContent = prompts.length; // Tổng số thực
    statsBadge.textContent = "0 matches found";
    hideLightbox();
    return;
  }

  totalCount.textContent = prompts.length;
  statsBadge.textContent = `${filteredPrompts.length} prompts showing`;

  promptList.innerHTML = filteredPrompts
    .map((prompt) => {
      const previewSrc = resolvePreviewSrc(prompt);
      const fallbackSrc = buildPreviewImage(prompt.title, prompt.content);
      const safeTitle = escapeHtml(prompt.title);
      const safeContent = escapeHtml(prompt.content);

      // Tính năng: Check xem text có dài quá không để hiện nút "Xem thêm"
      const needsExpand = safeContent.length > 130;

      return `
        <article class="neu-pressed p-4 flex flex-col h-full gap-3">
          <div class="preview-frame rounded-2xl shrink-0">
            <img src="${previewSrc}" alt="Preview for ${safeTitle}" onerror="this.onerror=null;this.src='${fallbackSrc}'" />
            <div class="zoom-badge">Hover to enlarge</div>
          </div>

          <!-- Chỗ này flex-1 để nó tự đẩy action buttons xuống cuối thẻ -->
          <div class="flex-1 flex flex-col">
            <div class="flex items-start justify-between gap-2">
              <h3 class="text-lg font-semibold text-white">${safeTitle}</h3>
              <span class="text-xs uppercase text-red-400">Prompt</span>
            </div>
            <div data-copy-count class="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <i class="fa-solid fa-copy"></i>
              <span>${prompt.copyCount} ${prompt.copyCount === 1 ? "copy" : "copies"}</span>
            </div>
            
            <div class="mt-2 flex-1">
              <p class="text-sm text-gray-400 leading-relaxed transition-all duration-200 ${needsExpand ? "line-clamp-3" : ""}">${safeContent}</p>
              ${needsExpand ? `<button data-action="toggle-expand" class="text-xs font-semibold text-gray-400 mt-2 hover:text-white transition">Show more</button>` : ""}
            </div>
          </div>

          <div class="flex gap-2 shrink-0 mt-2">
            <button data-action="copy" data-id="${prompt.id}" class="neu-btn flex-1 px-3 py-2 text-sm text-emerald-400 font-bold">
              <i class="fa-solid fa-copy"></i> Copy
            </button>
            <button data-action="edit" data-id="${prompt.id}" class="neu-btn flex-1 px-3 py-2 text-sm text-gray-300">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button data-action="delete" data-id="${prompt.id}" class="neu-btn flex-1 px-3 py-2 text-sm text-red-400">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  attachLightboxHandlers();
}

function resetForm() {
  titleInput.value = "";
  contentInput.value = "";
  imageUrlInput.value = "";
  previewImage.src = "";
  formError.classList.add("hidden");
  formError.textContent = "";
}

function openModal(mode, id = null) {
  activeMode = mode;
  editingId = id;
  resetForm();

  if (mode === "edit" || mode === "delete") {
    const prompt = prompts.find((item) => item.id === id);
    if (!prompt) return;

    if (mode === "edit") {
      titleInput.value = prompt.title;
      contentInput.value = prompt.content;
      imageUrlInput.value = prompt.imageUrl || "";
      previewImage.src = resolvePreviewSrc(prompt);
      formBody.classList.remove("hidden");
      deleteSummary.classList.add("hidden");
      submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save';
      modalTitle.textContent = "Edit Prompt";
      modalDescription.textContent = "Update prompt content and preview.";
    } else {
      deleteSummary.classList.remove("hidden");
      deleteTitle.textContent = `${prompt.title}`;
      formBody.classList.add("hidden");
      submitBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Prompt';
      modalTitle.textContent = "Delete Prompt";
      modalDescription.textContent =
        "Are you sure you want to delete this prompt?";
    }
  } else {
    formBody.classList.remove("hidden");
    deleteSummary.classList.add("hidden");
    submitBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Prompt';
    modalTitle.textContent = "Add Prompt";
    modalDescription.textContent =
      "Create a new prompt and preview it instantly.";
    previewImage.src = buildPreviewImage("", "");
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeModal() {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function updatePreview() {
  const urlValue = imageUrlInput.value.trim();
  if (urlValue) {
    previewImage.src = urlValue;
    return;
  }
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  previewImage.src = buildPreviewImage(title, content);
}

function handleSubmit(event) {
  event.preventDefault();

  if (activeMode === "delete") {
    prompts = prompts.filter((item) => item.id !== editingId);
    savePrompts();
    renderPrompts();
    closeModal();
    return;
  }

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const imageUrl = imageUrlInput.value.trim();

  if (!title || !content) {
    formError.textContent = "Title and Prompt Content cannot be empty.";
    formError.classList.remove("hidden");
    return;
  }

  if (activeMode === "edit" && editingId) {
    prompts = prompts.map((item) =>
      item.id === editingId ? { ...item, title, content, imageUrl } : item,
    );
  } else {
    prompts.unshift({ id: crypto.randomUUID(), title, content, imageUrl });
  }

  savePrompts();
  renderPrompts();
  closeModal();
}

async function copyPromptContent(id, button) {
  const prompt = prompts.find((item) => item.id === id);
  if (!prompt) return;

  try {
    await navigator.clipboard.writeText(prompt.content);
    prompt.copyCount = (prompt.copyCount || 0) + 1;
    savePrompts();
    const countLabel = button
      .closest("article")
      ?.querySelector("[data-copy-count] span");
    if (countLabel) {
      countLabel.textContent = `${prompt.copyCount} ${prompt.copyCount === 1 ? "copy" : "copies"}`;
    }
    const original = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
    setTimeout(() => {
      button.innerHTML = original;
    }, 1200);
  } catch (error) {
    console.error("Copy failed", error);
    button.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Failed';
    setTimeout(() => {
      button.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
    }, 1200);
  }
}

function exportBackup() {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(prompts, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "prompt_backup.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (Array.isArray(importedData)) {
        prompts = importedData.map(normalizePrompt);
        savePrompts();
        renderPrompts();
        alert("Import backup thành công m nha!");
      } else {
        alert("File json không đúng định dạng bro ơi.");
      }
    } catch (err) {
      alert("Lỗi đọc file json cmnr.");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

// Bắt sự kiện Realtime Search
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase();
  renderPrompts();
});

// Event Listeners cho Backup
exportBtn.addEventListener("click", exportBackup);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importBackup);

// Các Event Listeners cơ bản
addBtn.addEventListener("click", () => openModal("add"));
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
promptForm.addEventListener("submit", handleSubmit);
titleInput.addEventListener("input", updatePreview);
contentInput.addEventListener("input", updatePreview);
imageUrlInput.addEventListener("input", updatePreview);

promptList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "edit") {
    openModal("edit", id);
  } else if (action === "delete") {
    openModal("delete", id);
  } else if (action === "copy") {
    copyPromptContent(id, button);
  } else if (action === "toggle-expand") {
    // Xử lý nút Show More / Show Less
    const paragraphElement = button.previousElementSibling;
    if (paragraphElement.classList.contains("line-clamp-3")) {
      paragraphElement.classList.remove("line-clamp-3");
      button.textContent = "Show less";
    } else {
      paragraphElement.classList.add("line-clamp-3");
      button.textContent = "Show more";
    }
  }
});

loadPrompts();
renderPrompts();
