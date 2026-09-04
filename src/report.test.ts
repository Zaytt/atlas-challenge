import { describe, expect, it } from 'vitest';
import { db, schema, sqlite } from './db/index.js';
import {
  buildEmployeeSummary,
  buildGlobalSummary,
  type EmployeeSummaryRow,
  type GlobalSummaryRow,
} from './report.js';
import type {
  EmployeeSummaryFilters,
  GlobalSummaryFilters,
} from './utils/validation.js';

const { payItems } = schema;

const EXPECTED_SUMMARY = [
  {
    countryCode: 'DE',
    countryName: 'Germany',
    currency: 'EUR',
    totalEarnings: 8083.33,
    totalDeductions: 1579.17,
    totalEmployerCost: 650.12,
  },
  {
    countryCode: 'GB',
    countryName: 'United Kingdom',
    currency: 'GBP',
    totalEarnings: 7000.1,
    totalDeductions: 1400.02,
    totalEmployerCost: 585,
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    currency: 'USD',
    totalEarnings: 9758.89,
    totalDeductions: 1951.78,
    totalEmployerCost: 697.58,
  },
] satisfies GlobalSummaryRow[];

const EXPECTED_US_PAY_GROUP_3 = {
  countryCode: 'US',
  countryName: 'United States',
  currency: 'USD',
  totalEarnings: 5208.34,
  totalDeductions: 1041.67,
  totalEmployerCost: 375,
} satisfies GlobalSummaryRow;

const EXPECTED_US_PAY_GROUP_4 = {
  countryCode: 'US',
  countryName: 'United States',
  currency: 'USD',
  totalEarnings: 4550.55,
  totalDeductions: 910.11,
  totalEmployerCost: 322.58,
} satisfies GlobalSummaryRow;

const MATCHING_US_FILTERS: GlobalSummaryFilters = {
  country: ['US'],
  payGroupId: 3,
  periodStart: '2026-05-10',
  periodEnd: '2026-05-20',
  cutoffDate: '2026-05-12',
  payDate: 1779408000,
  status: 'approved',
};

const EXPECTED_EMPLOYEE_SUMMARY = [
  {
    employeeId: 1,
    employeeName: 'Anke Weber',
    countryCode: 'DE',
    currency: 'EUR',
    totalEarnings: 4333.33,
    totalDeductions: 866.67,
    totalEmployerCost: 650.12,
  },
  {
    employeeId: 2,
    employeeName: 'Lukas Braun',
    countryCode: 'DE',
    currency: 'EUR',
    totalEarnings: 3750,
    totalDeductions: 712.5,
    totalEmployerCost: 0,
  },
  {
    employeeId: 3,
    employeeName: 'Olivia Shah',
    countryCode: 'GB',
    currency: 'GBP',
    totalEarnings: 3900.1,
    totalDeductions: 780.02,
    totalEmployerCost: 585,
  },
  {
    employeeId: 4,
    employeeName: 'Tom Reed',
    countryCode: 'GB',
    currency: 'GBP',
    totalEarnings: 3100,
    totalDeductions: 620,
    totalEmployerCost: 0,
  },
  {
    employeeId: 5,
    employeeName: 'Maria Ruiz',
    countryCode: 'US',
    currency: 'USD',
    totalEarnings: 2500,
    totalDeductions: 500,
    totalEmployerCost: 375,
  },
  {
    employeeId: 6,
    employeeName: 'James Cole',
    countryCode: 'US',
    currency: 'USD',
    totalEarnings: 2708.34,
    totalDeductions: 541.67,
    totalEmployerCost: 0,
  },
  {
    employeeId: 7,
    employeeName: 'Priya Nair',
    countryCode: 'US',
    currency: 'USD',
    totalEarnings: 2400,
    totalDeductions: 480,
    totalEmployerCost: 0,
  },
  {
    employeeId: 8,
    employeeName: 'Dan Kim',
    countryCode: 'US',
    currency: 'USD',
    totalEarnings: 2150.55,
    totalDeductions: 430.11,
    totalEmployerCost: 322.58,
  },
] satisfies EmployeeSummaryRow[];

const MATCHING_EMPLOYEE_FILTERS: EmployeeSummaryFilters = {
  ...MATCHING_US_FILTERS,
  employeeId: 5,
};

