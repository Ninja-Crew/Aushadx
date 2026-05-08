# Medicine Analyzer

Microservice for extracting structured medicine data using LLMs (Gemini/OpenAI) and RAG.

## Setup

1. Copy `.env.example` to `.env`. Fill in API keys (Google/OpenAI/Pinecone).
2. Run `npm install`
3. Run `npm start`

## Docker

```bash
docker build -t medicine-analyzer .
docker run -p 3002:3002 medicine-analyzer
```

## Testing

```bash
npm test
```

Reusable mock modules live in `test/mocks`.
Detailed positive and negative scenarios are documented in `TEST_SCENARIOS.md`.
