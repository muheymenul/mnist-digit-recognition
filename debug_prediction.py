import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, "backend")
from inference import load_trained_model, predict_digit, prepare_user_image

if len(sys.argv) != 2:
    sys.exit("Usage: python debug_prediction.py <image_path>")

image_path = Path(sys.argv[1])
model = load_trained_model("backend/model/mnist_cnn_model.keras")

prepared = prepare_user_image(Image.open(image_path))
digit, confidence, probabilities = predict_digit(model, prepared)

print("Predicted:", digit, f"(confidence {confidence:.3f})")
for index in np.argsort(probabilities)[::-1][:3]:
    print(f"  digit {index}: {probabilities[index]:.3f}")

output_path = Path("test_images") / f"prepared_{image_path.stem}.png"
Image.fromarray(prepared).resize((280, 280), Image.Resampling.NEAREST).save(output_path)
print("Saved what the model sees:", output_path)