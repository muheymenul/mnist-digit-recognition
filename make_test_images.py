from pathlib import Path

import tensorflow as tf
from PIL import Image

output_dir = Path("test_images")
output_dir.mkdir(exist_ok=True)

(_, _), (x_test, y_test) = tf.keras.datasets.mnist.load_data()

for index in range(5):
    digit = int(y_test[index])
    Image.fromarray(x_test[index]).save(output_dir / f"mnist_{index}_digit_{digit}.png")
    inverted = Image.fromarray(255 - x_test[index]).resize((280, 280))
    inverted.save(output_dir / f"white_bg_{index}_digit_{digit}.png")

print(sorted(path.name for path in output_dir.iterdir()))