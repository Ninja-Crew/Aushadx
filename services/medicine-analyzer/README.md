# medicine-analyzer

Service that takes raw medical text, computes embeddings, searches a pre-built index for relevant context, and runs a retrieval-augmented generation (RAG) LLM call to produce a concise, context-aware answer.

Environment

- `EMBEDDING_API_URL` – HTTP endpoint that accepts `{ input: string }` and returns embeddings.
- `LLM_API_URL` – HTTP endpoint that accepts `{ prompt: string }` and returns model output.
- `INDEX_DB_URL` – HTTP endpoint base for index DB; this service calls `POST ${INDEX_DB_URL}/search` with `{ vector, top_k }` and expects `{ results: [{ id, text, score }]}`.
- `PROFILE_SERVICE_URL` – optional base URL of the profile service (e.g., profile-manager). When provided and `PROPAGATE_AUTH=true`, medicine-analyzer can fetch the user's stored medical history from `${PROFILE_SERVICE_URL}/profile` by forwarding the incoming `Authorization` header.
- `PROPAGATE_AUTH` – when `true`, medicine-analyzer forwards the incoming `Authorization` header to downstream services (profile/index/LLM). Use with secure internal networks only.
- `GEMINI_API_KEY` – API key for Google Gemini. Required for `/api/health-analytics` endpoint which uses Gemini's structured output feature.

Run locally

1. Copy `.env.example` to `.env` and adjust endpoints.
2. Install dependencies and start:

```powershell
cd services/medicine-analyzer
npm install
npm run start
```

API

- POST `/api/analyze` – body: `{ text: string, question?: string, top_k?: number }`. Returns `{ success: true, answer, contexts }`.
- POST `/api/health-analytics` – body: `{ user_data: object, medical_reports_data?: object, top_k?: number, user_id?: string }`. Returns comprehensive health analytics with structured output from Gemini, including dietary recommendations, exercise plans, risk factors, and personalized health insights based on RAG-enhanced medical knowledge.

Notes

- The service expects external endpoints for embeddings, index search, and LLM inference. These can be simple HTTP adapters in front of your model-serving infra.
- The code is intentionally minimal and defensive about response shapes; adapt clients to your exact model server payloads.
