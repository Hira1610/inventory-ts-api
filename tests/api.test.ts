import request from "supertest";
import { createApp } from "../src/app";
import { createDb } from "../src/db";

const PASS = "password123";
let app: ReturnType<typeof createApp>;
let adminToken: string;
let staffToken: string;

async function register(email: string) {
  await request(app).post("/auth/register").send({ email, password: PASS });
  const r = await request(app).post("/auth/login").send({ email, password: PASS });
  return r.body.token as string;
}

beforeEach(async () => {
  app = createApp(createDb(":memory:"));
  adminToken = await register("admin@shop.com"); // first user becomes admin
  staffToken = await register("staff@shop.com");
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const newProduct = (over = {}) => ({ sku: "SKU-1", name: "Keyboard", price: 25.5, quantity: 10, ...over });

test("health check", async () => {
  expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
});

test("first user is admin, second is staff", async () => {
  const dup = await request(app).post("/auth/register").send({ email: "staff@shop.com", password: PASS });
  expect(dup.status).toBe(409);
});

test("rejects invalid registration", async () => {
  const r = await request(app).post("/auth/register").send({ email: "bad", password: "short" });
  expect(r.status).toBe(400);
});

test("login fails with wrong password", async () => {
  const r = await request(app).post("/auth/login").send({ email: "admin@shop.com", password: "wrongpass1" });
  expect(r.status).toBe(401);
});

test("products require a token", async () => {
  expect((await request(app).get("/products")).status).toBe(401);
});

test("admin can create, staff cannot", async () => {
  expect((await request(app).post("/products").set(auth(staffToken)).send(newProduct())).status).toBe(403);
  const r = await request(app).post("/products").set(auth(adminToken)).send(newProduct());
  expect(r.status).toBe(201);
  expect(r.body.name).toBe("Keyboard");
});

test("duplicate SKU returns 409", async () => {
  await request(app).post("/products").set(auth(adminToken)).send(newProduct());
  const r = await request(app).post("/products").set(auth(adminToken)).send(newProduct());
  expect(r.status).toBe(409);
});

test("validates product body", async () => {
  const r = await request(app).post("/products").set(auth(adminToken)).send(newProduct({ price: -5 }));
  expect(r.status).toBe(400);
});

test("search and pagination", async () => {
  for (let i = 1; i <= 12; i++) {
    await request(app).post("/products").set(auth(adminToken)).send(newProduct({ sku: `S-${i}`, name: i % 2 ? "Mouse" : "Monitor" }));
  }
  const all = await request(app).get("/products?limit=5&page=2").set(auth(staffToken));
  expect(all.body.items).toHaveLength(5);
  expect(all.body.total).toBe(12);
  const mice = await request(app).get("/products?search=Mouse").set(auth(staffToken));
  expect(mice.body.total).toBe(6);
});

test("stock update works and cannot go below zero", async () => {
  const p = (await request(app).post("/products").set(auth(adminToken)).send(newProduct({ quantity: 3 }))).body;
  const ok = await request(app).patch(`/products/${p.id}/stock`).set(auth(staffToken)).send({ change: -2 });
  expect(ok.body.quantity).toBe(1);
  const bad = await request(app).patch(`/products/${p.id}/stock`).set(auth(staffToken)).send({ change: -5 });
  expect(bad.status).toBe(400);
});

test("low-stock report", async () => {
  await request(app).post("/products").set(auth(adminToken)).send(newProduct({ sku: "SKU-A", quantity: 2 }));
  await request(app).post("/products").set(auth(adminToken)).send(newProduct({ sku: "SKU-B", quantity: 50 }));
  const r = await request(app).get("/products/low-stock?threshold=5").set(auth(staffToken));
  expect(r.body).toHaveLength(1);
  expect(r.body[0].sku).toBe("SKU-A");
});

test("delete is admin only and 404 for missing", async () => {
  const p = (await request(app).post("/products").set(auth(adminToken)).send(newProduct())).body;
  expect((await request(app).delete(`/products/${p.id}`).set(auth(staffToken))).status).toBe(403);
  expect((await request(app).delete(`/products/${p.id}`).set(auth(adminToken))).status).toBe(204);
  expect((await request(app).delete(`/products/${p.id}`).set(auth(adminToken))).status).toBe(404);
});
