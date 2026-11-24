const API_BASE_URL = "";
const CANVAS_SIZE = 280;
const BRUSH_WIDTH = 12;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30000;
const LOW_CONFIDENCE_THRESHOLD = 0.7;
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

const apiStatusElement = document.getElementById("api-status");
const canvas = document.getElementById("draw-canvas");
const canvasHint = document.getElementById("canvas-hint");
const predictButton = document.getElementById("predict-button");
const clearButton = document.getElementById("clear-button");
const uploadButton = document.getElementById("upload-button");
const fileInput = document.getElementById("file-input");
const uploadPreview = document.getElementById("upload-preview");
const previewImage = document.getElementById("preview-image");
const fileNameElement = document.getElementById("file-name");
const inputMessage = document.getElementById("input-message");

const resultPlaceholder = document.getElementById("result-placeholder");
const resultLoading = document.getElementById("result-loading");
const resultError = document.getElementById("result-error");
const resultContent = document.getElementById("result-content");
const predictedDigitElement = document.getElementById("predicted-digit");
const confidenceValueElement = document.getElementById("confidence-value");
const lowConfidenceNote = document.getElementById("low-confidence-note");
const probabilityChart = document.getElementById("probability-chart");

const context = canvas.getContext("2d", { willReadFrequently: true });

let isDrawing = false;
let hasDrawn = false;
let lastPoint = null;
let uploadedFile = null;
let previewUrl = null;
let requestCounter = 0;
const probabilityRows = {};

class ApiError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiError";
  }
}

/* ---------- API status ---------- */

function setApiStatus(message, statusClass) {
  apiStatusElement.textContent = message;
  apiStatusElement.className = `status ${statusClass}`;
}

async function checkApiHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.model_loaded) {
      setApiStatus("API connected, model ready", "status-ok");
    } else {
      setApiStatus("API reachable, model not loaded", "status-error");
    }
  } catch (error) {
    console.error("Health check failed:", error);
    setApiStatus("API not reachable", "status-error");
  }
}

/* ---------- Probability chart ---------- */

function buildProbabilityChart() {
  DIGITS.forEach((digit) => {
    const row = document.createElement("div");
    row.className = "prob-row";
    row.setAttribute("role", "listitem");

    const label = document.createElement("span");
    label.className = "prob-digit";
    label.textContent = digit;

    const track = document.createElement("div");
    track.className = "prob-track";
    const fill = document.createElement("div");
    fill.className = "prob-fill";
    track.appendChild(fill);

    const value = document.createElement("span");
    value.className = "prob-value";
    value.textContent = "0.0%";

    row.append(label, track, value);
    probabilityChart.appendChild(row);
    probabilityRows[digit] = { row, fill, value };
  });
}

function updateProbabilityChart(probabilities, predictedDigit) {
  DIGITS.forEach((digit) => {
    const probability = Number(probabilities[digit]);
    const safeProbability = Number.isFinite(probability)
      ? Math.min(Math.max(probability, 0), 1)
      : 0;
    const { row, fill, value } = probabilityRows[digit];
    fill.style.width = `${safeProbability * 100}%`;
    value.textContent = `${(safeProbability * 100).toFixed(1)}%`;
    row.classList.toggle("prob-row-top", Number(digit) === predictedDigit);
  });
}

/* ---------- Result panel states ---------- */

function showResultState(state) {
  resultPlaceholder.hidden = state !== "placeholder";
  resultLoading.hidden = state !== "loading";
  resultError.hidden = state !== "error";
  resultContent.hidden = state !== "success";
}

function showResultError(message) {
  resultError.textContent = message;
  showResultState("error");
}

function showPrediction(data) {
  const isValid =
    Number.isInteger(data.predicted_digit) &&
    typeof data.confidence === "number" &&
    data.probabilities &&
    typeof data.probabilities === "object";
  if (!isValid) {
    throw new ApiError("The server sent an unexpected response.");
  }

  predictedDigitElement.textContent = String(data.predicted_digit);
  confidenceValueElement.textContent = `${(data.confidence * 100).toFixed(1)}%`;
  lowConfidenceNote.hidden = data.confidence >= LOW_CONFIDENCE_THRESHOLD;
  updateProbabilityChart(data.probabilities, data.predicted_digit);
  showResultState("success");
}

