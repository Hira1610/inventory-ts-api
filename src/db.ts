import Database from "better-sqlite3";

export type DB = Database.Database;

export function createDb(file = process.env.DB_FILE || "inventory.db"): DB {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff'
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0),
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}
