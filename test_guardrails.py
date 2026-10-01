from guardrails import validate, UnsafeSQL

SHOULD_BLOCK = [
    "DELETE FROM orders",
    "DROP TABLE orders",
    "SELECT 1; DELETE FROM orders",
    "DELETE FROM orders; COMMIT; SELECT * FROM orders",
    "UPDATE orders SET id = 1",
    "SELECT * FROM pg_user",
    "SELECT * INTO backup FROM orders",
    "SELECT pg_sleep(100)",
    "SELECT * FROM orders FOR UPDATE",
]
SHOULD_PASS = [
    "SELECT COUNT(*) FROM orders",
    "SELECT c.name, SUM(o.id) FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name",
    "WITH t AS (SELECT * FROM orders) SELECT * FROM t",
]

bad = 0
for sql in SHOULD_BLOCK:
    try:
        validate(sql)
        print("FAIL (not blocked):", sql); bad += 1
    except UnsafeSQL as e:
        print("OK blocked:", sql, "->", e)
for sql in SHOULD_PASS:
    try:
        validate(sql); print("OK allowed:", sql)
    except UnsafeSQL as e:
        print("FAIL (wrongly blocked):", sql, "->", e); bad += 1
print("\nAll good" if bad == 0 else f"\n{bad} problem(s)")