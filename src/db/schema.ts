import { pgTable, serial, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const geese = pgTable('geese', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});