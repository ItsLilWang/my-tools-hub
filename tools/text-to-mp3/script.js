const VOICE = "en-US-AvaMultilingualNeural";
const MAX_CHUNK_SIZE = 200;
const textInput = document.getElementById("text-input");
const txtFileInput = document.getElementById("txt-file");
const previewBtn = document.getElementById("preview-btn");
const downloadBtn = document.getElementById("download-btn");
const statusLog = document.getElementById("status-log");
const charCount = document.getElementById("char-count");

function updateCharCount() {
  const length = textInput.value.length;
  charCount.textContent = `${length} chars`;
}

function logStatus(message, append = true) {
  if (!append) {
    statusLog.textContent = message;
    return;
  }
  statusLog.textContent += `${message}\n`;
  statusLog.scrollTop = statusLog.scrollHeight;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

function clearStatus() {
  logStatus("Ready to convert text to MP3.\n", false);
}

function readTxtFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    textInput.value = reader.result;
    updateCharCount();
    clearStatus();
    logStatus(`Loaded file: ${file.name}`);
  };
  reader.onerror = () => {
    logStatus("Failed to read the selected file.");
  };
  reader.readAsText(file, "utf-8");
}

function splitText(text) {
  const parts = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_SIZE) {
      parts.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf(" ", MAX_CHUNK_SIZE);
    if (splitIndex <= 0) {
      splitIndex = MAX_CHUNK_SIZE;
    }

    parts.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trim();
  }

  return parts;
}

async function fetchAudioChunk(textChunk) {
  const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(
    textChunk,
  )}`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(ttsUrl)}`;

  const response = await fetch(proxyUrl, {
    method: "GET",
    headers: {
      Accept: "audio/mpeg",
    },
  });

  if (!response.ok) {
    throw new Error(`TTS request failed (${response.status})`);
  }

  return response.arrayBuffer();
}

async function buildMp3Blob(text) {
  const textChunks = splitText(text);
  const chunks = [];
  let totalBytes = 0;

  logStatus(`Text split into ${textChunks.length} chunk(s).`);

  for (const [index, chunkText] of textChunks.entries()) {
    logStatus(`Requesting chunk ${index + 1} of ${textChunks.length}...`);
    const audioData = await fetchAudioChunk(chunkText);
    const chunkBytes = audioData.byteLength;
    totalBytes += chunkBytes;
    chunks.push(new Uint8Array(audioData));
    logStatus(`Received ${formatSize(chunkBytes)} for chunk ${index + 1}.`);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.length;
  });

  logStatus(`Total audio size: ${formatSize(totalBytes)}.`);
  return new Blob([merged], { type: "audio/mpeg" });
}

async function previewSpeech() {
  const text = textInput.value.trim();
  if (!text) {
    logStatus("Please enter text before previewing.");
    return;
  }

  if (!window.speechSynthesis) {
    logStatus("Speech synthesis is not supported in this browser.");
    return;
  }

  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onstart = () => logStatus("Preview started.");
  utterance.onend = () => logStatus("Preview finished.");
  utterance.onerror = () => logStatus("Speech preview failed.");

  speechSynthesis.speak(utterance);
}

async function downloadMp3() {
  const text = textInput.value.trim();
  if (!text) {
    logStatus("Enter text before downloading MP3.");
    return;
  }

  downloadBtn.disabled = true;
  previewBtn.disabled = true;
  logStatus("Connecting to TTS service...");

  try {
    const mp3Blob = await buildMp3Blob(text);
    const fileName = "text-to-mp3.mp3";
    const url = URL.createObjectURL(mp3Blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    logStatus(`Download ready: ${fileName}`);
  } catch (error) {
    logStatus(`Conversion failed: ${error.message}`);
  } finally {
    downloadBtn.disabled = false;
    previewBtn.disabled = false;
  }
}

textInput.addEventListener("input", () => {
  updateCharCount();
});

txtFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".txt")) {
    logStatus("Only .txt files are supported.");
    return;
  }
  readTxtFile(file);
  event.target.value = "";
});

previewBtn.addEventListener("click", previewSpeech);
downloadBtn.addEventListener("click", downloadMp3);

clearStatus();
updateCharCount();
