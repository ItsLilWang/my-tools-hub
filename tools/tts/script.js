// =========================================
// Text to Speech (Edge Voice) - Tool Logic
// =========================================
// Kỹ thuật: giả lập request mà Microsoft Edge "Read Aloud" gửi tới
// server TTS nội bộ của họ, dùng WebSocket trực tiếp từ trình duyệt.
// Đây là API không chính thức (reverse-engineered), Microsoft có thể
// thay đổi bất cứ lúc nào mà không báo trước.

// --- DOM References ---
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const inputText = document.getElementById("input-text");
const wordCount = document.getElementById("word-count");
const voiceSelect = document.getElementById("voice-select");
const convertBtn = document.getElementById("convert-btn");
const progressSection = document.getElementById("progress-section");
const progressStatus = document.getElementById("progress-status");
const progressPercent = document.getElementById("progress-percent");
const progressBar = document.getElementById("progress-bar");
const logConsole = document.getElementById("log-console");
const downloadArea = document.getElementById("download-area");
const downloadLink = document.getElementById("download-link");

// --- Constants (reverse-engineered từ Edge Read Aloud) ---
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_ENDPOINT =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/reading/edge/v1";

// --- State ---
let isConverting = false;

// =========================================
// UI Helpers
// =========================================

function updateWordCount() {
  const words = inputText.value.trim().split(/\s+/).filter(Boolean);
  wordCount.textContent = `${words.length} từ`;
}

function log(message) {
  logConsole.classList.remove("hidden");
  logConsole.classList.add("flex");
  const line = document.createElement("div");
  line.textContent = message;
  logConsole.appendChild(line);
  logConsole.scrollTop = logConsole.scrollHeight;
}

function resetLog() {
  logConsole.innerHTML = "";
}

function setProgress(percent, statusText) {
  progressSection.classList.remove("hidden");
  progressSection.classList.add("flex");
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent.toFixed(0)}%`;
  if (statusText) progressStatus.textContent = statusText;
}

function setConvertingState(active) {
  isConverting = active;
  convertBtn.disabled = active;
  convertBtn.classList.toggle("opacity-50", active);
  convertBtn.classList.toggle("cursor-not-allowed", active);
}

// =========================================
// File Drop Handling
// =========================================

function readTxtFile(file) {
  if (!file.name.toLowerCase().endsWith(".txt")) {
    log("❌ Chỉ nhận file .txt thôi fen ơi");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    inputText.value = e.target.result;
    updateWordCount();
    log(`📄 Đã nạp file: ${file.name}`);
  };
  reader.onerror = () => {
    log("❌ Không đọc được file, thử lại xem");
  };
  reader.readAsText(file, "utf-8");
}

dropZone.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    readTxtFile(e.target.files[0]);
  }
});

["dragover", "dragenter"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add("neu-active");
  });
});

["dragleave", "dragend"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove("neu-active");
  });
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("neu-active");
  if (e.dataTransfer.files.length > 0) {
    readTxtFile(e.dataTransfer.files[0]);
  }
});

inputText.addEventListener("input", updateWordCount);

// =========================================
// Security Token (Sec-MS-GEC)
// =========================================
// Công thức: SHA256( floor(windows_ticks) + TRUSTED_CLIENT_TOKEN )
// windows_ticks = (unix_time + WIN_EPOCH) làm tròn xuống mốc 5 phút,
// rồi đổi sang đơn vị 100-nanosecond.
// Dùng phép toán float thường (không BigInt) để khớp cách Microsoft
// tự tính phía client gốc.

async function sha256Hex(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function generateSecMsGec() {
  const WIN_EPOCH = 11644473600; // giây từ 1601-01-01 tới 1970-01-01
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300; // làm tròn xuống mốc 5 phút gần nhất
  ticks *= 10000000; // đổi sang đơn vị 100-nanosecond
  const strToHash = Math.round(ticks).toString() + TRUSTED_CLIENT_TOKEN;
  return await sha256Hex(strToHash);
}

function generateId() {
  return crypto.randomUUID().replace(/-/g, "");
}

// =========================================
// SSML / Message Builders
// =========================================

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildConfigMessage() {
  const timestamp = new Date().toISOString();
  const payload = {
    context: {
      synthesis: {
        audio: {
          metadataoptions: {
            sentenceBoundaryEnabled: false,
            wordBoundaryEnabled: true,
          },
          outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        },
      },
    },
  };
  return (
    `X-Timestamp:${timestamp}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    JSON.stringify(payload)
  );
}

