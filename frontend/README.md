# PDF Reader AI - Interactive PDF Reading Assistant

An AI-powered web application that allows users to read PDFs interactively and understand difficult words instantly by simply clicking or selecting them.

## Features

- **PDF Upload** - Drag & drop or browse to upload any PDF
- **Interactive PDF Reader** - Read PDFs directly in your browser with page navigation and zoom
- **Click-to-Explain** - Click or select any word to get an instant AI explanation
- **Context-Aware Meanings** - AI understands word meanings based on sentence context
- **Instant Popup Card** - Animated popup appears beside the selected word
- **Pronunciation** - IPA format + simple phonetic respelling
- **Multi-Language Translation** - Hindi, Marathi, Spanish, French, German, Japanese, Chinese, Portuguese, Arabic, Korean, Russian
- **Sentence Simplification** - Click "Simplify this sentence" for complex text

## Prerequisites

- **Node.js** 18.17 or later
- **npm** (comes with Node.js)
- **Gemini API Key** - Get one free from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup Instructions

### 1. Extract and install

```bash
cd pdf-reader-ai
npm install
```

### 2. Set your Gemini API Key

Open the `.env.local` file and replace the placeholder with your actual API key:

```
GEMINI_API_KEY=your_actual_api_key_here
```

> Get a free API key from: https://aistudio.google.com/apikey

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for production

```bash
npm run build
npm start
```

## How to Use

1. **Upload a PDF** - Click "browse" or drag & drop a PDF file into the upload zone
2. **Read the PDF** - Use the arrow buttons to navigate pages, +/- to zoom
3. **Click any word** - Or select text — an AI popup appears instantly
4. **Get explanation** - See the contextual meaning, pronunciation, and translation
5. **Change language** - Use the "Translate to" dropdown in the header
6. **Simplify sentences** - Click "Simplify this sentence" in the popup

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui |
| State | Zustand |
| PDF Rendering | pdfjs-dist (PDF.js) |
| AI | Google Gemini API (`@google/generative-ai`) |
| Animations | Framer Motion |

## Project Structure

```
pdf-reader-ai/
├── .env.local                    # API key configuration
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json
├── eslint.config.mjs
├── public/
│   ├── pdf-worker/
│   │   └── pdf.worker.min.mjs    # PDF.js worker
│   ├── logo.svg
│   └── robots.txt
└── src/
    ├── app/
    │   ├── layout.tsx             # Root layout
    │   ├── page.tsx               # Main page
    │   ├── globals.css            # Global styles
    │   └── api/
    │       ├── explain/
    │       │   └── route.ts       # AI word explanation endpoint
    │       └── simplify/
    │           └── route.ts       # Sentence simplification endpoint
    ├── components/
    │   ├── upload-zone.tsx        # PDF upload with drag & drop
    │   ├── pdf-viewer.tsx         # PDF rendering & text layer
    │   ├── word-popup.tsx         # Explanation popup card
    │   ├── settings-panel.tsx     # Translation language selector
    │   └── ui/                    # shadcn/ui components
    ├── store/
    │   └── use-pdf-store.ts       # Zustand state management
    ├── hooks/
    │   ├── use-mobile.ts
    │   └── use-toast.ts
    └── lib/
        └── utils.ts               # Utility functions
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |

## Troubleshooting

- **"Please set your GEMINI_API_KEY"** - Make sure you've added your API key to `.env.local`
- **PDF not rendering** - Ensure the PDF file is not corrupted or password-protected
- **Word selection not working** - Some scanned PDFs (image-only) don't have selectable text. You need text-based PDFs for the click-to-explain feature
