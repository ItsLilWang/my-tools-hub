// =========================================
// Idea Bank — save source links + quick memos,
// then copy them in one click to send to Claude.
// =========================================

const STORAGE_KEY = "idea-bank-v1";

let ideas = loadIdeas();
let filter = "active"; // active | used | all

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const counterEl = document.getElementById("counter");
const copyLabelEl = document.getElementById("copyLabel");
const toastEl = document.getElementById("toast");

// ---------- Storage ----------
function loadIdeas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.map(normalizeIdea) : [];
  } catch {
    return [];
  }
}

function saveIdeas() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ideas));
  } catch {
    showToast("Could not save (storage blocked)");
  }
}

function normalizeIdea(idea) {
  return {
    id: idea.id || makeId(),
    links: Array.isArray(idea.links) && idea.links.length ? idea.links.map(String) : [""],
    memo: String(idea.memo || ""),
    used: Boolean(idea.used),
    selected: Boolean(idea.selected),
    createdAt: idea.createdAt || Date.now(),
  };
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Helpers ----------
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Pick an icon based on where the link comes from
function sourceIcon(url) {
  const u = url.toLowerCase();
  if (u.includes("x.com") || u.includes("twitter.com")) return "fa-brands fa-twitter";
  if (u.includes("reddit.com") || u.includes("redd.it")) return "fa-brands fa-reddit-alien";
  if (u.includes("tiktok.com")) return "fa-brands fa-tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "fa-brands fa-youtube";
  if (u.includes("facebook.com") || u.includes("fb.watch")) return "fa-brands fa-facebook";
  if (u.includes("instagram.com")) return "fa-brands fa-instagram";
  return "fa-solid fa-link";
}

function isUrl(text) {
  return /^https?:\/\//i.test(text.trim());
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

function findIdea(id) {
  return ideas.find((i) => i.id === id);
}

function visibleIdeas() {
  const sorted = [...ideas].sort((a, b) => b.createdAt - a.createdAt);
  if (filter === "active") return sorted.filter((i) => !i.used);
  if (filter === "used") return sorted.filter((i) => i.used);
  return sorted;
}

// Ideas that the Copy button will send:
// selected ones if any are ticked, otherwise every active idea
function ideasToCopy() {
  const active = ideas.filter((i) => !i.used);
  const selected = active.filter((i) => i.selected);
  return selected.length ? selected : active;
}

// ---------- Render ----------
function render() {
  const items = visibleIdeas();
  listEl.innerHTML = items.map(renderCard).join("");

  emptyEl.classList.toggle("hidden", items.length > 0);
  emptyEl.classList.toggle("flex", items.length === 0);

  updateCounters();
}

function updateCounters() {
  const active = ideas.filter((i) => !i.used).length;
  const used = ideas.length - active;
  counterEl.textContent = `${active} active · ${used} used`;

  const selected = ideas.filter((i) => !i.used && i.selected).length;
  copyLabelEl.textContent = selected ? `Copy selected (${selected})` : "Copy for Claude";
}

function renderCard(idea) {
  const index = [...ideas].sort((a, b) => a.createdAt - b.createdAt).indexOf(idea) + 1;

  const linksHtml = idea.links
    .map(
      (link, li) => `
      <div class="flex items-center gap-2">
        <span class="w-8 h-8 flex items-center justify-center text-gray-500 shrink-0">
          <i class="${sourceIcon(link)}" data-icon="${li}"></i>
        </span>
        <input class="field" type="url" placeholder="Paste source link (X, Reddit, TikTok...)"
          value="${escapeHtml(link)}" data-action="link" data-index="${li}" />
        <a href="${isUrl(link) ? escapeHtml(link) : "#"}" target="_blank" rel="noopener" data-open="${li}"
          class="neu-btn w-9 h-9 flex items-center justify-center text-gray-500 shrink-0 ${isUrl(link) ? "" : "hidden"}" title="Open link">
          <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i></a>
        ${
          idea.links.length > 1
            ? `<button class="neu-btn w-9 h-9 flex items-center justify-center text-gray-500 shrink-0" data-action="remove-link" data-index="${li}" title="Remove link">
                 <i class="fa-solid fa-xmark text-xs"></i></button>`
            : ""
        }
      </div>`
    )
    .join("");

  return `
    <div class="neu-flat p-4 sm:p-5 flex flex-col gap-3 ${idea.used ? "card-used" : ""} ${idea.selected && !idea.used ? "card-selected" : ""}" data-id="${idea.id}">
      <div class="flex items-center gap-3">
        ${
          idea.used
            ? ""
            : `<button class="neu-btn w-8 h-8 flex items-center justify-center ${idea.selected ? "text-red-500 neu-active" : "text-gray-600"}" data-action="select" title="Select for copy">
                 <i class="fa-solid fa-check text-xs"></i></button>`
        }
        <h2 class="font-bold text-white uppercase tracking-wider text-sm">Idea ${index}</h2>
        <span class="text-xs text-gray-500">${formatDate(idea.createdAt)}</span>
        <div class="flex gap-2 ml-auto">
          <button class="neu-btn w-8 h-8 flex items-center justify-center text-gray-500" data-action="toggle-used"
            title="${idea.used ? "Move back to active" : "Mark as used"}">
            <i class="fa-solid ${idea.used ? "fa-rotate-left" : "fa-box-archive"} text-xs"></i>
          </button>
          <button class="neu-btn w-8 h-8 flex items-center justify-center text-gray-500" data-action="delete" title="Delete idea">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">${linksHtml}</div>

      <button class="self-start text-xs font-bold text-gray-500 hover:text-red-500 flex items-center gap-2 px-1" data-action="add-link">
        <i class="fa-solid fa-plus"></i> Add link
      </button>

      <textarea class="field" placeholder="Quick memo: the situation, which character fits, why it's funny..."
        data-action="memo">${escapeHtml(idea.memo)}</textarea>
    </div>`;
}

// ---------- Actions ----------
function addIdea() {
  ideas.push(normalizeIdea({}));
  saveIdeas();
  if (filter === "used") setFilter("active");
  else render();
  // Focus the first link field of the new idea
  const first = listEl.querySelector('[data-action="link"]');
  if (first) first.focus();
}

function setFilter(value) {
  filter = value;
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === value);
  });
  render();
}

