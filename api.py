import json

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from agent import ask

app = FastAPI(title="Text-to-SQL Agent API")


class Question(BaseModel):
    question: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ask")
def ask_endpoint(body: Question):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        answer, sql, df = ask(body.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    rows = []
    if df is not None:
        rows = json.loads(df.to_json(orient="records", date_format="iso"))

    return {"answer": answer, "sql": sql, "rows": rows}
