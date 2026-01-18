import { relations, sql } from "drizzle-orm";
import { index, primaryKey, sqliteTableCreator } from "drizzle-orm/sqlite-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = sqliteTableCreator(
  (name) => `proyeccion-financiera_${name}`,
);

export const categoryTypeEnum = ["income", "expense", "savings"] as const;
export const transactionStatusEnum = [
  "PENDING",
  "ESTIMATED",
  "CONFIRMED",
  "PAID",
] as const;

export const categories = createTable("category", (d) => ({
  id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  name: d.text({ length: 255 }).notNull(),
  type: d.text({ enum: categoryTypeEnum }).notNull(),
  userId: d.text({ length: 255 }).notNull(),
  // .references(() => users.id),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}));

export const items = createTable("item", (d) => ({
  id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  name: d.text({ length: 255 }).notNull(),
  categoryId: d
    .integer({ mode: "number" })
    .notNull()
    .references(() => categories.id),
  isRecurring: d.integer({ mode: "boolean" }).default(true),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}));

export const transactions = createTable("transaction", (d) => ({
  id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  itemId: d
    .integer({ mode: "number" })
    .notNull()
    .references(() => items.id),
  amount: d.real().notNull().default(0),
  projectedAmount: d.real(),
  dueDate: d.integer({ mode: "timestamp" }).notNull(),
  status: d
    .text({ enum: transactionStatusEnum })
    .notNull()
    .default("ESTIMATED"),
  isInvestment: d.integer({ mode: "boolean" }).default(false),
  installmentNumber: d.integer(),
  totalInstallments: d.integer(),
  description: d.text(),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: d.integer({ mode: "timestamp" }).$onUpdate(() => new Date()),
}));

export const savingsConfig = createTable("savings_config", (d) => ({
  id: d.integer({ mode: "number" }).primaryKey({ autoIncrement: true }),
  name: d.text({ length: 255 }).notNull(),
  percentage: d.real().notNull(), // e.g., 0.20 for 20%
  userId: d.text({ length: 255 }).notNull(),
  // .references(() => users.id),
  createdAt: d
    .integer({ mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}));

// Relations
export const categoriesRelations = relations(categories, ({ many, one }) => ({
  items: many(items),
  user: one(users, { fields: [categories.userId], references: [users.id] }),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(categories, {
    fields: [items.categoryId],
    references: [categories.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  item: one(items, { fields: [transactions.itemId], references: [items.id] }),
}));

export const savingsConfigRelations = relations(savingsConfig, ({ one }) => ({
  user: one(users, { fields: [savingsConfig.userId], references: [users.id] }),
}));

// Original Auth Tables
export const users = createTable("user", (d) => ({
  id: d
    .text({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.text({ length: 255 }),
  email: d.text({ length: 255 }).notNull(),
  emailVerified: d.integer({ mode: "timestamp" }).default(sql`(unixepoch())`),
  image: d.text({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  savingsConfigs: many(savingsConfig),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.text({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.text({ length: 255 }).notNull(),
    providerAccountId: d.text({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.text({ length: 255 }),
    scope: d.text({ length: 255 }),
    id_token: d.text(),
    session_state: d.text({ length: 255 }),
  }),
  (t) => [
    primaryKey({
      columns: [t.provider, t.providerAccountId],
    }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.text({ length: 255 }).notNull().primaryKey(),
    userId: d
      .text({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.integer({ mode: "timestamp" }).notNull(),
  }),
  (t) => [index("session_userId_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.text({ length: 255 }).notNull(),
    token: d.text({ length: 255 }).notNull(),
    expires: d.integer({ mode: "timestamp" }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);
