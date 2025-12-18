const fileInput = document.getElementById("fileInput");
const viewer = document.getElementById("viewer");

let voices = [];
let utterance = null;
let wordElements = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

fileInput.addEventListener("change", handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  stopReading();
  viewer.innerHTML = "";
  wordElements = [];

  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "pdf") loadPDF(file);
  else if (ext === "txt") loadText(file);
  else if (ext === "docx") loadDocx(file);
  else if (file.type.startsWith("image")) loadImage(file);
}

/* ---------------- PDF ---------------- */

async function loadPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const pageContainer = document.createElement("div");

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.2 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport }).promise;
    pageContainer.appendChild(canvas);

    const text = await page.getTextContent();
    let extracted = "";
    let lastY = null;

    text.items.forEach(item => {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 6) {
        extracted += "\n";
      }
      extracted += item.str;
      lastY = item.transform[5];
    });

    pageContainer.appendChild(createTextLayer(extracted));
    viewer.appendChild(pageContainer);
  }
}

/* ---------------- OTHER FILES ---------------- */

function loadText(file) {
  const reader = new FileReader();
  reader.onload = () => {
    viewer.appendChild(createTextLayer(reader.result));
  };
  reader.readAsText(file);
}

function loadDocx(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const result = await mammoth.extractRawText({ arrayBuffer: reader.result });
    viewer.appendChild(createTextLayer(result.value));
  };
  reader.readAsArrayBuffer(file);
}

function loadImage(file) {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  viewer.appendChild(img);
}

/* ---------------- TEXT LAYER ---------------- */

function createTextLayer(text) {
  const layer = document.createElement("div");
  layer.className = "text-layer";

  text = text
    .replace(/\b(Mr|Mrs|Ms|Dr)\./g, "$1")
    .replace(/\s+/g, " ");

  text.split(" ").forEach((word, index) => {
    const span = document.createElement("span");
    span.textContent = word + " ";
    span.className = "word";
    span.onclick = () => startReadingFrom(span);
    layer.appendChild(span);
    wordElements.push(span);
  });

  return layer;
}

/* ---------------- TTS ---------------- */

function expandAbbreviations(text) {
  return text.replace(/\b[A-Z]{2,}\b/g, w => w.split("").join(" "));
}

function getBestVoice() {
  return (
    voices.find(v => v.name.toLowerCase().includes("george")) ||
    voices.find(v => v.name.toLowerCase().includes("samantha")) ||
    voices.find(v => v.lang === "en-US") ||
    voices[0]
  );
}

function startReadingFrom(span) {
  const startIndex = wordElements.indexOf(span);
  startReading(startIndex);
}

function startReading(startIndex = 0) {
  stopReading();

  let textToRead = wordElements
    .slice(startIndex)
    .map(w => w.textContent)
    .join("");

  textToRead = expandAbbreviations(textToRead);

  utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.voice = getBestVoice();
  utterance.rate = 0.55;
  utterance.pitch = 0.95;

  let current = startIndex;

  utterance.onboundary = e => {
    if (e.name === "word" && wordElements[current]) {
      wordElements.forEach(w => w.classList.remove("highlight"));
      wordElements[current].classList.add("highlight");
      wordElements[current].scrollIntoView({ behavior: "smooth", block: "center" });
      current++;
    }
  };

  speechSynthesis.speak(utterance);
}

function pauseReading() {
  speechSynthesis.pause();
}

function resumeReading() {
  speechSynthesis.resume();
}

function stopReading() {
  speechSynthesis.cancel();
  wordElements.forEach(w => w.classList.remove("highlight"));
}