describe('buildGlobalSummary', () => {
  it('returns exact totals ordered by country and currency', () => {
    expect(buildGlobalSummary()).toEqual(EXPECTED_SUMMARY);
  });

  it('filters by one or more countries', () => {
    expect(buildGlobalSummary({ country: ['DE', 'US'] })).toEqual([
      EXPECTED_SUMMARY[0],
      EXPECTED_SUMMARY[2],
    ]);
  });

  it('rounds every monetary total to at most two decimal places', () => {
    const rows = buildGlobalSummary();
    for (const row of rows) {
      for (const total of [
        row.totalEarnings,
        row.totalDeductions,
        row.totalEmployerCost,
      ]) {
        expect(total).toBe(Number(total.toFixed(2)));
      }
    }
    expect(rows[2].totalEmployerCost).toBe(697.58);
  });

  it('filters by pay group', () => {
    expect(buildGlobalSummary({ payGroupId: 4 })).toEqual([
      EXPECTED_US_PAY_GROUP_4,
    ]);
  });

  it('uses an inclusive lower period bound against cycle end dates', () => {
    expect(buildGlobalSummary({ periodStart: '2026-05-31' })).toEqual([
      EXPECTED_SUMMARY[0],
      EXPECTED_SUMMARY[1],
    ]);
  });

  it('uses an inclusive upper period bound against cycle start dates', () => {
    expect(buildGlobalSummary({ periodEnd: '2026-05-03' })).toEqual([
      EXPECTED_SUMMARY[0],
      EXPECTED_SUMMARY[1],
      EXPECTED_US_PAY_GROUP_3,
    ]);

    expect(buildGlobalSummary({ periodEnd: '2026-05-04' })).toEqual(
      EXPECTED_SUMMARY,
    );
  });

  it('includes only cycles that overlap both period bounds', () => {
    expect(
      buildGlobalSummary({
        periodStart: '2026-05-16',
        periodEnd: '2026-05-20',
      }),
    ).toEqual([
      EXPECTED_SUMMARY[0],
      EXPECTED_SUMMARY[1],
      EXPECTED_US_PAY_GROUP_4,
    ]);
  });

  it('filters cutoffDate by exact match', () => {
    sqlite.exec('BEGIN');
    try {
      db.insert(payItems)
        .values({
          payrollCycleId: 2,
          employeeId: 1,
          type: 'earning',
          amount: 99,
          currency: 'EUR',
        })
        .run();

      expect(buildGlobalSummary({ cutoffDate: '2026-05-25' })).toEqual([
        EXPECTED_SUMMARY[0],
        EXPECTED_SUMMARY[1],
      ]);
    } finally {
      sqlite.exec('ROLLBACK');
    }
  });

  it('filters payDate by exact match', () => {
    expect(buildGlobalSummary({ payDate: 1779408000 })).toEqual([
      EXPECTED_US_PAY_GROUP_3,
    ]);
  });

  it('filters by status and includes matching draft items', () => {
    sqlite.exec('BEGIN');
    try {
      db.insert(payItems)
        .values({
          payrollCycleId: 2,
          employeeId: 1,
          type: 'earning',
          amount: 123.45,
          currency: 'EUR',
        })
        .run();

      expect(buildGlobalSummary({ status: 'draft' })).toEqual([
        {
          countryCode: 'DE',
          countryName: 'Germany',
          currency: 'EUR',
          totalEarnings: 123.45,
          totalDeductions: 0,
          totalEmployerCost: 0,
        },
      ]);
      expect(buildGlobalSummary({ status: 'approved' })).toEqual(
        EXPECTED_SUMMARY,
      );
      expect(buildGlobalSummary()).toEqual([
        { ...EXPECTED_SUMMARY[0], totalEarnings: 8206.78 },
        EXPECTED_SUMMARY[1],
        EXPECTED_SUMMARY[2],
      ]);
    } finally {
      sqlite.exec('ROLLBACK');
    }
  });

  it('returns the known cycle when every supplied filter matches', () => {
    expect(buildGlobalSummary(MATCHING_US_FILTERS)).toEqual([
      EXPECTED_US_PAY_GROUP_3,
    ]);
  });

  it.each([
    ['country', { ...MATCHING_US_FILTERS, country: ['DE'] }],
    ['payGroupId', { ...MATCHING_US_FILTERS, payGroupId: 4 }],
    [
      'periodStart',
      { ...MATCHING_US_FILTERS, periodStart: '2026-05-16' },
    ],
    ['periodEnd', { ...MATCHING_US_FILTERS, periodEnd: '2026-04-30' }],
    [
      'cutoffDate',
      { ...MATCHING_US_FILTERS, cutoffDate: '2026-05-14' },
    ],
    ['payDate', { ...MATCHING_US_FILTERS, payDate: 1780704000 }],
    ['status', { ...MATCHING_US_FILTERS, status: 'draft' as const }],
  ] satisfies [string, GlobalSummaryFilters][])(
    'requires %s to match when filters are combined with AND',
    (_filterName, filters) => {
      expect(buildGlobalSummary(filters)).toEqual([]);
    },
  );

  it('returns an empty array for valid filters with no matching data', () => {
    expect(buildGlobalSummary({ country: ['US'], payGroupId: 1 })).toEqual([]);
  });

  it('keeps country/currency pairs separate and attributes country through the pay group', () => {
    sqlite.exec('BEGIN');
    try {
      db.insert(payItems)
        .values({
          payrollCycleId: 1,
          employeeId: 5,
          type: 'earning',
          amount: 123.45,
          currency: 'USD',
        })
        .run();

      expect(buildGlobalSummary()).toEqual([
        EXPECTED_SUMMARY[0],
        {
          countryCode: 'DE',
          countryName: 'Germany',
          currency: 'USD',
          totalEarnings: 123.45,
          totalDeductions: 0,
          totalEmployerCost: 0,
        },
        EXPECTED_SUMMARY[1],
        EXPECTED_SUMMARY[2],
      ]);
    } finally {
      sqlite.exec('ROLLBACK');
    }
  });
});

