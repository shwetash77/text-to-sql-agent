"""Fill the database with fake data. Run once: python seed.py"""

import datetime as dt
import os
import random

import psycopg

random.seed(42)
cities = ["Patna", "Delhi", "Mumbai", "Bengaluru", "Noida", "Kolkata"]
cats = {"Electronics": 5000, "Books": 400, "Clothing": 1200, "Home": 2000}
statuses = ["completed"] * 8 + ["cancelled", "returned"]

with psycopg.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
    cur.execute(open("schema.sql").read())
    for i in range(1, 201):
        cur.execute(
            "INSERT INTO customers(name, city, signup_date) VALUES (%s,%s,%s)",
            (f"Customer {i}", random.choice(cities), dt.date(2024, 1, 1) + dt.timedelta(days=random.randint(0, 600))),
        )
    for i in range(1, 31):
        cat = random.choice(list(cats))
        cur.execute(
            "INSERT INTO products(name, category, price) VALUES (%s,%s,%s)",
            (f"{cat} Item {i}", cat, round(cats[cat] * random.uniform(0.3, 1.5), 2)),
        )
    for _ in range(3000):
        cur.execute(
            "INSERT INTO orders(customer_id, order_date, status) VALUES (%s,%s,%s) RETURNING id",
            (
                random.randint(1, 200),
                dt.date(2025, 1, 1) + dt.timedelta(days=random.randint(0, 600)),
                random.choice(statuses),
            ),
        )
        oid = cur.fetchone()[0]
        for _ in range(random.randint(1, 4)):
            cur.execute(
                "INSERT INTO order_items(order_id, product_id, quantity) VALUES (%s,%s,%s)",
                (oid, random.randint(1, 30), random.randint(1, 5)),
            )
print("Seeded.")
