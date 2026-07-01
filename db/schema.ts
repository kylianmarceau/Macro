import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const profiles = sqliteTable(
  "profiles",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    sex: text("sex", { enum: ["female", "male"] }).notNull(),
    age: integer("age").notNull(),
    heightCm: real("height_cm").notNull(),
    weightKg: real("weight_kg").notNull(),
    activityLevel: text("activity_level", {
      enum: ["sedentary", "light", "moderate", "active", "very_active"],
    }).notNull(),
    goal: text("goal", { enum: ["lose", "maintain", "gain"] }).notNull(),
    weeklyChangeKg: real("weekly_change_kg").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
);

export const weightEntries = sqliteTable(
  "weight_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    weightKg: real("weight_kg").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userDateIdx: uniqueIndex("weight_entries_user_date_idx").on(
      table.userId,
      table.entryDate,
    ),
    userIdx: index("weight_entries_user_idx").on(table.userId),
  }),
);

export const meals = sqliteTable(
  "meals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eatenAt: text("eaten_at").notNull(),
    rawText: text("raw_text").notNull(),
    mealName: text("meal_name").notNull(),
    calories: real("calories").notNull().default(0),
    proteinG: real("protein_g").notNull().default(0),
    carbsG: real("carbs_g").notNull().default(0),
    fatG: real("fat_g").notNull().default(0),
    fiberG: real("fiber_g").notNull().default(0),
    sugarG: real("sugar_g").notNull().default(0),
    sodiumMg: real("sodium_mg").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userEatenAtIdx: index("meals_user_eaten_at_idx").on(
      table.userId,
      table.eatenAt,
    ),
  }),
);

export const mealItems = sqliteTable(
  "meal_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mealId: integer("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: text("quantity").notNull(),
    estimatedGrams: real("estimated_grams").notNull(),
    fdcId: integer("fdc_id"),
    sourceDescription: text("source_description"),
    calories: real("calories").notNull().default(0),
    proteinG: real("protein_g").notNull().default(0),
    carbsG: real("carbs_g").notNull().default(0),
    fatG: real("fat_g").notNull().default(0),
    fiberG: real("fiber_g").notNull().default(0),
    sugarG: real("sugar_g").notNull().default(0),
    sodiumMg: real("sodium_mg").notNull().default(0),
    confidence: real("confidence").notNull().default(0.5),
    note: text("note"),
  },
  (table) => ({
    mealIdx: index("meal_items_meal_idx").on(table.mealId),
  }),
);
