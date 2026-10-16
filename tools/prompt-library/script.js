const STORAGE_KEY = "prompt-library-prompts-v1";

const $ = (id) => document.getElementById(id);

const promptList = $("prompt-list");
const tagFilter = $("tag-filter");
const totalCount = $("total-count");
const statsBadge = $("stats-badge");
const addBtn = $("add-btn");
const modal = $("modal");
const closeModalBtn = $("close-modal");
const cancelModalBtn = $("cancel-modal");
const promptForm = $("prompt-form");
const modalTitle = $("modal-title");
const modalDescription = $("modal-description");
const formBody = $("form-body");
const deleteSummary = $("delete-summary");
const deleteTitle = $("delete-title");
const titleInput = $("title");
const tagsInput = $("tags");
const tagSuggestions = $("tag-suggestions");
const contentInput = $("content");
const imageUrlInput = $("image-url");
const submitBtn = $("submit-btn");
const previewImage = $("preview-image");
const formError = $("form-error");
const lightbox = $("lightbox");
const lightboxImg = $("lightbox-img");
const toastEl = $("toast");

// Backup
const exportBtn = $("export-btn");
const importBtn = $("import-btn");
const importFile = $("import-file");
const importModal = $("import-modal");
const importSummary = $("import-summary");
const importMergeBtn = $("import-merge-btn");
const importReplaceBtn = $("import-replace-btn");
const importCancelBtn = $("import-cancel-btn");

// Search + sort
const searchInput = $("search-input");
const sortModeBtn = $("sort-mode-btn");
const sortDirectionBtn = $("sort-direction-btn");

let prompts = [];
let searchQuery = "";
let activeTag = "all"; // "all" | "__pinned" | tên tag
let activeMode = "add";
let editingId = null;
let sortField = "newest";
let sortDirection = "desc";
let pendingImport = null; // dữ liệu đang chờ chọn Gộp / Thay thế

