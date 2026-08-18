const jsonInput = document.getElementById("json-input");
const fileInput = document.getElementById("file-input");
const uploadBtn = document.getElementById("upload-btn");
const processBtn = document.getElementById("process-btn");
const exportBtn = document.getElementById("export-btn");
const clearBtn = document.getElementById("clear-btn");
const sceneList = document.getElementById("scene-list");
const sceneCount = document.getElementById("scene-count");
const jsonOutput = document.getElementById("json-output");

let convertedScenes = [];

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
    const firstImgBlob =
      frame.imageHistory && frame.imageHistory.length > 0
        ? frame.imageHistory[0]
        : "";
    return {
      scene: index + 1,
      fileName: cleanFileName(firstImgBlob),
      content: frame.visualDescription || "",
    };
  });
}

// Render hiển thị lên giao diện HTML
function renderScenes() {
  sceneList.innerHTML = "";
  sceneCount.textContent = convertedScenes.length;
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

// Download file JSON output
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

// Khởi chạy sự kiện cấu hình
uploadBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelect);
processBtn.addEventListener("click", processData);
exportBtn.addEventListener("click", downloadJson);
clearBtn.addEventListener("click", clearAll);

// Render trống ban đầu
renderScenes();
