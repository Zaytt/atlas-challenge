import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import { db, schema } from './db/index.js';
import type {
  EmployeeSummaryFilters,
  GlobalSummaryFilters,
} from './utils/validation.js';

const { countries, employees, payGroups, payrollCycles, payItems } = schema;

export type GlobalSummaryRow = {
  countryCode: string;
  countryName: string;
  currency: string;
  totalEarnings: number;
  totalDeductions: number;
  totalEmployerCost: number;
};

export type EmployeeSummaryRow = {
  employeeId: number;
  employeeName: string;
  countryCode: string;
  currency: string;
  totalEarnings: number;
  totalDeductions: number;
  totalEmployerCost: number;
};

function buildSummaryConditions(filters: GlobalSummaryFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.country !== undefined) {
    conditions.push(inArray(countries.code, filters.country));
  }
  if (filters.payGroupId !== undefined) {
    conditions.push(eq(payrollCycles.payGroupId, filters.payGroupId));
  }
  if (filters.periodStart !== undefined) {
    conditions.push(gte(payrollCycles.periodEnd, filters.periodStart));
  }
  if (filters.periodEnd !== undefined) {
    conditions.push(lte(payrollCycles.periodStart, filters.periodEnd));
  }
  if (filters.cutoffDate !== undefined) {
    conditions.push(eq(payrollCycles.cutoffDate, filters.cutoffDate));
  }
  if (filters.payDate !== undefined) {
    conditions.push(eq(payrollCycles.payDate, filters.payDate));
  }
  if (filters.status !== undefined) {
    conditions.push(eq(payrollCycles.status, filters.status));
  }

  return conditions;
}

export function buildGlobalSummary(
  filters: GlobalSummaryFilters = {},
): GlobalSummaryRow[] {
  const conditions = buildSummaryConditions(filters);

  return db
    .select({
      countryCode: countries.code,
      countryName: countries.name,
      currency: payItems.currency,
      totalEarnings:
        sql<number>`round(sum(case when ${payItems.type} = 'earning' then ${payItems.amount} else 0 end), 2)`.mapWith(
          Number,
        ),
      totalDeductions:
        sql<number>`round(sum(case when ${payItems.type} = 'deduction' then ${payItems.amount} else 0 end), 2)`.mapWith(
          Number,
        ),
      totalEmployerCost:
        sql<number>`round(sum(case when ${payItems.type} = 'employer_cost' then ${payItems.amount} else 0 end), 2)`.mapWith(
          Number,
        ),
    })
    .from(payItems)
    .innerJoin(
      payrollCycles,
      eq(payItems.payrollCycleId, payrollCycles.id),
    )
    .innerJoin(payGroups, eq(payrollCycles.payGroupId, payGroups.id))
    .innerJoin(countries, eq(payGroups.countryCode, countries.code))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(countries.code, countries.name, payItems.currency)
    .orderBy(asc(countries.code), asc(payItems.currency))
    .all();
}

export function buildEmployeeSummary(
  filters: EmployeeSummaryFilters = {},
): EmployeeSummaryRow[] {
  const conditions = buildSummaryConditions(filters);
  if (filters.employeeId !== undefined) {
    conditions.push(eq(payItems.employeeId, filters.employeeId));
  }

  return db
    .select({
      employeeId: employees.id,
      employeeName: employees.name,
      countryCode: employees.countryCode,
      currency: payItems.currency,
      totalEarnings:
        sql<number>`round(sum(case when ${payItems.type} = 'earning' then ${payItems.amount} else 0 end), 2)`.mapWith(
          Number,
        ),
      totalDeductions:
        sql<number>`round(sum(case when ${payItems.type} = 'deduction' then ${payItems.amount} else 0 end), 2)`.mapWith(
          Number,
        ),
      totalEmployerCost:
        sql<number>`round(sum(case when ${payItems.type} = 'employer_cost' then ${payItems.amount} else 0 end), 2)`.mapWith(
          Number,
        ),
    })
    .from(payItems)
    .innerJoin(employees, eq(payItems.employeeId, employees.id))
    .innerJoin(
      payrollCycles,
      eq(payItems.payrollCycleId, payrollCycles.id),
    )
    .innerJoin(payGroups, eq(payrollCycles.payGroupId, payGroups.id))
    .innerJoin(countries, eq(payGroups.countryCode, countries.code))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(
      employees.id,
      employees.name,
      employees.countryCode,
      payItems.currency,
    )
    .orderBy(asc(employees.id), asc(payItems.currency))
    .all();
}
