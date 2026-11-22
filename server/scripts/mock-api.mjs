// Tiny stand-in for the FastAPI service so you can demo the UI without Ollama/Postgres.
// Run: npm run mock-api   (listens on :8000, same contract as api.py)
import http from "node:http";

const canned = [
  { match: /monthly revenue/i, answer: "Revenue grew steadily through 2025, peaking in December.", sql: "SELECT to_char(order_date,'YYYY-MM') AS month, SUM(price*quantity) AS revenue FROM orders JOIN order_items USING(order_id) JOIN products USING(product_id) WHERE status='completed' GROUP BY 1 ORDER BY 1 LIMIT 100",
    rows: ["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => ({ month: `2025-${m}`, revenue: 42000 + i * 3100 + (i % 3) * 1700 })) },
  { match: /city/i, answer: "Pune has the most customers (31).", sql: "SELECT city, COUNT(*) AS customers FROM customers GROUP BY city ORDER BY customers DESC LIMIT 5",
    rows: [{ city: "Pune", customers: 31 }, { city: "Mumbai", customers: 28 }, { city: "Delhi", customers: 24 }, { city: "Bengaluru", customers: 22 }, { city: "Chennai", customers: 19 }] },
  { match: /top 5 products/i, answer: "Here are the top 5 products by revenue in March 2025.", sql: "SELECT p.name, SUM(oi.price*oi.quantity) AS revenue FROM products p JOIN order_items oi USING(product_id) GROUP BY p.name ORDER BY revenue DESC LIMIT 5",
    rows: [{ name: "Laptop Stand", revenue: 18400 }, { name: "Mechanical Keyboard", revenue: 16250 }, { name: "USB-C Hub", revenue: 12900 }, { name: "Webcam", revenue: 9800 }, { name: "Desk Lamp", revenue: 7450 }] },
];

http.createServer((req, res) => {
  const send = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.url === "/health") return send(200, { status: "ok" });
  if (req.url === "/ask" && req.method === "POST") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const { question = "" } = JSON.parse(raw || "{}");
      if (/\b(delete|drop|truncate|update|insert)\b/i.test(question)) {
        return send(200, { answer: "I only have read-only access, so I can't change or delete data.", sql: null, rows: [] });
      }
      const hit = canned.find((c) => c.match.test(question));
      setTimeout(() => send(200, hit ? { answer: hit.answer, sql: hit.sql, rows: hit.rows } : { answer: "The query ran successfully and returned 0 rows.", sql: "SELECT 1 WHERE false", rows: [] }), 600);
    });
    return;
  }
  send(404, { detail: "Not found" });
}).listen(8000, () => console.log("Mock Text-to-SQL API on http://localhost:8000"));
