import bcrypt from "bcryptjs";
import express, { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AuthedRequest, requireAdmin, requireAuth, signToken } from "./auth";
import { DB } from "./db";

const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });
const productInput = z.object({
  sku: z.string().min(2).max(40),
  name: z.string().min(1).max(120),
  price: z.number().nonnegative(),
  quantity: z.number().int().nonnegative().default(0),
});
const stockInput = z.object({ change: z.number().int().refine((n) => n !== 0, "change must not be 0") });

export function createApp(db: DB) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.post("/auth/register", (req, res) => {
    const data = credentials.parse(req.body);
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(data.email);
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const isFirst = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c === 0;
    const hash = bcrypt.hashSync(data.password, 10);
    const info = db.prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)")
      .run(data.email, hash, isFirst ? "admin" : "staff");
    res.status(201).json({ id: info.lastInsertRowid, email: data.email, role: isFirst ? "admin" : "staff" });
  });

  app.post("/auth/login", (req, res) => {
    const data = credentials.parse(req.body);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(data.email) as any;
    if (!user || !bcrypt.compareSync(data.password, user.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ token: signToken({ id: user.id, email: user.email, role: user.role }) });
  });

  app.get("/products", requireAuth, (req, res) => {
    const q = String(req.query.search || "");
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const like = `%${q}%`;
    const total = (db.prepare("SELECT COUNT(*) AS c FROM products WHERE name LIKE ? OR sku LIKE ?").get(like, like) as { c: number }).c;
    const items = db.prepare("SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?")
      .all(like, like, limit, (page - 1) * limit);
    res.json({ page, limit, total, items });
  });

  app.get("/products/low-stock", requireAuth, (req, res) => {
    const threshold = Number(req.query.threshold) || 5;
    res.json(db.prepare("SELECT * FROM products WHERE quantity <= ? ORDER BY quantity ASC").all(threshold));
  });

  app.get("/products/:id", requireAuth, (req, res) => {
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found" });
    res.json(p);
  });

  app.post("/products", requireAuth, requireAdmin, (req: AuthedRequest, res) => {
    const d = productInput.parse(req.body);
    try {
      const info = db.prepare("INSERT INTO products (sku, name, price, quantity) VALUES (?, ?, ?, ?)")
        .run(d.sku, d.name, d.price, d.quantity);
      res.status(201).json(db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid));
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) return res.status(409).json({ error: "SKU already exists" });
      throw e;
    }
  });

  app.patch("/products/:id/stock", requireAuth, (req, res) => {
    const { change } = stockInput.parse(req.body);
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) as any;
    if (!p) return res.status(404).json({ error: "Product not found" });
    if (p.quantity + change < 0) return res.status(400).json({ error: "Insufficient stock" });
    db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(change, p.id);
    res.json(db.prepare("SELECT * FROM products WHERE id = ?").get(p.id));
  });

  app.delete("/products/:id", requireAuth, requireAdmin, (req, res) => {
    const info = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: "Product not found" });
    res.status(204).end();
  });

  // Central error handler: validation errors -> 400, everything else -> 500
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.issues });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });
  return app;
}
