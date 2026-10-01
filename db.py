"""Layer 2 of safety: read-only transaction + timeout, even if validation is bypassed."""
import os
from decimal import Decimal
import pandas as pd
import psycopg


def run_query(sql: str) -> pd.DataFrame:
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute("SET LOCAL statement_timeout = 5000")  # 5 seconds
            cur.execute(sql)
            cols = [d.name for d in cur.description]
            rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=cols)
    for c in df.columns:  # Postgres NUMERIC arrives as Decimal; make it chartable
        if len(df) and isinstance(df[c].iloc[0], Decimal):
            df[c] = df[c].astype(float)
    return df


def get_schema() -> str:
    q = """SELECT table_name, column_name, data_type FROM information_schema.columns
           WHERE table_schema='public' ORDER BY table_name, ordinal_position"""
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
        cur.execute(q)
        tables = {}
        for t, c, d in cur.fetchall():
            tables.setdefault(t, []).append(f"{c} ({d})")
    return "\n".join(f"{t}: {', '.join(cols)}" for t, cols in tables.items())