function setLoading(isLoading) {
  predictButton.disabled = isLoading;
  predictButton.textContent = isLoading ? "Predicting..." : "Predict";
  if (isLoading) {
    showResultState("loading");
  }
}

/* ---------- Input messages, canvas and upload ---------- */

function showInputMessage(message) {
  inputMessage.textContent = message;
  inputMessage.hidden = message === "";
}

function resetCanvas() {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  context.fillStyle = "#000000";
  context.strokeStyle = "#000000";
  context.lineWidth = BRUSH_WIDTH;
  context.lineCap = "round";
  context.lineJoin = "round";
  hasDrawn = false;
  canvasHint.hidden = false;
}

function clearUpload() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
  previewUrl = null;
  uploadedFile = null;
  previewImage.removeAttribute("src");
  fileNameElement.textContent = "";
  uploadPreview.hidden = true;
}

function canvasToBlob() {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function getImageToSend() {
  if (uploadedFile) {
    return { blob: uploadedFile, fileName: uploadedFile.name, source: "upload" };
  }
  if (hasDrawn) {
    const blob = await canvasToBlob();
    return { blob, fileName: "drawing.png", source: "canvas" };
  }
  return null;
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (CANVAS_SIZE / rect.width),
    y: (event.clientY - rect.top) * (CANVAS_SIZE / rect.height),
  };
}

function drawDot(point) {
  context.beginPath();
  context.arc(point.x, point.y, BRUSH_WIDTH / 2, 0, Math.PI * 2);
  context.fill();
}

function startDrawing(event) {
  event.preventDefault();
  clearUpload();
  showInputMessage("");
  canvas.setPointerCapture(event.pointerId);
  isDrawing = true;
  lastPoint = getPoint(event);
  drawDot(lastPoint);
  hasDrawn = true;
  canvasHint.hidden = true;
}

function draw(event) {
  if (!isDrawing) {
    return;
  }
  event.preventDefault();
  const point = getPoint(event);
  context.beginPath();
  context.moveTo(lastPoint.x, lastPoint.y);
  context.lineTo(point.x, point.y);
  context.stroke();
  lastPoint = point;
}

function stopDrawing() {
  if (!isDrawing) {
    return;
  }
  isDrawing = false;
  lastPoint = null;
}

function handleFileSelected() {
  const file = fileInput.files[0];
  fileInput.value = "";
  showInputMessage("");

  if (!file) {
    return;
  }
  if (!file.type.startsWith("image/")) {
    showInputMessage("Please choose an image file (PNG, JPG or WebP).");
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showInputMessage("File is too large (maximum 5 MB).");
    return;
  }

  clearUpload();
  resetCanvas();
  uploadedFile = file;
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  fileNameElement.textContent = file.name;
  uploadPreview.hidden = false;
}

/* ---------- Prediction request ---------- */

async function readErrorMessage(response) {
  try {
    const data = await response.json();
    if (typeof data.detail === "string") {
      return data.detail;
    }
  } catch (parseError) {
    console.warn("Could not read the error body:", parseError);
  }
  return `The server returned an error (HTTP ${response.status}).`;
}

function describeError(error) {
  if (error.name === "AbortError") {
    return "The request took too long. Please try again.";
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  console.error("Prediction request failed:", error);
  return "Could not reach the API. Make sure the server is running and try again.";
}

async function predictDigit() {
  const image = await getImageToSend();
  if (!image) {
    showResultError("Please draw a digit or upload an image first.");
    return;
  }

  requestCounter += 1;
  const currentRequest = requestCounter;
  setLoading(true);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const formData = new FormData();
    formData.append("file", image.blob, image.fileName);

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiError(await readErrorMessage(response));
    }

    const data = await response.json();
    if (currentRequest === requestCounter) {
      showPrediction(data);
    }
  } catch (error) {
    if (currentRequest === requestCounter) {
      showResultError(describeError(error));
    }
  } finally {
    clearTimeout(timeoutId);
    if (currentRequest === requestCounter) {
      setLoading(false);
    }
  }
}

/* ---------- Events ---------- */

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

predictButton.addEventListener("click", predictDigit);

clearButton.addEventListener("click", () => {
  requestCounter += 1;
  setLoading(false);
  resetCanvas();
  clearUpload();
  showInputMessage("");
  showResultState("placeholder");
});

uploadButton.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", handleFileSelected);

buildProbabilityChart();
resetCanvas();
showResultState("placeholder");
checkApiHealth();