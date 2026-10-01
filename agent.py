"""The agent loop: LLM decides when to call run_sql, sees results or errors, and retries."""
import json
import os
import re

import ollama
from guardrails import validate, UnsafeSQL
from db import run_query, get_schema

MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
SYSTEM = """You are a careful data analyst for a PostgreSQL database.
- Always use the run_sql tool to get data; never guess numbers.
- Write a single read-only SELECT query. Use only the tables in the schema.
- If the tool returns an error or BLOCKED, fix the query and try again.
  If the user asks to change or delete data, do not retry: say you only have read-only access.
- Today's data covers 2025-2026. Revenue = price * quantity (join order_items and products).
  Count only orders with status = 'completed' unless asked otherwise.
- For monthly or time-series questions, always group by year AND month, using
  to_char(order_date, 'YYYY-MM') AS month, and order by it. Never group by month number alone.
- After you get results, reply with a short plain-English summary.
  If a query returns 0 rows, say so directly. For questions like "which X never...",
  say "Every X has ..." instead of using a double negative."""
TOOLS = [{
    "type": "function",
    "function": {
        "name": "run_sql",
        "description": "Run a read-only PostgreSQL SELECT query and return the rows.",
        "parameters": {
            "type": "object",
            "properties": {"query": {"type": "string", "description": "A single SELECT statement"}},
            "required": ["query"],
        },
    },
}]

# Refuse write requests before the model sees them. The SQL guardrail and the
# read-only transaction are still the real protection; this just gives a clean reply.
WRITE_INTENT = re.compile(
    r"\b(delete|drop|truncate|erase|wipe|insert|alter|update)\b", re.IGNORECASE
)


def _text_tool_call(content):
    """Some local models write the tool call as plain JSON text instead of a real
    tool call. Recover the query so it still goes through the guardrail."""
    if not content or "run_sql" not in content:
        return None
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    args = data.get("parameters") or data.get("arguments") or {}
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except json.JSONDecodeError:
            return None
    query = args.get("query") if isinstance(args, dict) else None
    return query if isinstance(query, str) else None


def _execute(sql):
    """Validate and run one query. Returns (result_text, safe_sql_or_None, df_or_None)."""
    try:
        safe_sql = validate(sql)
        df = run_query(safe_sql)
        if df.empty:
            return ("The query ran successfully and returned 0 rows. This is a valid final answer, "
                    "not an error. Do not run another query. Tell the user plainly, "
                    "for example 'Every product has been ordered at least once.'"), safe_sql, df
        return df.head(20).to_json(orient="records", date_format="iso"), safe_sql, df
    except UnsafeSQL as e:
        return f"BLOCKED: {e}", None, None
    except Exception as e:
        return f"SQL ERROR: {e}", None, None


def ask(question: str, max_steps: int = 5):
    if WRITE_INTENT.search(question):
        return ("I only have read-only access, so I can't change or delete data. "
                "I can answer questions about it, though."), None, None

    messages = [
        {"role": "system", "content": SYSTEM + "\n\nSCHEMA:\n" + get_schema()},
        {"role": "user", "content": question},
    ]
    last_sql, last_df = None, None
    nudged = False

    for _ in range(max_steps):
        msg = ollama.chat(model=MODEL, messages=messages, tools=TOOLS).message
        messages.append(msg)

        if msg.tool_calls:
            for call in msg.tool_calls:
                sql = call.function.arguments.get("query", "")
                result, safe_sql, df = _execute(sql)
                if safe_sql:
                    last_sql, last_df = safe_sql, df
                messages.append({"role": "tool", "content": result, "tool_name": call.function.name})
            continue

        text_sql = _text_tool_call(msg.content)
        if text_sql is not None:
            result, safe_sql, df = _execute(text_sql)
            if safe_sql:
                last_sql, last_df = safe_sql, df
            messages.append({"role": "user", "content": f"Tool result for run_sql: {result}"})
            continue

        if last_sql is None and not nudged:
            nudged = True
            messages.append({"role": "user", "content":
                "Use the run_sql tool to answer this. If the request asks to change data, "
                "reply that you only have read-only access."})
            continue

        final = re.sub(r'\{\s*"name"\s*:\s*"run_sql".*\}', "", msg.content or "", flags=re.DOTALL).strip()
        return final or "The query ran but returned no rows.", last_sql, last_df

    return "I couldn't get a reliable answer. Try rephrasing the question.", last_sql, last_df