import { describe, expect, it } from 'vitest';
import {
  isCycleLocked,
  isIsoDate,
  isRecord,
  parseEmployeeSummaryFilters,
  parseFiniteNumberParam,
  parseGlobalSummaryFilters,
  parseJsonObjectBody,
  parsePayrollCycle,
  parsePositiveIntParam,
} from './validation.js';

describe('isCycleLocked', () => {
  it.each(['approved', 'paid'])('locks %s cycles', (status) => {
    expect(isCycleLocked(status)).toBe(true);
  });

  it.each(['draft', 'processing'])('keeps %s cycles writable', (status) => {
    expect(isCycleLocked(status)).toBe(false);
  });
});

describe('request validation', () => {
  it('accepts real ISO calendar dates and rejects impossible dates', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });

  it('accepts only positive integer path and query parameters', () => {
    expect(parsePositiveIntParam('42')).toBe(42);
    expect(parsePositiveIntParam('0')).toBeNull();
    expect(parsePositiveIntParam('1.5')).toBeNull();
    expect(parsePositiveIntParam(' 1')).toBeNull();
  });

  it('rejects empty and non-finite numeric query parameters', () => {
    expect(parseFiniteNumberParam('12.5')).toBe(12.5);
    expect(parseFiniteNumberParam('')).toBeNull();
    expect(parseFiniteNumberParam('Infinity')).toBeNull();
  });

  it('recognizes JSON objects but not arrays or null', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('parses JSON object request bodies', async () => {
    await expect(parseJsonObjectBody({ json: async () => ({ id: 1 }) })).resolves.toEqual({
      ok: true,
      value: { id: 1 },
    });
    await expect(parseJsonObjectBody({ json: async () => [] })).resolves.toEqual({
      ok: false,
      error: 'Invalid body',
    });
    await expect(
      parseJsonObjectBody({
        json: async () => {
          throw new SyntaxError('invalid JSON');
        },
      }),
    ).resolves.toEqual({ ok: false, error: 'Invalid JSON body' });
  });

  it('parses and normalizes payroll cycle input', () => {
    expect(
      parsePayrollCycle({
        payGroupId: 1,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
      }),
    ).toEqual({
      ok: true,
      value: {
        payGroupId: 1,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        cutoffDate: null,
        payDate: null,
        items: undefined,
      },
    });
  });
});

describe('global summary filter validation', () => {
  it('accepts omitted filters', () => {
    expect(parseGlobalSummaryFilters({})).toEqual({ ok: true, value: {} });
  });

  it('normalizes and deduplicates country codes and parses all filters', () => {
    expect(
      parseGlobalSummaryFilters({
        country: ' de, US,de ',
        payGroupId: '3',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        cutoffDate: '2026-05-12',
        payDate: '1779408000',
        status: 'approved',
      }),
    ).toEqual({
      ok: true,
      value: {
        country: ['DE', 'US'],
        payGroupId: 3,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        cutoffDate: '2026-05-12',
        payDate: 1779408000,
        status: 'approved',
      },
    });
  });

  it.each([
    [{ country: 'USA' }, 'Invalid country'],
    [{ country: 'DE,' }, 'Invalid country'],
    [{ payGroupId: '0' }, 'Invalid payGroupId'],
    [{ periodStart: '2026-02-29' }, 'Invalid periodStart'],
    [{ periodEnd: 'not-a-date' }, 'Invalid periodEnd'],
    [{ cutoffDate: '2026-13-01' }, 'Invalid cutoffDate'],
    [{ payDate: '-1' }, 'Invalid payDate'],
    [{ payDate: '1.5' }, 'Invalid payDate'],
    [{ payDate: '9007199254740992' }, 'Invalid payDate'],
    [{ status: 'processing' }, 'Invalid status'],
  ])('rejects invalid filter %#', (query, error) => {
    expect(parseGlobalSummaryFilters(query)).toEqual({ ok: false, error });
  });

  it('accepts a zero Unix timestamp', () => {
    expect(parseGlobalSummaryFilters({ payDate: '0' })).toEqual({
      ok: true,
      value: { payDate: 0 },
    });
  });

  it('rejects a reversed period range', () => {
    expect(
      parseGlobalSummaryFilters({
        periodStart: '2026-06-01',
        periodEnd: '2026-05-31',
      }),
    ).toEqual({ ok: false, error: 'periodEnd must be on or after periodStart' });
  });

  it.each(['draft', 'approved'])('accepts the %s status', (status) => {
    expect(parseGlobalSummaryFilters({ status })).toEqual({
      ok: true,
      value: { status },
    });
  });
});

describe('employee summary filter validation', () => {
  it('accepts omitted filters', () => {
    expect(parseEmployeeSummaryFilters({})).toEqual({
      ok: true,
      value: {},
    });
  });

  it('parses employeeId and delegates every shared filter', () => {
    expect(
      parseEmployeeSummaryFilters({
        country: ' de, US,de ',
        payGroupId: '3',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        cutoffDate: '2026-05-12',
        payDate: '1779408000',
        status: 'approved',
        employeeId: '5',
      }),
    ).toEqual({
      ok: true,
      value: {
        country: ['DE', 'US'],
        payGroupId: 3,
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        cutoffDate: '2026-05-12',
        payDate: 1779408000,
        status: 'approved',
        employeeId: 5,
      },
    });
  });

  it('rejects an invalid employeeId', () => {
    expect(parseEmployeeSummaryFilters({ employeeId: '0' })).toEqual({
      ok: false,
      error: 'Invalid employeeId',
    });
  });

  it('propagates shared-filter errors', () => {
    expect(
      parseEmployeeSummaryFilters({
        country: 'USA',
        employeeId: '5',
      }),
    ).toEqual({
      ok: false,
      error: 'Invalid country',
    });
  });
});
