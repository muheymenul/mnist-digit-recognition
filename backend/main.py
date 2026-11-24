import io
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from inference import load_trained_model, predict_digit, prepare_user_image

logger = logging.getLogger("mnist_api")

BASE_DIR = Path(__file__).parent
MODEL_PATH = BASE_DIR / "model" / "mnist_cnn_model.keras"
FRONTEND_DIR = BASE_DIR.parent / "frontend"
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500"
    ).split(",")
    if origin.strip()
]
model_store = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the model once when the server starts."""
    model_store["model"] = load_trained_model(str(MODEL_PATH))
    yield
    model_store.clear()


app = FastAPI(
    title="MNIST Digit Recognition API",
    description="Predicts handwritten digits (0-9) using a CNN trained on MNIST.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health_check():
    """Check that the server is running and the model is loaded."""
    return {"status": "ok", "model_loaded": "model" in model_store}


@app.post("/predict")
def predict(file: UploadFile = File(...)):
    """Receive an image of a handwritten digit and return the prediction."""
    model = model_store.get("model")
    if model is None:
        raise HTTPException(status_code=503, detail="Model is not loaded")

    image_bytes = file.file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(image_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File is too large (maximum 5 MB)")

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image")

    if pil_image.width * pil_image.height > MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=400, detail="Image dimensions are too large")

    try:
        image_array = prepare_user_image(pil_image)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except OSError:
        raise HTTPException(status_code=400, detail="The image could not be read")

    try:
        predicted_digit, confidence, probabilities = predict_digit(model, image_array)
    except Exception:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail="Prediction failed due to a server error")

    return {
        "predicted_digit": predicted_digit,
        "confidence": round(confidence, 6),
        "probabilities": {
            str(digit): round(float(probability), 6)
            for digit, probability in enumerate(probabilities)
        },
    }


# The static frontend must be mounted last, after every API route.
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
else:
    logger.warning("Frontend folder not found: %s", FRONTEND_DIR)