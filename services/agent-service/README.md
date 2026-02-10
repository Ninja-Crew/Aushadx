# Agent Service (Python/FastAPI)

This service provides an AI agent interface for AushadX, leveraging Google's Gemini model and LangGraph to orchestrate interactions with other microservices.

## Features

- **Natural Language Understanding**: Uses Gemini 1.5 Flash.
- **Tool Use**: Can call other services to:
    - Analyze medicines.
    - Schedule reminders.
    - Retrieve medical profiles.
- **Stateful Conversations**: Uses LangGraph to maintain conversation context.

## Setup

1.  Create a virtual environment (optional but recommended):
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Ensure `.env` file is present with:
    ```env
    PORT=3004
    GOOGLE_API_KEY=your_key_here
    MEDICINE_ANALYZER_URL=http://localhost:3002
    MEDICINE_SCHEDULER_URL=http://localhost:3001
    PROFILE_MANAGER_URL=http://localhost:3003
    ```
4.  Run the service:
    ```bash
    uvicorn main:app --reload --port 3004
    ```

## API

### POST /api/agent/chat

Request:
```json
{
  "message": "Schedule 500mg paracetamol at 9am daily",
  "user_id": "user123"
}
```

Response:
```json
{
  "response": "I have scheduled Paracetamol (500mg) for 9:00 AM daily."
}
```

### Docs

Swagger UI available at `http://localhost:3004/docs`
