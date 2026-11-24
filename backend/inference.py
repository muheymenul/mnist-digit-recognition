"""Inference utilities for the MNIST CNN model."""
import numpy as np
import tensorflow as tf
from PIL import Image

IMAGE_SIZE = 28
NUM_CLASSES = 10


def load_trained_model(model_path):
    """Load the trained .keras model from disk."""
    return tf.keras.models.load_model(model_path)


def preprocess_image(image_array):
    """Convert a 28x28 uint8 image into a model input of shape (1, 28, 28, 1)."""
    image = np.asarray(image_array, dtype=np.float32)
    if image.shape != (IMAGE_SIZE, IMAGE_SIZE):
        raise ValueError("Expected a 28x28 grayscale image")
    image = image / 255.0
    return image.reshape(1, IMAGE_SIZE, IMAGE_SIZE, 1)


def prepare_user_image(pil_image):
    """Convert any PIL image into a centered 28x28 MNIST-style uint8 image."""
    pixels = np.asarray(pil_image.convert("L"), dtype=np.float32)

    border = np.concatenate([pixels[0, :], pixels[-1, :], pixels[:, 0], pixels[:, -1]])
    if border.mean() > 127:
        pixels = 255.0 - pixels

    if pixels.max() < 1:
        raise ValueError("Image is empty")

    ink_mask = pixels > 0.2 * pixels.max()
    rows = np.where(ink_mask.any(axis=1))[0]
    cols = np.where(ink_mask.any(axis=0))[0]
    cropped = pixels[rows[0]:rows[-1] + 1, cols[0]:cols[-1] + 1]

    height, width = cropped.shape
    scale = 20.0 / max(height, width)
    new_width = max(1, round(width * scale))
    new_height = max(1, round(height * scale))
    resized = Image.fromarray(cropped.astype(np.uint8)).resize(
        (new_width, new_height), Image.Resampling.LANCZOS
    )

    canvas = np.zeros((IMAGE_SIZE, IMAGE_SIZE), dtype=np.float32)
    top = (IMAGE_SIZE - new_height) // 2
    left = (IMAGE_SIZE - new_width) // 2
    canvas[top:top + new_height, left:left + new_width] = np.asarray(resized, dtype=np.float32)

    y_grid, x_grid = np.indices(canvas.shape)
    total_ink = canvas.sum()
    center_y = (y_grid * canvas).sum() / total_ink
    center_x = (x_grid * canvas).sum() / total_ink
    shift_y = int(np.clip(round(13.5 - center_y), -4, 4))
    shift_x = int(np.clip(round(13.5 - center_x), -4, 4))
    canvas = np.roll(canvas, shift=(shift_y, shift_x), axis=(0, 1))

    return np.clip(canvas, 0, 255).astype(np.uint8)


def predict_digit(model, image_array):
    """Return (predicted_digit, confidence, probabilities) for a 28x28 uint8 image."""
    batch = preprocess_image(image_array)
    probabilities = model.predict(batch, verbose=0)[0]
    predicted_digit = int(np.argmax(probabilities))
    confidence = float(probabilities[predicted_digit])
    return predicted_digit, confidence, probabilities
