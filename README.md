# Chat with Your Database: Text-to-SQL Agent

Ask questions about a database in plain English. An LLM agent writes the PostgreSQL query, runs it **safely (read-only)**, and shows the answer as a table and a chart. Everything runs locally with Ollama, so no data leaves your machine and no API key is needed.

![Monthly revenue](screenshots/monthly-revenue.png)
![Destructive request blocked](screenshots/blocked-delete.png)
![FastAPI demo](api_demo.png)

## What it can do
- "Top 5 products by revenue in March 2025"
- "Show monthly revenue for 2025"
- "Which city has the most customers?"
- "Delete all orders" is refused and the database stays unchanged

## How it works

```mermaid
flowchart LR
  Q[User question] --> A[LLM agent: Ollama llama3.1]
  A -->|run_sql tool call| G[Guardrails: sqlglot]
  G -->|validated SELECT| D[(PostgreSQL: read-only, 5s timeout)]
  D -->|rows or error| A
  A --> UI[Streamlit: summary, table, chart]
  A --> API[FastAPI: /ask endpoint]
```

The model uses **function calling**: it calls a `run_sql` tool, gets back rows or an error message, and retries if the SQL was wrong (up to 4 steps).

## Safety (defense in depth)
1. **Pre-filter:** requests to modify data are refused before they reach the model.
2. **Guardrails (`guardrails.py`):** SQL is parsed with sqlglot. Only a single `SELECT` on four allow-listed tables is accepted. INSERT, UPDATE, DELETE, DROP, `SELECT INTO`, row locking and `pg_` functions are blocked, and a row `LIMIT` is added automatically.
3. **Database layer (`db.py`):** queries run in a read-only transaction with a 5-second statement timeout.
4. **Tests:** `test_guardrails.py` checks that dangerous statements are blocked, independent of the model.

## Evaluation
`eval.py` runs natural-language questions through the agent and compares each result with a hand-written reference SQL query (extra columns are allowed; row count and values must match). It also sends destructive requests and checks the database is unchanged.

| Test set | Result |
|---|---|
| Core questions (16) | 16/16 in the latest full run |
| Harder held-out questions (10) | 4/10 (baseline; improvements in progress) |
| Safety (destructive requests, 4) | 4/4 blocked, database unchanged |

LLM output is not fully deterministic, so a question can pass in one run and fail in another. Results are from a local `llama3.1` model on a synthetic dataset.

## Run it yourself (Windows PowerShell)
```powershell
# 1. Install PostgreSQL and Ollama, then:
ollama pull llama3.1

# 2. Create an empty database called "shop" (pgAdmin or psql), then:
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# 3. Point the app at your database (use your own password and port)
$env:DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/shop"

# 4. Create tables and fake data (200 customers, 30 products, 3,000 orders)
python seed.py

# 5. Start the app
streamlit run app.py

# Optional: run the evaluation
python -u eval.py
```
On Mac/Linux, use `source venv/bin/activate` and `export DATABASE_URL=...`.

## REST API
The agent is also exposed as a FastAPI service. Set `DATABASE_URL` first, then start it:
```powershell
uvicorn api:app --reload
```
Open `http://localhost:8000/docs` for the interactive Swagger page, or send a request:
```powershell
curl -X POST http://localhost:8000/ask -H "Content-Type: application/json" -d "{\"question\": \"Which city has the most customers?\"}"
```
The response contains `answer`, `sql` and `rows`. `GET /health` returns `{"status": "ok"}`.

## Project structure
| File | Purpose |
|---|---|
| `app.py` | Streamlit chat UI with automatic charts |
| `agent.py` | LLM tool-calling loop |
| `api.py` | FastAPI REST endpoint (`/ask`, `/health`) |
| `guardrails.py` | SQL validation (sqlglot) |
| `db.py` | Read-only query runner and schema reader |
| `seed.py`, `schema.sql` | Synthetic shop database |
| `eval.py` | Accuracy and safety evaluation |
| `test_guardrails.py` | Guardrail unit tests |

## Limitations
- The data is synthetic (a fake online shop), not real business data.
- A small local model can still misread an ambiguous question, so check important numbers.
- Only read-only queries on four tables are supported.

## Tech stack
Python, FastAPI, PostgreSQL, Ollama (llama3.1), sqlglot, Streamlit, Plotly, pandas, psycopg