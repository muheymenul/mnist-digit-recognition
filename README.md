# Handwritten Digit Recognition

A deep learning web application that recognizes handwritten digits (0-9).
A Convolutional Neural Network (CNN) trained on the MNIST dataset is served by a FastAPI backend.
A plain HTML, CSS and JavaScript frontend lets you draw a digit on a canvas or upload an image,
then shows the predicted digit, the confidence, and the probability of every digit.

<!-- Add screenshots after saving them in the docs/ folder, then delete the first and last line of this block:
![Prediction screen](docs/app-screenshot.png)
![API documentation](docs/api-docs.png)
-->

## Features

- CNN trained on MNIST (about 99.1% accuracy on the 10,000 test images)
- Draw a digit with a mouse or a finger, or upload a PNG, JPG or WebP image
- Predicted digit, confidence score, and a probability bar for all 10 digits
- Preprocessing that converts any image (colored, white background, off-center) into the MNIST format
- REST API with automatic interactive documentation (Swagger UI)
- Input validation and clear error messages
- Responsive, mobile-friendly interface with keyboard focus styles
- Docker support (non-root container with a health check)

## Tech stack

| Area | Technology |
|---|---|
| Language | Python 3.13 |
| Deep learning | TensorFlow 2.21 and Keras |
| Backend | FastAPI, Uvicorn |
| Image handling | Pillow, NumPy |
| Frontend | HTML, CSS, JavaScript (Canvas and Fetch API) |
| Containerization | Docker |
| Training environment | Kaggle Notebook |

## Project structure

```
mnist-digit-recognition/
├── backend/
│   ├── main.py              FastAPI app: /health, /predict, serves the frontend
│   ├── inference.py         Preprocessing and prediction functions
│   ├── requirements.txt     Pinned dependencies
│   └── model/
│       ├── mnist_cnn_model.keras   Trained model
│       └── model_info.json         Input shape, library versions, test accuracy
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── Dockerfile
├── .dockerignore
├── .gitignore
├── make_test_images.py      Creates sample digit images for manual testing
├── make_bad_test_files.py   Creates invalid files to test error handling
└── debug_prediction.py      Shows what the model sees for a given image
```

## Getting started

### Option 1: Run locally with Python

Requirements: Python 3.13 and Git.

Windows (PowerShell):

```
git clone https://github.com/muheymenul/mnist-digit-recognition.git
cd mnist-digit-recognition
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

macOS and Linux:

```
git clone https://github.com/muheymenul/mnist-digit-recognition.git
cd mnist-digit-recognition
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
cd backend
uvicorn main:app --reload --port 8000
```

Then open http://127.0.0.1:8000 in your browser.
The first start takes a few seconds because the model is loaded once at startup.

This project was developed and tested on Windows. The macOS and Linux commands are the
standard equivalents but have not been tested.

### Option 2: Run with Docker

Requirement: Docker (Docker Desktop on Windows and macOS).

```
docker build -t mnist-digit-recognition .
docker run --rm -p 7860:7860 --name mnist-app mnist-digit-recognition
```

Then open http://127.0.0.1:7860. Stop the container with `docker stop mnist-app`.

## How to use the web app

1. Draw a digit on the canvas, or press **Upload image** and choose a file.
2. Press **Predict**.
3. Read the predicted digit, the confidence, and the probability of each digit.
4. Press **Clear** to start again.

For best results, draw one digit, large and clear, with a closed loop for digits such as 0, 6, 8 and 9.

## API

Interactive documentation is available at `/docs` while the server is running.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Reports whether the server is running and the model is loaded |
| POST | `/predict` | Accepts an image (`multipart/form-data`, field name `file`) and returns the prediction |

Example request (on Windows PowerShell use `curl.exe`):

```
curl -X POST -F "file=@my_digit.png" http://127.0.0.1:8000/predict
```

Example response (the numbers are illustrative):

```json
{
  "predicted_digit": 7,
  "confidence": 0.999994,
  "probabilities": {
    "0": 0.0, "1": 0.0, "2": 0.0, "3": 0.0, "4": 0.0,
    "5": 0.0, "6": 0.0, "7": 0.999994, "8": 0.0, "9": 0.000006
  }
}
```

Errors are returned as `{"detail": "message"}`:

| Status | Meaning |
|---|---|
| 400 | Empty file, not a valid image, image dimensions too large, or an image with no visible digit |
| 413 | File larger than 5 MB |
| 422 | The `file` field is missing from the request |
| 503 | The model is not loaded |
| 500 | Unexpected server error during prediction |

## How it works

### Preprocessing

Images drawn by users look different from MNIST, so every image goes through the same steps before prediction:

1. Convert to grayscale.
2. Invert the colors if the background is light (MNIST digits are white on black).
3. Crop to the bounding box of the digit.
4. Scale the longer side to 20 pixels, keeping the aspect ratio.
5. Place the digit on a 28x28 canvas and center it by its center of mass.
6. Scale pixel values from 0-255 to 0.0-1.0 and reshape to `(1, 28, 28, 1)`.

### Model

| Layer | Details |
|---|---|
| Input | 28 x 28 x 1 |
| Conv2D + ReLU | 32 filters, 3 x 3 |
| MaxPooling2D | 2 x 2 |
| Conv2D + ReLU | 64 filters, 3 x 3 |
| MaxPooling2D | 2 x 2 |
| Flatten | |
| Dense + ReLU | 128 units |
| Dropout | 0.5 |
| Dense + Softmax | 10 units |

The model has 225,034 trainable parameters.

Training setup:

- Data: 54,000 training, 6,000 validation (stratified split), 10,000 test images
- Optimizer: Adam (learning rate 0.001), loss: categorical cross-entropy, batch size 128
- Up to 30 epochs with early stopping (patience 3, best weights restored) and learning rate reduction on plateau
- Test accuracy: about 99.1% (0.9909, stored in `backend/model/model_info.json`)

The model was trained in a Kaggle Notebook. The notebook is not part of this repository yet.

## Security and robustness

- Uploads are limited to 5 MB and 16 megapixels, and files are verified to be real images
- The backend serves only the `frontend/` folder, so source code and the model cannot be downloaded through the web server
- The Docker container runs as a non-root user
- Allowed browser origins (CORS) can be set with the `ALLOWED_ORIGINS` environment variable
- Error details are logged on the server and are not shown to users

## Testing manually

```
python make_test_images.py        # creates test_images/ with sample digits
python make_bad_test_files.py     # creates invalid files for error handling tests
python debug_prediction.py test_images/white_bg_0_digit_7.png
```

Upload the generated files in the web app or at `/docs` and check that valid digits are predicted correctly and invalid files return clear error messages.

## Limitations

- The model was trained on MNIST, so unusual handwriting or very different drawing styles can be misclassified. The confidence score and the probability chart help to judge how reliable a prediction is.
- The app recognizes a single digit per image.
- A public deployment is not available yet. The app currently runs locally and in Docker.

## Author

Mohiminul Islam Real
GitHub: https://github.com/muheymenul
