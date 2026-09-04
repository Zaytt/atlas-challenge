import { getTableColumns, type InferInsertModel, type InferSelectModel, type Table } from 'drizzle-orm';
import { countries, employees, payGroups, payrollCycles, payItems } from './schema.js';

export type Country = InferSelectModel<typeof countries>;
export type NewCountry = InferInsertModel<typeof countries>;

export type Employee = InferSelectModel<typeof employees>;
export type NewEmployee = InferInsertModel<typeof employees>;

export type PayGroup = InferSelectModel<typeof payGroups>;
export type NewPayGroup = InferInsertModel<typeof payGroups>;

export type PayrollCycle = InferSelectModel<typeof payrollCycles>;
export type NewPayrollCycle = InferInsertModel<typeof payrollCycles>;

export type PayItem = InferSelectModel<typeof payItems>;
export type NewPayItem = InferInsertModel<typeof payItems>;

type TableColumns<T extends Table> = T['_']['columns'];
type SqlNameOf<T extends Table> = TableColumns<T>[keyof TableColumns<T>]['_']['name'];

/** SQL column name → Drizzle column ref, derived from a table definition. */
export function sqlColumnsOf<T extends Table>(table: T) {
  const columns = getTableColumns(table);
  const bySqlName: Record<string, TableColumns<T>[keyof TableColumns<T>]> = {};
  for (const column of Object.values(columns)) {
    bySqlName[column.name] = column as TableColumns<T>[keyof TableColumns<T>];
  }
  return bySqlName as Record<SqlNameOf<T>, TableColumns<T>[keyof TableColumns<T>]>;
}

export const payItemSqlColumns = sqlColumnsOf(payItems);
export type PayItemSqlColumn = SqlNameOf<typeof payItems>;

export function isPayItemSqlColumn(value: string): value is PayItemSqlColumn {
  return Object.hasOwn(payItemSqlColumns, value);
}