describe('buildEmployeeSummary', () => {
  it('returns exact totals ordered by employee and currency', () => {
    expect(buildEmployeeSummary()).toEqual(EXPECTED_EMPLOYEE_SUMMARY);
  });

  it('returns numeric totals rounded to at most two decimal places', () => {
    for (const row of buildEmployeeSummary()) {
      for (const total of [
        row.totalEarnings,
        row.totalDeductions,
        row.totalEmployerCost,
      ]) {
        expect(total).toBe(Number(total.toFixed(2)));
      }
    }
  });

  it.each([
    ['country', { country: ['US'] }, EXPECTED_EMPLOYEE_SUMMARY.slice(4)],
    ['payGroupId', { payGroupId: 3 }, EXPECTED_EMPLOYEE_SUMMARY.slice(4, 6)],
    [
      'periodStart',
      { periodStart: '2026-05-31' },
      EXPECTED_EMPLOYEE_SUMMARY.slice(0, 4),
    ],
    [
      'periodEnd',
      { periodEnd: '2026-05-03' },
      EXPECTED_EMPLOYEE_SUMMARY.slice(0, 6),
    ],
    [
      'cutoffDate',
      { cutoffDate: '2026-05-12' },
      EXPECTED_EMPLOYEE_SUMMARY.slice(4, 6),
    ],
    [
      'payDate',
      { payDate: 1779408000 },
      EXPECTED_EMPLOYEE_SUMMARY.slice(4, 6),
    ],
    ['status', { status: 'approved' }, EXPECTED_EMPLOYEE_SUMMARY],
  ] satisfies [
    string,
    EmployeeSummaryFilters,
    EmployeeSummaryRow[],
  ][])('applies the shared %s filter', (_name, filters, expected) => {
    expect(buildEmployeeSummary(filters)).toEqual(expected);
  });

  it('filters by employeeId', () => {
    expect(buildEmployeeSummary({ employeeId: 5 })).toEqual([
      EXPECTED_EMPLOYEE_SUMMARY[4],
    ]);
  });

  it('combines all filters with AND semantics', () => {
    expect(buildEmployeeSummary(MATCHING_EMPLOYEE_FILTERS)).toEqual([
      EXPECTED_EMPLOYEE_SUMMARY[4],
    ]);
    expect(
      buildEmployeeSummary({
        ...MATCHING_EMPLOYEE_FILTERS,
        employeeId: 7,
      }),
    ).toEqual([]);
  });

  it('returns an empty array for valid filters with no matching data', () => {
    expect(
      buildEmployeeSummary({ country: ['US'], payGroupId: 1 }),
    ).toEqual([]);
  });

  it('separates employee currencies and keeps the employee home country', () => {
    sqlite.exec('BEGIN');
    try {
      db.insert(payItems)
        .values({
          payrollCycleId: 1,
          employeeId: 5,
          type: 'earning',
          amount: 10.005,
          currency: 'EUR',
        })
        .run();

      expect(buildEmployeeSummary({ employeeId: 5 })).toEqual([
        {
          employeeId: 5,
          employeeName: 'Maria Ruiz',
          countryCode: 'US',
          currency: 'EUR',
          totalEarnings: 10.01,
          totalDeductions: 0,
          totalEmployerCost: 0,
        },
        EXPECTED_EMPLOYEE_SUMMARY[4],
      ]);
      expect(
        buildEmployeeSummary({ country: ['DE'], employeeId: 5 }),
      ).toEqual([
        {
          employeeId: 5,
          employeeName: 'Maria Ruiz',
          countryCode: 'US',
          currency: 'EUR',
          totalEarnings: 10.01,
          totalDeductions: 0,
          totalEmployerCost: 0,
        },
      ]);
    } finally {
      sqlite.exec('ROLLBACK');
    }
  });
});
