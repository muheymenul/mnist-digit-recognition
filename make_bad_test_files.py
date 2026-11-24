import os
from pathlib import Path

from PIL import Image

output_dir = Path("test_images")
output_dir.mkdir(exist_ok=True)

(output_dir / "not_an_image.png").write_text("this is a text file, not an image")
(output_dir / "empty_file.png").write_bytes(b"")
Image.new("RGB", (200, 200), (255, 255, 255)).save(output_dir / "blank_white.png")
(output_dir / "too_large.png").write_bytes(os.urandom(6 * 1024 * 1024))

print(sorted(path.name for path in output_dir.iterdir() if "digit" not in path.name))