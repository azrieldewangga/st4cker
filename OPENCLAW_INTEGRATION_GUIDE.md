# St4cker <-> OpenClaw Integration Guide

This guide explains how to deploy your updated St4cker Bot on a VPS and connect it to OpenClaw (or any Agentic AI).

## 1. VPS Deployment

You can now run St4cker using Docker, which is cleaner and easier to manage on a VPS.

### Prerequisites (on VPS)
- Docker & Docker Compose installed.

### Steps
1.  **Upload Code**: Copy the `telegram-bot` folder (managed in this repo) to your VPS.
2.  **Configure Env**: Create a `.env` file in the same folder as `docker-compose.yml`.
    ```env
    # Add your standard variables
    TELEGRAM_BOT_TOKEN=...
    AGENT_API_KEY=my_secure_secret_key_123   <-- CRITICAL: Set this!
    ```
3.  **Run**:
    ```bash
    docker-compose up -d --build
    ```
    Your St4cker API will be live at `http://YOUR_VPS_IP:3000`.

## 2. Connecting OpenClaw (The "Asisten" Setup)

To make OpenClaw "smart" about your tasks, you need to give it the tool definition.

### Option A: Using the OpenAPI Spec (Standard)
If OpenClaw supports importing OpenAPI/Swagger:
1.  Download `st4cker-openapi.yaml` (created in this session).
2.  Import it into OpenClaw's tool config.
3.  Set the Authentication Header: `x-api-key: my_secure_secret_key_123`.

### Option B: Manual Tool Definition (Copy-Paste)
If you need to paste a JSON schema for the tools, use this:

#### Tool: `get_tasks`
*Description: Get list of pending tasks to remind the user.*
```json
{
  "name": "get_tasks",
  "description": "Fetch list of academic tasks or assignments. Use this to check deadlines for the user.",
  "parameters": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["pending", "completed"] },
      "priority": { "type": "string", "enum": ["high", "medium", "low"] }
    }
  }
}
```
*(API Route: `GET /api/v1/tasks`)*

#### Tool: `add_task`
*Description: Add a new task from user instruction.*
```json
{
  "name": "add_task",
  "description": "Create a new assignment or task in the database.",
  "parameters": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Title of the task" },
      "course": { "type": "string", "description": "Subject or course name" },
      "deadline": { "type": "string", "description": "ISO Date string (YYYY-MM-DDTHH:mm:ss.sssZ)" },
      "note": { "type": "string" }
    },
    "required": ["title", "course", "deadline"]
  }
}
```
*(API Route: `POST /api/v1/tasks`)*

---

## 3. Example Workflow (What to tell OpenClaw)

Once connected, you can give OpenClaw instructions like:

> "You are my academic assistant. Every morning at 7 AM, use `get_tasks` to check my pending tasks. If there are tasks due within 2 days, send me a summary on WhatsApp."

This works because OpenClaw now has the **Tool** (`get_tasks`) to see your data and the **medium** (WhatsApp) to talk to you.
