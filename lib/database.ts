import { getRuntimeBinding } from "./runtime-env";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER PRIMARY KEY,
    sex TEXT NOT NULL,
    age INTEGER NOT NULL,
    height_cm REAL NOT NULL,
    weight_kg REAL NOT NULL,
    activity_level TEXT NOT NULL,
    goal TEXT NOT NULL,
    weekly_change_kg REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS weight_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    entry_date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, entry_date)
  )`,
  `CREATE INDEX IF NOT EXISTS weight_entries_user_idx ON weight_entries(user_id)`,
  `CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    eaten_at TEXT NOT NULL,
    raw_text TEXT NOT NULL,
    meal_name TEXT NOT NULL,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    fiber_g REAL NOT NULL DEFAULT 0,
    sugar_g REAL NOT NULL DEFAULT 0,
    sodium_mg REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS meals_user_eaten_at_idx ON meals(user_id, eaten_at)`,
  `CREATE TABLE IF NOT EXISTS meal_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meal_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    estimated_grams REAL NOT NULL,
    fdc_id INTEGER,
    source_description TEXT,
    calories REAL NOT NULL DEFAULT 0,
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    fiber_g REAL NOT NULL DEFAULT 0,
    sugar_g REAL NOT NULL DEFAULT 0,
    sodium_mg REAL NOT NULL DEFAULT 0,
    confidence REAL NOT NULL DEFAULT 0.5,
    note TEXT,
    FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS meal_items_meal_idx ON meal_items(meal_id)`,
];

let schemaReady: Promise<void> | null = null;

export type UserRecord = {
  id: number;
  email: string;
  displayName: string;
};

export function getD1() {
  const db = getRuntimeBinding<D1Database>("DB");
  if (!db) {
    throw new Error(
      "D1 binding `DB` is unavailable. Confirm .openai/hosting.json uses d1: DB and the local/hosted runtime has a database binding.",
    );
  }
  return db;
}

export async function ensureDatabase() {
  if (!schemaReady) {
    const db = getD1();
    schemaReady = db
      .batch(schemaStatements.map((statement) => db.prepare(statement)))
      .then(() => undefined);
  }
  await schemaReady;
}

export async function ensureUser(email: string, displayName: string) {
  await ensureDatabase();
  const db = getD1();
  await db
    .prepare(
      `INSERT INTO users (email, display_name)
       VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(email, displayName)
    .run();

  const user = await db
    .prepare("SELECT id, email, display_name as displayName FROM users WHERE email = ?")
    .bind(email)
    .first<UserRecord>();

  if (!user) throw new Error("Unable to load the signed-in user record.");
  return user;
}
