# AI-Powered Interactive PDF Reading Assistant

A web application that lets you read PDFs interactively — click or select any word to get its contextual meaning, pronunciation, and translation instantly.

## Setup

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Edit `backend\.env` and add your Gemini API key:

```
GEMINI_API_KEY=your_key_here
```

Then run:

```bash
python main.py
```

The API runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000`.

## Usage

1. Open `http://localhost:3000`
2. Upload a PDF
3. Select any word in the PDF by clicking and dragging
4. A popup appears with:
   - Contextual meaning
   - Pronunciation (with audio button)
   - Translation (default: Hindi)
5. Change the translation language from the top menu

## How It Works

- **PDF Rendering**: Browser-native PDF viewer via iframe
- **Text Selection**: Captures selected word and surrounding sentence
- **AI Analysis**: Gemini API analyzes the word in context
- **Popup**: Non-intrusive card that appears beside the selection

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/upload` | POST | Upload a PDF |
| `/pdf/{filename}` | GET | Serve a PDF |
| `/word-meaning` | POST | Get word meaning (context-aware) |
| `/simplify` | POST | Simplify a sentence |
