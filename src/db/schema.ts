import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// TODO all tables could benefit from a created_at and updated_at field
// TODO autoIncrement primary key is something that could be debated, it could be better to use a UUID or a more secure primary key. Autoincrement brings speed while a UUID would be more secure.

export const countries = sqliteTable('countries', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
});

// TODO no foreign key constraint on countryCode
export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull().references(() => countries.code),
});

export const payGroups = sqliteTable('pay_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  countryCode: text('country_code').notNull().references(() => countries.code),
  name: text('name').notNull(),
  payFrequency: text('pay_frequency').notNull(),
  currency: text('currency').notNull(),
});

export const payrollCycles = sqliteTable('payroll_cycles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payGroupId: integer('pay_group_id').notNull().references(() => payGroups.id),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  cutoffDate: text('cutoff_date'),
  payDate: integer('pay_date'),
  status: text('status').notNull().default('draft'),
});

export const payItems = sqliteTable('pay_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  payrollCycleId: integer('payroll_cycle_id').notNull().references(() => payrollCycles.id),
  employeeId: integer('employee_id').notNull(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
});

export const countriesRelations = relations(countries, ({ many }) => ({
  payGroups: many(payGroups),
}));

export const payGroupsRelations = relations(payGroups, ({ one, many }) => ({
  country: one(countries, { fields: [payGroups.countryCode], references: [countries.code] }),
  cycles: many(payrollCycles),
}));

export const payrollCyclesRelations = relations(payrollCycles, ({ one, many }) => ({
  payGroup: one(payGroups, { fields: [payrollCycles.payGroupId], references: [payGroups.id] }),
  items: many(payItems),
}));

export const payItemsRelations = relations(payItems, ({ one }) => ({
  cycle: one(payrollCycles, { fields: [payItems.payrollCycleId], references: [payrollCycles.id] }),
}));