function buildCopyText(list) {
  const lines = [
    "Tokenly Inc. — idea bank",
    "Combine these or pick the best one as the idea for an episode.",
    "",
  ];
  list
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((idea, i) => {
      lines.push(`### Idea ${i + 1}`);
      const links = idea.links.map((l) => l.trim()).filter(Boolean);
      if (links.length) links.forEach((l) => lines.push(`- Link: ${l}`));
      else lines.push("- Link: (none)");
      lines.push(`- Memo: ${idea.memo.trim() || "(empty)"}`);
      lines.push("");
    });
  return lines.join("\n").trim();
}

async function copyIdeas() {
  const list = ideasToCopy().filter((i) => i.memo.trim() || i.links.some((l) => l.trim()));
  if (!list.length) {
    showToast("Nothing to copy yet");
    return;
  }
  const text = buildCopyText(list);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers that block the clipboard API
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  showToast(`Copied ${list.length} idea${list.length > 1 ? "s" : ""}`);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(ideas, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `idea-bank-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error();
      const existing = new Set(ideas.map((i) => i.id));
      let added = 0;
      data.forEach((item) => {
        const idea = normalizeIdea(item);
        if (!existing.has(idea.id)) {
          ideas.push(idea);
          added++;
        }
      });
      saveIdeas();
      render();
      showToast(`Imported ${added} idea${added === 1 ? "" : "s"}`);
    } catch {
      showToast("Invalid JSON file");
    }
  };
  reader.readAsText(file);
}

// ---------- Events ----------
document.getElementById("addBtn").addEventListener("click", addIdea);
document.getElementById("copyBtn").addEventListener("click", copyIdeas);
document.getElementById("exportBtn").addEventListener("click", exportJson);
document.getElementById("importInput").addEventListener("change", (e) => {
  if (e.target.files[0]) importJson(e.target.files[0]);
  e.target.value = "";
});
document.querySelectorAll("[data-filter]").forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

// Typing: update data + save, no full re-render (keeps cursor in place)
listEl.addEventListener("input", (e) => {
  const card = e.target.closest("[data-id]");
  if (!card) return;
  const idea = findIdea(card.dataset.id);
  const action = e.target.dataset.action;

  if (action === "memo") idea.memo = e.target.value;
  if (action === "link") {
    const li = Number(e.target.dataset.index);
    idea.links[li] = e.target.value;
    const icon = card.querySelector(`[data-icon="${li}"]`);
    if (icon) icon.className = sourceIcon(e.target.value);
    const open = card.querySelector(`[data-open="${li}"]`);
    if (open) {
      const ok = isUrl(e.target.value);
      open.classList.toggle("hidden", !ok);
      open.href = ok ? e.target.value.trim() : "#";
    }
  }
  saveIdeas();
});

// Buttons inside cards
listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const card = btn.closest("[data-id]");
  const idea = findIdea(card.dataset.id);

  switch (btn.dataset.action) {
    case "add-link":
      idea.links.push("");
      saveIdeas();
      render();
      {
        const fields = listEl.querySelectorAll(`[data-id="${idea.id}"] [data-action="link"]`);
        fields[fields.length - 1]?.focus();
      }
      return;
    case "remove-link":
      idea.links.splice(Number(btn.dataset.index), 1);
      break;
    case "select":
      idea.selected = !idea.selected;
      break;
    case "toggle-used":
      idea.used = !idea.used;
      idea.selected = false;
      showToast(idea.used ? "Moved to Used" : "Back to Active");
      break;
    case "delete":
      if (!confirm("Delete this idea?")) return;
      ideas = ideas.filter((i) => i.id !== idea.id);
      break;
  }
  saveIdeas();
  render();
});

render();
