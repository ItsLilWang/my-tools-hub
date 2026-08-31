const jsonInput = document.getElementById("json-input");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const processBtn = document.getElementById("process-btn");
const exportBtn = document.getElementById("export-btn");
const clearBtn = document.getElementById("clear-btn");
const sceneList = document.getElementById("scene-list");
const sceneCount = document.getElementById("scene-count");
const jsonOutput = document.getElementById("json-output");

// Step 2 elements
const timingInput = document.getElementById("timing-input");
const timingFileInput = document.getElementById("timing-file-input");
const timingUploadBtn = document.getElementById("timing-upload-btn");
const mergeBtn = document.getElementById("merge-btn");
const mergeExportBtn = document.getElementById("merge-export-btn");
const mergeCount = document.getElementById("merge-count");
const sceneTotalCount = document.getElementById("scene-total-count");
const finalList = document.getElementById("final-list");
const finalOutput = document.getElementById("final-output");

let convertedScenes = []; // [{scene, fileName, content, motion}]
let finalTimeline = []; // [{image, duration, effect}]

// ============================================================
// STEP 1: Rút gọn JSON gốc (frames) -> {scene, fileName, content, motion}
// ============================================================

// Trích xuất tên file sạch từ blob url
function cleanFileName(blobUrl) {
  if (!blobUrl) return "unknown.jpg";
  // Xóa phần "blob:null/" hoặc bất kỳ prefix blob url nào nếu có, chỉ lấy GUID
  const cleanStr = blobUrl.replace(/^blob:[^/]+\//, "");
  return `${cleanStr}.jpg`;
}

// Xử lý chuyển đổi cấu trúc dữ liệu
function convertJson(sourceData) {
  let frames = [];

  // Thích ứng linh hoạt nếu JSON truyền vào trực tiếp là mảng hoặc object chứa thuộc tính frames
  if (Array.isArray(sourceData)) {
    frames = sourceData;
  } else if (sourceData && Array.isArray(sourceData.frames)) {
    frames = sourceData.frames;
  } else {
    alert("Invalid JSON format. Couldn't find valid frames list.");
    return [];
  }

  // Map sang định dạng mới rút gọn, đánh số tự động từ 1 trở đi
  return frames.map((frame, index) => {
    // Lấy trực tiếp từ imageUrl, nếu không có thì để chuỗi rỗng
    const imgBlob = frame.imageUrl || "";

    return {
      scene: index + 1,
      fileName: cleanFileName(imgBlob),
      content: frame.visualDescription || "",
      // motion giữ lại để bước 2 chọn effect camera move, không cần đoán ngữ nghĩa lại
      motion: frame.motionDescription || "",
    };
  });
}

// Render hiển thị lên giao diện HTML
function renderScenes() {
  sceneList.innerHTML = "";
  sceneCount.textContent = convertedScenes.length;
  sceneTotalCount.textContent = convertedScenes.length;
  jsonOutput.textContent = JSON.stringify(convertedScenes, null, 2);

  if (convertedScenes.length === 0) {
    sceneList.innerHTML = `<div class="text-sm text-gray-500 italic p-2">No converted data template available.</div>`;
    return;
  }

  convertedScenes.forEach((item) => {
    const card = document.createElement("div");
    card.className =
      "neu-btn p-3 rounded-xl flex flex-col gap-1 text-left text-xs text-gray-300 pointer-events-none";
    card.innerHTML = `
      <div class="flex justify-between items-center border-b border-zinc-800 pb-1 mb-1">
        <span class="font-bold text-red-500">Scene #${item.scene}</span>
        <span class="text-zinc-500 font-mono">${item.fileName}</span>
      </div>
      <div class="text-gray-400 whitespace-pre-wrap break-words">${item.content || '<span class="italic text-zinc-600">No description</span>'}</div>
    `;
    sceneList.appendChild(card);
  });
}

// Trigger phân tích dữ liệu đầu vào
function processData() {
  const rawText = jsonInput.value.trim();
  if (!rawText) {
    alert("Please paste JSON context or select file first.");
    return;
  }

  try {
    const parsed = JSON.parse(rawText);
    convertedScenes = convertJson(parsed);
    renderScenes();
  } catch (err) {
    alert("JSON Syntax Error. Please check your text script format.");
    console.error(err);
  }
}

// Tải file trực tiếp và xử lý ngầm (chống lag cho file to)
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Hiển thị trạng thái đang xử lý
  const originalText = processBtn.innerHTML;
  processBtn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      // Parse JSON ngầm trong RAM, KHÔNG in cục text 38MB ra textarea nữa
      const parsed = JSON.parse(evt.target.result);
      convertedScenes = convertJson(parsed);
      renderScenes();

      // Báo thành công gọn gàng
      jsonInput.value = `[File Loaded]: ${file.name}\n[Size]: ${(file.size / 1024 / 1024).toFixed(2)} MB\n=> Xử lý thành công! Bấm Export để tải về.`;
    } catch (err) {
      alert("Lỗi cấu trúc JSON trong file.");
      console.error(err);
    } finally {
      processBtn.innerHTML = originalText; // Trả lại nút cũ
    }
  };
  reader.readAsText(file);
}