function buildSSMLMessage(requestId, text, voice) {
  const timestamp = new Date().toISOString();
  const escaped = escapeXml(text);
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
    `<voice name='${voice}'>` +
    `<prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escaped}</prosody>` +
    `</voice></speak>`;
  return (
    `X-RequestId:${requestId}\r\n` +
    `X-Timestamp:${timestamp}\r\n` +
    `Content-Type:application/ssml+xml\r\n` +
    `Path:ssml\r\n\r\n` +
    ssml
  );
}

// =========================================
// WebSocket TTS Conversion
// =========================================

function convertToSpeech(text, voice) {
  return new Promise(async (resolve, reject) => {
    const audioChunks = [];
    let totalBytes = 0;
    let wordsProcessed = 0;
    const totalWords = text.trim().split(/\s+/).filter(Boolean).length || 1;

    let secMsGec;
    try {
      secMsGec = await generateSecMsGec();
    } catch (err) {
      reject(new Error("Không tính được security token: " + err.message));
      return;
    }

    const connectionId = generateId();
    const requestId = generateId();
    const url = `${WSS_ENDPOINT}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${connectionId}`;

    log("🔌 Đang kết nối tới server Edge TTS...");
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    // Timeout an toàn: nếu quá 20s không thấy audio đầu tiên -> báo lỗi
    let firstAudioReceived = false;
    const connectTimeout = setTimeout(() => {
      if (!firstAudioReceived) {
        ws.close();
        reject(
          new Error(
            "Kết nối treo quá lâu, có thể bị mạng/firewall chặn, hoặc token bị Microsoft đổi công thức."
          )
        );
      }
    }, 20000);

    ws.onopen = () => {
      log("✅ Đã kết nối, đang gửi text...");
      ws.send(buildConfigMessage());
      ws.send(buildSSMLMessage(requestId, text, voice));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        handleTextMessage(event.data);
      } else {
        handleBinaryMessage(event.data);
      }
    };

    ws.onerror = () => {
      clearTimeout(connectTimeout);
      reject(
        new Error(
          "Lỗi kết nối WebSocket. Có thể Microsoft đã thay đổi API, hoặc mạng chặn."
        )
      );
    };

    ws.onclose = () => {
      clearTimeout(connectTimeout);
    };

    function handleBinaryMessage(buffer) {
      firstAudioReceived = true;
      const view = new DataView(buffer);
      const headerLength = view.getUint16(0, false); // big-endian
      const headerBytes = new Uint8Array(buffer, 2, headerLength);
      const header = new TextDecoder("utf-8").decode(headerBytes);

      if (header.includes("Path:audio")) {
        const audioData = buffer.slice(2 + headerLength);
        audioChunks.push(audioData);
        totalBytes += audioData.byteLength;

        const kb = (totalBytes / 1024).toFixed(0);
        const percent = Math.min(95, (wordsProcessed / totalWords) * 100);
        setProgress(percent, `Đang nhận audio... (${kb} KB)`);
      }
    }

    function handleTextMessage(text) {
      if (text.includes("Path:turn.end")) {
        clearTimeout(connectTimeout);
        ws.close();

        if (audioChunks.length === 0) {
          reject(new Error("Không nhận được audio nào. Thử lại xem."));
          return;
        }

        const blob = new Blob(audioChunks, { type: "audio/mpeg" });
        resolve(blob);
      } else if (text.includes("Path:audio.metadata")) {
        const bodyStart = text.indexOf("\r\n\r\n") + 4;
        const body = text.slice(bodyStart);
        try {
          const meta = JSON.parse(body);
          (meta.Metadata || []).forEach((item) => {
            if (item.Type === "WordBoundary") {
              wordsProcessed++;
            }
          });
        } catch (e) {
          // bỏ qua nếu parse lỗi, không critical
        }
      } else if (text.includes("Path:turn.start")) {
        log("🎙️ Server bắt đầu đọc...");
      }
    }
  });
}

// =========================================
// Main Convert Handler
// =========================================

convertBtn.addEventListener("click", async () => {
  if (isConverting) return;

  const text = inputText.value.trim();
  if (!text) {
    log("❌ Chưa có text nào để đọc");
    return;
  }

  const voice = voiceSelect.value;

  resetLog();
  downloadArea.classList.add("hidden");
  downloadArea.classList.remove("flex");
  setConvertingState(true);
  setProgress(0, "Bắt đầu...");

  try {
    const blob = await convertToSpeech(text, voice);
    setProgress(100, "Hoàn tất!");
    log(`✅ Xong! Dung lượng file: ${(blob.size / 1024).toFixed(0)} KB`);

    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = `speech-${Date.now()}.mp3`;
    downloadArea.classList.remove("hidden");
    downloadArea.classList.add("flex");
  } catch (err) {
    log(`❌ Lỗi: ${err.message}`);
    setProgress(0, "Thất bại");
  } finally {
    setConvertingState(false);
  }
});

// Initialize
updateWordCount();
