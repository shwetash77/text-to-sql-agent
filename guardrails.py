"""Layer 1 of safety: validate SQL BEFORE it touches the database."""
import sqlglot
from sqlglot import exp

ALLOWED_TABLES = {"customers", "products", "orders", "order_items"}
FORBIDDEN = (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create, exp.Alter)


class UnsafeSQL(Exception):
    pass


def validate(sql: str, max_rows: int = 500) -> str:
    try:
        statements = sqlglot.parse(sql, read="postgres")
    except sqlglot.errors.SqlglotError as e:
        raise UnsafeSQL(f"Could not parse SQL: {e}")

    if len(statements) != 1 or statements[0] is None:
        raise UnsafeSQL("Exactly one statement is allowed.")
    tree = statements[0]

    if not isinstance(tree, (exp.Select, exp.Union)):
        raise UnsafeSQL("Only SELECT queries are allowed.")
    if tree.find(*FORBIDDEN):
        raise UnsafeSQL("Data-modifying statements are not allowed.")
    if tree.find(exp.Into, exp.Lock):
        raise UnsafeSQL("SELECT INTO and row locking are not allowed.")
    for f in tree.find_all(exp.Anonymous):
        if f.name.lower().startswith(("pg_", "lo_", "dblink")):
            raise UnsafeSQL(f"Function '{f.name}' is not allowed.")

    cte_names = {c.alias for c in tree.find_all(exp.CTE)}
    for t in tree.find_all(exp.Table):
        if t.name not in ALLOWED_TABLES | cte_names:
            raise UnsafeSQL(f"Table '{t.name}' is not allowed.")

    if not tree.args.get("limit"):
        tree = tree.limit(max_rows)
    return tree.sql(dialect="postgres")