// Download file JSON output (bước 1 - rút gọn)
function downloadJson() {
  if (convertedScenes.length === 0) {
    alert("No data available to export.");
    return;
  }
  const jsonString = JSON.stringify(convertedScenes, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "converted-scenes.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Clear sạch form
function clearAll() {
  jsonInput.value = "";
  fileInput.value = "";
  convertedScenes = [];
  renderScenes();
}

// ============================================================
// STEP 2: Merge rút gọn scenes + timing file (AI-generated) -> CapCut final
// ============================================================

// Parse timestamp "HH:MM:SS,mmm" -> giây (số thực)
function srtTimeToSeconds(t) {
  if (!t || typeof t !== "string") return null;
  const match = t.match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!match) return null;
  const [, h, m, s, ms] = match;
  return (
    parseInt(h, 10) * 3600 +
    parseInt(m, 10) * 60 +
    parseInt(s, 10) +
    parseInt(ms.padEnd(3, "0"), 10) / 1000
  );
}

// Rule-based chọn effect từ motionDescription, KHÔNG cần AI đoán lại
function pickEffect(motionText) {
  const t = (motionText || "").toLowerCase();

  if (t.includes("whip") || t.includes("quick whip") || t.includes("sudden")) {
    return "whip_pan";
  }
  if (t.includes("handheld") || t.includes("shake") || t.includes("jarring")) {
    return "quick_punch";
  }
  if (
    t.includes("push-in") ||
    t.includes("push in") ||
    t.includes("dolly in") ||
    t.includes("zoom in")
  ) {
    return "slow_zoom_in";
  }
  if (
    t.includes("pull-back") ||
    t.includes("pull back") ||
    t.includes("dolly out") ||
    t.includes("zoom out")
  ) {
    return "slow_zoom_out";
  }
  if (t.includes("pan") && t.includes("left")) {
    return "pan_left_right";
  }
  if (t.includes("pan") && t.includes("right")) {
    return "pan_right_left";
  }
  if (
    t.includes("tilt") ||
    t.includes("top") ||
    t.includes("bottom") ||
    t.includes("up") ||
    t.includes("down")
  ) {
    return "pan_top_bottom";
  }
  // Fallback an toàn khi không khớp từ khoá nào (static/establishing)
  return "slow_zoom_in";
}

// Merge chính: ghép theo THỨ TỰ VỊ TRÍ (index-based), không suy luận ngữ nghĩa
function mergeWithTiming(timingData) {
  if (convertedScenes.length === 0) {
    alert("Chưa có Converted Scene List. Hãy Parse & Convert ở Bước 1 trước.");
    return [];
  }

  let timingArr = [];
  if (Array.isArray(timingData)) {
    timingArr = timingData;
  } else if (timingData && Array.isArray(timingData.frames)) {
    timingArr = timingData.frames;
  } else {
    alert(
      "Invalid timing JSON format. Cần một mảng object có srtStart/srtEnd.",
    );
    return [];
  }

  if (timingArr.length !== convertedScenes.length) {
    alert(
      `Cảnh báo: số lượng lệch nhau — Scene List có ${convertedScenes.length} phần tử, Timing File có ${timingArr.length} phần tử.\n` +
        `Vẫn merge theo số lượng nhỏ hơn, kiểm tra lại 2 file trước khi export.`,
    );
  }

  const n = Math.min(convertedScenes.length, timingArr.length);
  const rawDurations = [];
  const partial = [];

  for (let i = 0; i < n; i++) {
    const scene = convertedScenes[i];
    const timing = timingArr[i];

    const start = srtTimeToSeconds(timing.srtStart);
    const end = srtTimeToSeconds(timing.srtEnd);

    let dur = 0;
    if (start !== null && end !== null && end > start) {
      dur = end - start;
    } else {
      console.warn(
        `Timing không hợp lệ tại vị trí ${i + 1} (srtStart/srtEnd), gán tạm 2s.`,
      );
      dur = 2;
    }

    rawDurations.push(dur);
    partial.push({
      image: scene.fileName,
      effect: pickEffect(scene.motion),
    });
  }

  // Làm tròn 2 chữ số thập phân, rồi bù lệch cộng dồn vào phần tử cuối
  const roundedDurations = rawDurations.map((d) => Math.round(d * 100) / 100);
  const totalRaw = rawDurations.reduce((a, b) => a + b, 0);
  const totalRounded = roundedDurations.reduce((a, b) => a + b, 0);
  const diff = Math.round((totalRaw - totalRounded) * 100) / 100;

  if (diff !== 0 && roundedDurations.length > 0) {
    const lastIdx = roundedDurations.length - 1;
    roundedDurations[lastIdx] =
      Math.round((roundedDurations[lastIdx] + diff) * 100) / 100;
  }

  return partial.map((item, idx) => ({
    image: item.image,
    duration: `${roundedDurations[idx]}s`,
    effect: item.effect,
  }));
}

// Render Step 2 kết quả
function renderFinal() {
  finalList.innerHTML = "";
  mergeCount.textContent = finalTimeline.length;
  finalOutput.textContent = JSON.stringify(finalTimeline, null, 2);

  if (finalTimeline.length === 0) {
    finalList.innerHTML = `<div class="text-sm text-gray-500 italic p-2">Chưa có kết quả merge.</div>`;
    return;
  }

  finalTimeline.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className =
      "neu-btn p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs text-gray-300 pointer-events-none";
    card.innerHTML = `
      <span class="text-zinc-500 font-mono truncate max-w-[45%]">#${idx + 1} ${item.image}</span>
      <span class="text-red-500 font-bold">${item.duration}</span>
      <span class="text-white uppercase tracking-wide">${item.effect}</span>
    `;
    finalList.appendChild(card);
  });
}

