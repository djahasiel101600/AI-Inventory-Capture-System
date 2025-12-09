# AI Inventory Capture System

This repository contains a minimal implementation of the AI Inventory Capture System described in `PRD.md`.

Backend (Django + DRF):

- Endpoint `POST /api/product/extract/` accepts `image` file and returns extracted fields (simulated GPT + OCR using pytesseract).
- Endpoint `GET /api/export/csv/` returns CSV of saved captures.

Frontend (Vite + React + TypeScript):

- Simple mobile-friendly UI to capture images, upload, review and export CSV.

Setup (Windows PowerShell):

1. Backend

```
cd "c:/Users/Administrator/Documents/codes/AI Inventory Capture System/backend"
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r ..\requirements.txt
python manage.py migrate
# Run backend on port 8002 to match frontend proxy
python manage.py runserver 8002
```

Note: Install Tesseract OCR on your system and ensure `tesseract` is in PATH. On Windows, install from https://github.com/tesseract-ocr/tesseract.

2. Frontend

```
cd "c:/Users/Administrator/Documents/codes/AI Inventory Capture System/frontend"
npm install
# Dev server configured to run on port 3002
npm run dev
```

The frontend expects the backend at `http://localhost:8000` by default.

Environment variables (OpenAI API key)

- Create a `.env` file inside the `backend` folder (copy `backend/.env.example`).
- Add your OpenAI API key there:

```
OPENAI_API_KEY=sk-REPLACE_WITH_YOUR_KEY
```

The Django settings will load `backend/.env` automatically when `python-dotenv` is installed.
