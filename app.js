const pdfjsLib = window["pdfjs-dist/build/pdf"];
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

const input = document.getElementById("fileInput");
const viewer = document.getElementById("viewer");
const readBtn = document.getElementById("readBtn");

let sentenceElements = [];
let currentSentenceIndex = 0;
let speaking = false;
let voices = [];

// ---------------- LOAD VOICES ----------------
function loadVoices() {
  voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      voices = speechSynthesis.getVoices();
      readBtn.disabled = false;
    };
  } else {
    readBtn.disabled = false;
  }
}
loadVoices();

// Pick first available female/system voice
function getVoice() {
  return voices.find(v => v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("female")) || voices[0] || null;
}

// ---------------- FILE UPLOAD ----------------
input.addEventListener("change", async (e) => {
  stopReading();
  viewer.innerHTML = "";
  sentenceElements = [];
  currentSentenceIndex = 0;

  const file = e.target.files[0];
  if (!file) return;

  if (file.type === "application/pdf") renderPDF(file);
  else if (file.type.startsWith("image")) renderImage(file);
  else if (file.name.endsWith(".docx")) renderDocx(file);
  else renderText(file);
});

// ---------------- PDF ----------------
async function renderPDF(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = e.target.result;
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 1.2 });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      viewer.appendChild(canvas);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const text = await page.getTextContent();
      processText(text.items.map(i => i.str).join(" "));
    }
  };
  reader.readAsArrayBuffer(file);
}

// ---------------- IMAGE ----------------
function renderImage(file) {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  viewer.appendChild(img);
}

// ---------------- DOCX ----------------
async function renderDocx(file) {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  processText(result.value);
}

// ---------------- TEXT ----------------
function renderText(file) {
  const reader = new FileReader();
  reader.onload = () => processText(reader.result);
  reader.readAsText(file);
}

// ---------------- PROCESS TEXT ----------------
function processText(text) {
  const abbreviations = ["Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St"];
  const regex = new RegExp(
    `(?<!\\b(?:${abbreviations.join("|")})\\.)` + 
    `(?<=[.!?])`
  );

  const sentences = text.split(regex);

  sentences.forEach(sentence => {
    if (!sentence.trim()) return;

    const s = document.createElement("span");
    s.className = "sentence";

    sentence.split(/\s+/).forEach(word => {
      const w = document.createElement("span");
      w.className = "word";
      w.textContent = word + " ";

      w.onclick = () => {
        stopReading();
        currentSentenceIndex = sentenceElements.indexOf(s);
        startReading();
      };

      s.appendChild(w);
    });

    viewer.appendChild(s);
    sentenceElements.push(s);
  });
}

// ---------------- SPEECH ----------------
function startReading() {
  if (!sentenceElements.length || speaking) return;
  speaking = true;
  speakNext();
}

function speakNext() {
  if (!speaking || currentSentenceIndex >= sentenceElements.length) return;

  const el = sentenceElements[currentSentenceIndex];
  highlight(el);

  const utter = new SpeechSynthesisUtterance(el.innerText);
  utter.voice = getVoice();
  utter.rate = 0.55; // slightly slower
  utter.pitch = 1.0;

  utter.onend = () => {
    currentSentenceIndex++;
    speakNext();
  };

  speechSynthesis.speak(utter);
}

function pauseReading() { speechSynthesis.pause(); }
function resumeReading() { speechSynthesis.resume(); }
function stopReading() {
  speechSynthesis.cancel();
  speaking = false;
  currentSentenceIndex = 0;
  clearHighlights();
}

// ---------------- HIGHLIGHT ----------------
function highlight(el) {
  clearHighlights();
  el.classList.add("highlight");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearHighlights() {
  document.querySelectorAll(".highlight").forEach(e => e.classList.remove("highlight"));
}
