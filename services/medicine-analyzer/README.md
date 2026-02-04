# Medicine Analyzer 🧠

> **The Brain of AushadX.**
> *Generative AI. Vector Search. Medical Insight.*

---

## 📖 Overview

The **Medicine Analyzer** service brings intelligence to AushadX. It allows users to upload raw medical text or reports and receive structured, easy-to-understand insights.

It leverages a **Retrieval-Augmented Generation (RAG)** pipeline, combining the reasoning power of **Google Gemini** with a specialized medical knowledge index to provide accurate, context-aware answers.

## ⚡ Key Capabilities

- **RAG Engine**:
  - Embeds user queries using high-dimensional vectors.
  - Searches a local Vector Store for relevant medical contexts.
  - Synthesizes an answer using the LLM, grounded in true medical data.
- **Structured Health Analytics**:
  - Generates JSON-structured dietary plans, exercise routines, and risk assessments.
- **Medical Report Parsing**: Understands complex medical terminology.

---

## 🔌 API Endpoints

Base URL: `/api` (routed via Gateway `/analyze`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/analyze` | RAG Chat. Body: `{ text: "Is ibuprofen safe with..." }` |
| `POST` | `/health-analytics` | Comprehensive Report. Body: `{ user_data: {...} }` |

---

## 🛠️ Configuration

### Environment Variables
Create a `.env` file in `services/medicine-analyzer`:

```env
PORT=8000
GEMINI_API_KEY=your_google_gemini_api_key

# RAG / Vector DB Configuration
EMBEDDING_API_URL=http://localhost:8001/embed # If using external embedder
INDEX_DB_URL=http://localhost:8002/search     # If using external vector DB
```

---

## 🚀 Usage

### Install Dependencies
```bash
npm install
```

### Run Locally
```bash
npm run start
# Runs on http://localhost:8000
```

### Notes on LLM
This service uses Google's Generative AI SDK. Ensure you have a valid `GEMINI_API_KEY` with permissions for the `gemini-pro` model.