const samplePrompts = [
  {
    id: crypto.randomUUID(),
    title: "Product Launch Email",
    content:
      "Write a warm launch email for a new AI app, highlight the value, invite users to try the beta, and keep the tone energetic.",
    imageUrl: "",
    tags: ["Email"],
    pinned: false,
    copyCount: 0,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
  {
    id: crypto.randomUUID(),
    title: "Weekly Team Summary",
    content:
      "Summarize the team's progress in a concise executive style. Mention completed work, blockers, and next steps.",
    imageUrl: "",
    tags: ["Work"],
    pinned: false,
    copyCount: 0,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: crypto.randomUUID(),
    title: "Social Caption",
    content:
      "Create a polished Instagram caption for a design product launch. Make it short, punchy, and slightly premium.",
    imageUrl: "",
    tags: ["Caption"],
    pinned: false,
    copyCount: 0,
    createdAt: Date.now(),
  },
];

/* =========================================================
   DATA
   ========================================================= */

// Chuẩn hoá chuỗi tags: "anime,  Product BG ,anime" -> ["anime", "Product BG"]
function parseTags(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const seen = new Set();
  return list
    .map((tag) => String(tag).trim())
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// Đảm bảo prompt cũ (chưa có tags/pinned) vẫn chạy bình thường
function normalizePrompt(prompt) {
  return {
    ...prompt,
    id: prompt.id || crypto.randomUUID(),
    title: String(prompt.title || "Untitled"),
    content: String(prompt.content || ""),
    imageUrl: prompt.imageUrl || "",
    tags: parseTags(prompt.tags),
    pinned: Boolean(prompt.pinned),
    copyCount: Number.isFinite(Number(prompt.copyCount))
      ? Math.max(0, Number(prompt.copyCount))
      : 0,
    createdAt: Number.isFinite(Number(prompt.createdAt))
      ? Number(prompt.createdAt)
      : Date.now(),
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

// Danh sách tất cả tag kèm số lượng, sắp theo tên
function getAllTags() {
  const counts = new Map();
  prompts.forEach((prompt) =>
    prompt.tags.forEach((tag) => {
      const existing = [...counts.keys()].find(
        (key) => key.toLowerCase() === tag.toLowerCase(),
      );
      const key = existing || tag;
      counts.set(key, (counts.get(key) || 0) + 1);
    }),
  );
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/* =========================================================
   HELPERS
   ========================================================= */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cắt chuỗi TRƯỚC khi escape, để không cắt đôi "&amp;" làm hỏng SVG
function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function buildPreviewImage(title, content) {
  const safeTitle = escapeHtml(truncate(title || "Prompt", 36));
  const lines = String(content || "Write your next prompt here...")
    .split(/\n|\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
  // Dòng nội dung bắt đầu dưới title (y=184) để không đè chữ
  const lineMarkup = lines
    .map(
      (line, index) =>
        `<text x="40" y="${250 + index * 40}" fill="#f5f5f4" font-size="22" font-family="Segoe UI, Arial, sans-serif">${escapeHtml(truncate(line, 60))}</text>`,
    )
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
      <text x="40" y="468" fill="#e5e7eb" font-size="20" font-family="Segoe UI, Arial, sans-serif">Click to zoom • Local library</text>
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

// Tô màu nhẹ cho prompt: "Label:" đầu dòng, --param, {biến} / [biến]
function formatPromptContent(raw) {
  return escapeHtml(raw)
    .split("\n")
    .map((line) =>
      line
        .replace(
          /^(\s*)([A-Za-zÀ-ỹ0-9 _\-/()]{2,32}:)(?=\s|$)/,
          '$1<span class="pt-label">$2</span>',
        )
        .replace(
          /(^|\s)(--[a-z][\w-]*(?:\s+(?!--)[^\s]+)?)/gi,
          '$1<span class="pt-param">$2</span>',
        )
        .replace(
          /(\{[^{}]{1,40}\}|\[[^[\]]{1,40}\])/g,
          '<span class="pt-var">$1</span>',
        ),
    )
    .join("\n");
}

function needsExpandFor(content) {
  return content.length > 180 || content.split("\n").length > 4;
}

/* =========================================================
   RENDER
   ========================================================= */

function updateSortControls() {
  sortModeBtn.innerHTML =
    sortField === "newest"
      ? '<i class="fa-solid fa-clock-rotate-left"></i> Newest'
      : '<i class="fa-solid fa-copy"></i> Copied';

  sortDirectionBtn.innerHTML =
    sortDirection === "desc"
      ? '<i class="fa-solid fa-arrow-down-wide-short"></i> Desc'
      : '<i class="fa-solid fa-arrow-up-short-wide"></i> Asc';
}

function renderTagFilter() {
  const tags = getAllTags();
  const pinnedCount = prompts.filter((p) => p.pinned).length;

  // Tag đang chọn bị xoá hết thì quay về All
  if (
    activeTag !== "all" &&
    activeTag !== "__pinned" &&
    !tags.some(([tag]) => tag.toLowerCase() === activeTag.toLowerCase())
  ) {
    activeTag = "all";
  }
  if (activeTag === "__pinned" && pinnedCount === 0) activeTag = "all";

  const chip = (value, label, count) => `
    <button class="tag-chip ${activeTag.toLowerCase() === value.toLowerCase() ? "active" : ""}" data-filter-tag="${escapeHtml(value)}">
      ${label} <span class="count">${count}</span>
    </button>`;

  tagFilter.innerHTML = [
    chip("all", "All", prompts.length),
    pinnedCount
      ? chip(
          "__pinned",
          '<i class="fa-solid fa-star text-amber-400"></i> Pinned',
          pinnedCount,
        )
      : "",
    ...tags.map(([tag, count]) => chip(tag, `# ${escapeHtml(tag)}`, count)),
  ].join("");
}

function getVisiblePrompts() {
  return prompts
    .filter((p) => {
      if (activeTag === "__pinned") return p.pinned;
      if (activeTag !== "all") {
        return p.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase());
      }
      return true;
    })
    .filter(
      (p) =>
        p.title.toLowerCase().includes(searchQuery) ||
        p.content.toLowerCase().includes(searchQuery) ||
        p.tags.some((t) => t.toLowerCase().includes(searchQuery)),
    )
    .sort((a, b) => {
      // Prompt được ghim luôn nằm trên
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      const factor = sortDirection === "desc" ? 1 : -1;
      if (sortField === "newest") return factor * (b.createdAt - a.createdAt);
      return factor * (b.copyCount - a.copyCount);
    });
}

function renderCard(prompt) {
  const previewSrc = resolvePreviewSrc(prompt);
  const fallbackSrc = buildPreviewImage(prompt.title, prompt.content);
  const safeTitle = escapeHtml(prompt.title);
  const needsExpand = needsExpandFor(prompt.content);
  const tagMarkup = prompt.tags
    .map(
      (tag) =>
        `<button class="tag-chip sm" data-filter-tag="${escapeHtml(tag)}"># ${escapeHtml(tag)}</button>`,
    )
    .join("");

  return `
    <article class="neu-pressed p-4 flex flex-col h-full gap-3 ${prompt.pinned ? "card-pinned" : ""}">
      <div class="preview-frame rounded-2xl shrink-0" title="Click to enlarge">
        <img src="${previewSrc}" alt="Preview for ${safeTitle}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSrc}'" />
        <div class="zoom-badge"><i class="fa-solid fa-magnifying-glass-plus"></i> Click to enlarge</div>
      </div>

      <div class="flex-1 flex flex-col">
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-lg font-semibold text-white">${safeTitle}</h3>
          <button data-action="pin" data-id="${prompt.id}" class="pin-btn ${prompt.pinned ? "pinned" : ""} text-lg shrink-0" title="${prompt.pinned ? "Bỏ ghim" : "Ghim lên đầu"}">
            <i class="fa-${prompt.pinned ? "solid" : "regular"} fa-star"></i>
          </button>
        </div>

        ${tagMarkup ? `<div class="flex flex-wrap gap-1.5 mt-2">${tagMarkup}</div>` : ""}

        <div data-copy-count class="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <i class="fa-solid fa-copy"></i>
          <span>${prompt.copyCount} ${prompt.copyCount === 1 ? "copy" : "copies"}</span>
        </div>

        <div class="prompt-body mt-3 flex-1">
          <div class="prompt-text ${needsExpand ? "is-collapsed" : ""}">${formatPromptContent(prompt.content)}</div>
          ${needsExpand ? `<button data-action="toggle-expand" class="text-xs font-semibold text-gray-400 mt-2 hover:text-white transition">Show more <i class="fa-solid fa-chevron-down ml-1"></i></button>` : ""}
        </div>
      </div>

      <div class="flex gap-2 shrink-0 mt-2">
        <button data-action="copy" data-id="${prompt.id}" class="neu-btn flex-[2] px-3 py-2 text-sm text-emerald-400 font-bold">
          <i class="fa-solid fa-copy"></i> Copy
        </button>
        <button data-action="edit" data-id="${prompt.id}" class="neu-btn flex-1 px-3 py-2 text-sm text-gray-300" title="Edit">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button data-action="duplicate" data-id="${prompt.id}" class="neu-btn flex-1 px-3 py-2 text-sm text-sky-400" title="Nhân bản">
          <i class="fa-solid fa-clone"></i>
        </button>
        <button data-action="delete" data-id="${prompt.id}" class="neu-btn flex-1 px-3 py-2 text-sm text-red-400" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </article>
  `;
}

function renderPrompts() {
  updateSortControls();
  renderTagFilter();

  const visible = getVisiblePrompts();
  totalCount.textContent = prompts.length;

  if (!visible.length) {
    promptList.innerHTML = `
      <div class="neu-pressed p-6 text-center text-gray-400 md:col-span-2">
        <p class="text-lg font-semibold text-white">No prompts found</p>
        <p class="mt-2">Try a different search keyword or tag.</p>
      </div>
    `;
    statsBadge.textContent = "0 matches found";
    return;
  }

  statsBadge.textContent = `${visible.length} prompts showing`;
  promptList.innerHTML = visible.map(renderCard).join("");
}

/* =========================================================
   MODAL ADD / EDIT / DELETE
   ========================================================= */

// Chip gợi ý tag có sẵn trong form, bấm để thêm/bỏ
function renderTagSuggestions() {
  const current = parseTags(tagsInput.value).map((t) => t.toLowerCase());
  tagSuggestions.innerHTML = getAllTags()
    .map(
      ([tag]) =>
        `<button type="button" class="tag-chip sm ${current.includes(tag.toLowerCase()) ? "active" : ""}" data-suggest-tag="${escapeHtml(tag)}"># ${escapeHtml(tag)}</button>`,
    )
    .join("");
}

function resetForm() {
  titleInput.value = "";
  tagsInput.value = "";
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
      tagsInput.value = prompt.tags.join(", ");
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
      deleteTitle.textContent = prompt.title;
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
    // Đang lọc theo tag nào thì điền sẵn tag đó
    if (activeTag !== "all" && activeTag !== "__pinned") {
      tagsInput.value = activeTag;
    }
    previewImage.src = buildPreviewImage("", "");
  }

  renderTagSuggestions();
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  if (mode !== "delete") setTimeout(() => titleInput.focus(), 50);
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
  previewImage.src = buildPreviewImage(
    titleInput.value.trim(),
    contentInput.value.trim(),
  );
}

function handleSubmit(event) {
  event.preventDefault();

  if (activeMode === "delete") {
    prompts = prompts.filter((item) => item.id !== editingId);
    savePrompts();
    renderPrompts();
    closeModal();
    showToast("Đã xoá prompt");
    return;
  }

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const imageUrl = imageUrlInput.value.trim();
  const tags = parseTags(tagsInput.value);

  if (!title || !content) {
    formError.textContent = "Title and Prompt Content cannot be empty.";
    formError.classList.remove("hidden");
    return;
  }

  if (activeMode === "edit" && editingId) {
    prompts = prompts.map((item) =>
      item.id === editingId
        ? { ...item, title, content, imageUrl, tags }
        : item,
    );
  } else {
    prompts.unshift(
      normalizePrompt({
        title,
        content,
        imageUrl,
        tags,
        createdAt: Date.now(),
      }),
    );
  }

  savePrompts();
  renderPrompts();
  closeModal();
  showToast(activeMode === "edit" ? "Đã lưu thay đổi" : "Đã thêm prompt");
}

/* =========================================================
   CARD ACTIONS
   ========================================================= */

async function copyPromptContent(id, button) {
  const prompt = prompts.find((item) => item.id === id);
  if (!prompt) return;

  try {
    await navigator.clipboard.writeText(prompt.content);
    prompt.copyCount = (prompt.copyCount || 0) + 1;
    savePrompts();

    // Cập nhật tại chỗ trước, render lại sau — để còn thấy chữ "Copied"
    const countEl = button
      .closest("article")
      ?.querySelector("[data-copy-count] span");
    if (countEl) {
      countEl.textContent = `${prompt.copyCount} ${prompt.copyCount === 1 ? "copy" : "copies"}`;
    }
    button.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
    setTimeout(renderPrompts, 1200);
  } catch (error) {
    console.error("Copy failed", error);
    button.innerHTML =
      '<i class="fa-solid fa-triangle-exclamation"></i> Failed';
    setTimeout(() => {
      button.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
    }, 1200);
  }
}

function togglePin(id) {
  const prompt = prompts.find((item) => item.id === id);
  if (!prompt) return;
  prompt.pinned = !prompt.pinned;
  savePrompts();
  renderPrompts();
  showToast(prompt.pinned ? "Đã ghim lên đầu ⭐" : "Đã bỏ ghim");
}

// Nhân bản rồi mở luôn form Edit của bản copy
function duplicatePrompt(id) {
  const source = prompts.find((item) => item.id === id);
  if (!source) return;

  const copy = normalizePrompt({
    ...source,
    id: crypto.randomUUID(),
    title: `${source.title} (copy)`,
    pinned: false,
    copyCount: 0,
    createdAt: Date.now(),
  });

  const index = prompts.findIndex((item) => item.id === id);
  prompts.splice(index, 0, copy);
  savePrompts();
  renderPrompts();
  openModal("edit", copy.id);
  showToast("Đã nhân bản — sửa bản copy nhé");
}

/* =========================================================
   BACKUP: EXPORT / IMPORT (Gộp hoặc Thay thế)
   ========================================================= */

function exportBackup() {
  const blob = new Blob([JSON.stringify(prompts, null, 2)], {
    type: "application/json",
  });
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `prompt_backup_${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showToast(`Đã export ${prompts.length} prompts`);
}

function openImportModal() {
  importModal.classList.remove("hidden");
  importModal.classList.add("flex");
}

function closeImportModal() {
  importModal.classList.add("hidden");
  importModal.classList.remove("flex");
  pendingImport = null;
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) {
        showToast("File json không đúng định dạng bro ơi");
        return;
      }
      pendingImport = data.map(normalizePrompt);
      importSummary.textContent = `File có ${pendingImport.length} prompts. Thư viện hiện tại có ${prompts.length} prompts. M muốn làm gì?`;
      openImportModal();
    } catch (err) {
      showToast("Lỗi đọc file json rồi");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

// Gộp: bỏ qua prompt trùng id, hoặc trùng cả title + content
function mergeImport() {
  if (!pendingImport) return;
  const ids = new Set(prompts.map((p) => p.id));
  const signatures = new Set(
    prompts.map((p) => `${p.title.trim()}\n${p.content.trim()}`),
  );

  let added = 0;
  pendingImport.forEach((item) => {
    const signature = `${item.title.trim()}\n${item.content.trim()}`;
    if (ids.has(item.id) || signatures.has(signature)) return;
    prompts.push(item);
    ids.add(item.id);
    signatures.add(signature);
    added += 1;
  });

  const skipped = pendingImport.length - added;
  savePrompts();
  renderPrompts();
  closeImportModal();
  showToast(
    `Đã gộp ${added} prompts mới${skipped ? `, bỏ qua ${skipped} bản trùng` : ""}`,
  );
}

function replaceImport() {
  if (!pendingImport) return;
  const ok = confirm(
    `Thay thế sẽ xoá ${prompts.length} prompts hiện tại. Chắc chưa fen? (Nên Export backup trước)`,
  );
  if (!ok) return;
  prompts = pendingImport;
  savePrompts();
  renderPrompts();
  const count = prompts.length;
  closeImportModal();
  showToast(`Đã thay thế bằng ${count} prompts`);
}

/* =========================================================
   EVENTS
   ========================================================= */

searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderPrompts();
});

sortModeBtn.addEventListener("click", () => {
  sortField = sortField === "newest" ? "copied" : "newest";
  renderPrompts();
});

sortDirectionBtn.addEventListener("click", () => {
  sortDirection = sortDirection === "desc" ? "asc" : "desc";
  renderPrompts();
});

exportBtn.addEventListener("click", exportBackup);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importBackup);
importMergeBtn.addEventListener("click", mergeImport);
importReplaceBtn.addEventListener("click", replaceImport);
importCancelBtn.addEventListener("click", closeImportModal);
importModal.addEventListener("click", (e) => {
  if (e.target === importModal) closeImportModal();
});

addBtn.addEventListener("click", () => openModal("add"));
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);
promptForm.addEventListener("submit", handleSubmit);
titleInput.addEventListener("input", updatePreview);
contentInput.addEventListener("input", updatePreview);
imageUrlInput.addEventListener("input", updatePreview);
tagsInput.addEventListener("input", renderTagSuggestions);

// Bấm chip gợi ý trong form: có rồi thì bỏ, chưa có thì thêm
tagSuggestions.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-suggest-tag]");
  if (!chip) return;
  const tag = chip.dataset.suggestTag;
  const current = parseTags(tagsInput.value);
  const exists = current.some((t) => t.toLowerCase() === tag.toLowerCase());
  const next = exists
    ? current.filter((t) => t.toLowerCase() !== tag.toLowerCase())
    : [...current, tag];
  tagsInput.value = next.join(", ");
  renderTagSuggestions();
});

// Thanh lọc tag phía trên
tagFilter.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-filter-tag]");
  if (!chip) return;
  activeTag = chip.dataset.filterTag;
  renderPrompts();
});

lightbox.addEventListener("click", hideLightbox);

modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideLightbox();
    closeModal();
    closeImportModal();
    return;
  }

  // Phím "/" để nhảy vào ô search (trừ khi đang gõ trong ô khác)
  const typing = ["INPUT", "TEXTAREA"].includes(
    document.activeElement?.tagName,
  );
  if (event.key === "/" && !typing) {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});

promptList.addEventListener("click", (event) => {
  const frame = event.target.closest(".preview-frame");
  if (frame) {
    const img = frame.querySelector("img");
    if (img) showLightbox(img.src);
    return;
  }

  // Bấm tag trên card -> lọc theo tag đó
  const tagChip = event.target.closest("[data-filter-tag]");
  if (tagChip) {
    activeTag = tagChip.dataset.filterTag;
    renderPrompts();
    window.scrollTo({ top: tagFilter.offsetTop - 16, behavior: "smooth" });
    return;
  }

  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;

  if (action === "edit") openModal("edit", id);
  else if (action === "delete") openModal("delete", id);
  else if (action === "copy") copyPromptContent(id, button);
  else if (action === "pin") togglePin(id);
  else if (action === "duplicate") duplicatePrompt(id);
  else if (action === "toggle-expand") {
    // Show more: mở rộng có giới hạn chiều cao, cuộn bên trong ô
    const box = button.closest(".prompt-body").querySelector(".prompt-text");
    const expanding = box.classList.contains("is-collapsed");
    box.classList.toggle("is-collapsed", !expanding);
    box.classList.toggle("is-expanded", expanding);
    button.innerHTML = expanding
      ? 'Show less <i class="fa-solid fa-chevron-up ml-1"></i>'
      : 'Show more <i class="fa-solid fa-chevron-down ml-1"></i>';

    if (!expanding) {
      box.scrollTop = 0;
      button
        .closest("article")
        .scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
});

loadPrompts();
renderPrompts();
