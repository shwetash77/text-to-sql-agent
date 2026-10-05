import pytest

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


@pytest.mark.parametrize("sql", SHOULD_BLOCK)
def test_dangerous_sql_is_blocked(sql):
    with pytest.raises(UnsafeSQL):
        validate(sql)


@pytest.mark.parametrize("sql", SHOULD_PASS)
def test_safe_select_is_allowed(sql):
    validate(sql)
