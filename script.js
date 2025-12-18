const fileInput = document.getElementById("fileInput");
const viewer = document.getElementById("viewer");

let fullText = "";
let utterance = null;
let voices = [];
let wordElements = [];

speechSynthesis.onvoiceschanged = () => {
  voices = speechSynthesis.getVoices();
};

fileInput.addEventListener("change", handleFile);

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  viewer.innerHTML = "";
  fullText = "";
  stopReading();

  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "pdf") loadPDF(file);
  else if (ext === "txt") loadText(file);
  else if (ext === "docx") loadDocx(file);
  else if (file.type.startsWith("image")) loadImage(file);
}

async function loadPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.2 });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    viewer.appendChild(canvas);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const text = await page.getTextContent();
    let reconstructed = "";
    let lastY = null;

    text.items.forEach(item => {
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        reconstructed += "\n";
      }
      reconstructed += item.str;
      lastY = item.transform[5];
    });

    fullText += reconstructed + "\n";
  }

  processText(fullText);
}

function loadText(file) {
  const reader = new FileReader();
  reader.onload = () => {
    fullText = reader.result;
    processText(fullText);
  };
  reader.readAsText(file);
}

function loadDocx(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const result = await mammoth.extractRawText({ arrayBuffer: reader.result });
    fullText = result.value;
    processText(fullText);
  };
  reader.readAsArrayBuffer(file);
}

function loadImage(file) {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  viewer.appendChild(img);
}

function processText(text) {
  viewer.innerHTML = "";
  wordElements = [];

  text = text
    .replace(/\b(Mr|Mrs|Ms|Dr)\./g, "$1") // abbreviations
    .replace(/\s+/g, " ");

  text.split(" ").forEach((word, index) => {
    const span = document.createElement("span");
    span.textContent = word + " ";
    span.className = "word";
    span.onclick = () => startReading(index);
    viewer.appendChild(span);
    wordElements.push(span);
  });
}

function getBestVoice() {
  return (
    voices.find(v => v.name.toLowerCase().includes("george")) ||
    voices.find(v => v.name.toLowerCase().includes("samantha")) ||
    voices.find(v => v.lang === "en-US") ||
    voices[0]
  );
}

function startReading(startIndex = 0) {
  stopReading();

  const textToRead = wordElements
    .slice(startIndex)
    .map(w => w.textContent)
    .join("");

  utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.voice = getBestVoice();
  utterance.rate = 0.55;
  utterance.pitch = 0.95;

  let currentWord = startIndex;

  utterance.onboundary = e => {
    if (e.name === "word") {
      wordElements.forEach(w => w.classList.remove("highlight"));
      if (wordElements[currentWord]) {
        wordElements[currentWord].classList.add("highlight");
        wordElements[currentWord].scrollIntoView({ behavior: "smooth", block: "center" });
        currentWord++;
      }
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