// Trigger merge từ ô paste
function handleMerge() {
  const rawText = timingInput.value.trim();
  if (!rawText) {
    alert("Please paste Timing JSON or select file first.");
    return;
  }

  try {
    const parsed = JSON.parse(rawText);
    finalTimeline = mergeWithTiming(parsed);
    renderFinal();
  } catch (err) {
    alert("JSON Syntax Error trong Timing File. Kiểm tra lại format.");
    console.error(err);
  }
}

// Upload timing file trực tiếp
function handleTimingFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const originalText = mergeBtn.innerHTML;
  mergeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Merging...';

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      finalTimeline = mergeWithTiming(parsed);
      renderFinal();
      timingInput.value = `[File Loaded]: ${file.name}\n=> Merge thành công! Bấm Export Final JSON để tải về.`;
    } catch (err) {
      alert("Lỗi cấu trúc JSON trong Timing File.");
      console.error(err);
    } finally {
      mergeBtn.innerHTML = originalText;
    }
  };
  reader.readAsText(file);
}

// Export file cuối cùng cho CapCut
function downloadFinalJson() {
  if (finalTimeline.length === 0) {
    alert("Chưa có dữ liệu để export. Hãy Merge & Generate trước.");
    return;
  }
  const jsonString = JSON.stringify(finalTimeline, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "capcut-final.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Khởi chạy sự kiện cấu hình
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);
processBtn.addEventListener("click", processData);
exportBtn.addEventListener("click", downloadJson);
clearBtn.addEventListener("click", clearAll);

timingUploadBtn.addEventListener("click", () => timingFileInput.click());
timingFileInput.addEventListener("change", handleTimingFileSelect);
mergeBtn.addEventListener("click", handleMerge);
mergeExportBtn.addEventListener("click", downloadFinalJson);

// Render trống ban đầu
renderScenes();
renderFinal();
