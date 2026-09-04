import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from './server.js';
import { db } from './db/index.js';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('payroll-api routes (E1-E5)', () => {
  it('E1 GET /countries returns 200 with an array as a response', async () => {
    const res = await app.request('/countries');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('E1 GET /countries includes seeded countries with their pay groups', async () => {
    const res = await app.request('/countries');
    const body = await res.json();
    const codes = body.map((country: { code: string }) => country.code);
    expect(codes).toEqual(expect.arrayContaining(['DE', 'GB', 'US']));
    for (const country of body) {
      expect(Array.isArray(country.payGroups)).toBe(true);
      expect(country.payGroups.length).toBeGreaterThan(0);
    }
  });

  it('E1b GET /countries returns 500 when the query fails', async () => {
    const spy = vi.spyOn(db.query.countries, 'findMany').mockRejectedValueOnce(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/countries');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Failed to fetch countries' });
    spy.mockRestore();
    errorSpy.mockRestore();
  });

  it('E2 GET /countries/:code/pay-groups returns 200 with the country pay groups', async () => {
    const res = await app.request('/countries/US/pay-groups');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body.every((group: { countryCode: string }) => group.countryCode === 'US')).toBe(true);
  });

  it('E2 GET /countries/:code/pay-groups accepts a lowercase country code', async () => {
    const res = await app.request('/countries/de/pay-groups');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].countryCode).toBe('DE');
  });

  it('E2b GET /countries/:code/pay-groups returns 404 for unknown country', async () => {
    const res = await app.request('/countries/ZZ/pay-groups');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Country not found' });
  });

  it('E2c GET /countries/:code/pay-groups returns 400 for invalid country code', async () => {
    const res = await app.request('/countries/USA/pay-groups');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid country code' });
  });

  it('E2d GET /countries/:code/pay-groups returns 500 when the query fails', async () => {
    const spy = vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('db down');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/countries/US/pay-groups');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Failed to fetch pay groups' });
    spy.mockRestore();
    errorSpy.mockRestore();
  });

  it('E3 POST /payroll-cycles creates a cycle and returns the full row', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payGroupId: 1, periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body).toMatchObject({
      payGroupId: 1,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      cutoffDate: null,
      payDate: null,
      status: 'draft',
    });
  });

  it('E3 POST /payroll-cycles creates a cycle with nested items', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payGroupId: 1,
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
        items: [{ employeeId: 1, type: 'earning', amount: 1000, currency: 'EUR' }],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    const items = await app.request(`/getPayItemsByCycle?cycleId=${body.id}`);
    const itemBody = await items.json();
    expect(itemBody).toHaveLength(1);
    expect(itemBody[0].amount).toBe(1000);
  });

  it('E3b POST /payroll-cycles returns 400 for an invalid body', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payGroupId: 1, periodStart: 'not-a-date', periodEnd: '2026-07-31' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid periodStart' });
  });

  it('E3b POST /payroll-cycles returns 400 for malformed JSON', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('E3b POST /payroll-cycles rejects impossible calendar dates', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payGroupId: 1, periodStart: '2026-02-29', periodEnd: '2026-03-31' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid periodStart' });
  });

  it('E3b POST /payroll-cycles validates nested pay items', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payGroupId: 1,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        items: [{ employeeId: 1, type: 'bonus', amount: -1, currency: 'eur' }],
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid item type' });
  });

  it('E3c POST /payroll-cycles returns 404 for an unknown pay group', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payGroupId: 9999, periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Pay group not found' });
  });

  it('E3d POST /payroll-cycles returns 400 for an unknown employee on nested items', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payGroupId: 1,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        items: [{ employeeId: 9999, type: 'earning', amount: 1000, currency: 'EUR' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Employee not found' });
  });

  it('E4 GET /payroll-cycles/:id returns a cycle', async () => {
    const res = await app.request('/payroll-cycles/1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it('E4 GET /payroll-cycles/:id returns 400 for an invalid id', async () => {
    const res = await app.request('/payroll-cycles/not-a-number');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid id' });
  });

  it('E4 GET /payroll-cycles/:id returns 404 for an unknown cycle', async () => {
    const res = await app.request('/payroll-cycles/9999');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Payroll cycle not found' });
  });

  it('E5 POST /payroll-cycles/:id/approve approves a cycle', async () => {
    const res = await app.request('/payroll-cycles/2/approve', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(2);
    expect(body.status).toBe('approved');
  });

  it('POST /payroll-cycles/:id/approve rejects a non-numeric id', async () => {
    const res = await app.request('/payroll-cycles/abc/approve', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid id' });
  });

  it('POST /payroll-cycles/:id/approve returns 404 for an unknown id', async () => {
    const res = await app.request('/payroll-cycles/9999/approve', { method: 'POST' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Payroll cycle not found' });
  });
});

describe('payroll-api routes (E6-E9)', () => {
  it('E6 GET /getPayItemsByCycle returns items for a cycle', async () => {
    const res = await app.request('/getPayItemsByCycle?cycleId=1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty('pay_item_id');
  });

  it('E6 GET /getPayItemsByCycle returns 400 when cycleId is missing or invalid', async () => {
    const missing = await app.request('/getPayItemsByCycle');
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: 'Invalid cycleId' });

    const invalid = await app.request('/getPayItemsByCycle?cycleId=1.5');
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: 'Invalid cycleId' });
  });

  it('E6 GET /getPayItemsByCycle returns 404 for an unknown cycle', async () => {
    const res = await app.request('/getPayItemsByCycle?cycleId=9999');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Payroll cycle not found' });
  });

  it('E7 POST /pay-items adds an item', async () => {
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payrollCycleId: 4, employeeId: 1, type: 'earning', amount: 1000, currency: 'EUR' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      payrollCycleId: 4,
      employeeId: 1,
      type: 'earning',
      amount: 1000,
      currency: 'EUR',
    });
    expect(body.id).toBeGreaterThan(0);
  });

  it('E7 POST /pay-items returns 400 for malformed JSON', async () => {
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it.each([
    [{ payrollCycleId: 4, employeeId: 1, type: 'bonus', amount: 1000, currency: 'EUR' }, 'Invalid item type'],
    [{ payrollCycleId: 4, employeeId: 1, type: 'earning', amount: -1, currency: 'EUR' }, 'Invalid amount'],
    [{ payrollCycleId: 4, employeeId: 1, type: 'earning', amount: 1000, currency: 'eur' }, 'Invalid currency'],
  ])('E7 POST /pay-items validates its body', async (requestBody, error) => {
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it('E7b POST /pay-items rejects inserts on an approved cycle', async () => {
    const before = await (await app.request('/pay-items')).json();
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payrollCycleId: 1, employeeId: 1, type: 'earning', amount: 1000, currency: 'EUR' }),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Payroll cycle is locked' });
    const after = await (await app.request('/pay-items')).json();
    expect(after).toHaveLength(before.length);
  });

  it('E7c POST /pay-items returns 404 for an unknown cycle', async () => {
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payrollCycleId: 9999, employeeId: 1, type: 'earning', amount: 1000, currency: 'EUR' }),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Payroll cycle not found' });
  });

  it('E7d POST /pay-items returns 400 for an unknown employee', async () => {
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        payrollCycleId: 4,
        employeeId: 9999,
        type: 'earning',
        amount: 1000,
        currency: 'EUR',
      }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Employee not found' });
  });

  it('E8 GET /pay-items filters by minAmount', async () => {
    const res = await app.request('/pay-items?minAmount=3000&sort=amount');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((r: any) => r.amount >= 3000)).toBe(true);
  });

  it('E8b GET /pay-items without sort returns 200', async () => {
    const res = await app.request('/pay-items');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('E8c GET /pay-items rejects non-allowlisted sort', async () => {
    const res = await app.request('/pay-items?sort=id;DROP TABLE pay_items');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('E8d GET /pay-items rejects non-finite minAmount', async () => {
    const res = await app.request('/pay-items?minAmount=abc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('E8d GET /pay-items rejects an empty minAmount', async () => {
    const res = await app.request('/pay-items?minAmount=');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid minAmount' });
  });

  it('E9 GET /reports/global-summary returns country-and-currency rows', async () => {
    const res = await app.request('/reports/global-summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toEqual({
      countryCode: expect.any(String),
      countryName: expect.any(String),
      currency: expect.any(String),
      totalEarnings: expect.any(Number),
      totalDeductions: expect.any(Number),
      totalEmployerCost: expect.any(Number),
    });
  });

  it('E9 GET /reports/global-summary normalizes and applies country codes', async () => {
    const res = await app.request('/reports/global-summary?country=de,US');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect([
      ...new Set(
        body.map((row: { countryCode: string }) => row.countryCode),
      ),
    ]).toEqual(['DE', 'US']);
  });

  it('E9 GET /reports/global-summary returns 404 for unknown references', async () => {
    const country = await app.request('/reports/global-summary?country=DE,ZZ');
    expect(country.status).toBe(404);
    expect(await country.json()).toEqual({ error: 'Country not found' });

    const payGroup = await app.request(
      '/reports/global-summary?payGroupId=9999',
    );
    expect(payGroup.status).toBe(404);
    expect(await payGroup.json()).toEqual({ error: 'Pay group not found' });
  });

  it('E9 GET /reports/global-summary returns an empty array for existing but incompatible references', async () => {
    const res = await app.request(
      '/reports/global-summary?country=US&payGroupId=1',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it.each([
    ['/reports/global-summary?country=USA', 'Invalid country'],
    ['/reports/global-summary?country=DE,', 'Invalid country'],
    ['/reports/global-summary?payGroupId=0', 'Invalid payGroupId'],
    [
      '/reports/global-summary?periodStart=2026-06-01&periodEnd=2026-05-01',
      'periodEnd must be on or after periodStart',
    ],
    ['/reports/global-summary?cutoffDate=not-a-date', 'Invalid cutoffDate'],
    ['/reports/global-summary?payDate=1.5', 'Invalid payDate'],
    ['/reports/global-summary?status=processing', 'Invalid status'],
  ])('E9 GET %s returns 400', async (url, error) => {
    const res = await app.request(url);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it('E9 GET /reports/global-summary applies all cycle filters', async () => {
    const res = await app.request(
      '/reports/global-summary?country=US&payGroupId=3&periodStart=2026-05-10&periodEnd=2026-05-20&cutoffDate=2026-05-12&payDate=1779408000&status=approved',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        countryCode: 'US',
        countryName: 'United States',
        currency: 'USD',
        totalEarnings: 5208.34,
        totalDeductions: 1041.67,
        totalEmployerCost: 375,
      },
    ]);
  });

  it('E9 GET /reports/global-summary returns an empty array for valid filters with no pay items', async () => {
    const res = await app.request(
      '/reports/global-summary?country=US&status=draft',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('GET /reports/employee-summary returns ordered employee-and-currency rows', async () => {
    const res = await app.request('/reports/employee-summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(8);
    expect(body[0]).toEqual({
      employeeId: 1,
      employeeName: 'Anke Weber',
      countryCode: 'DE',
      currency: 'EUR',
      totalEarnings: expect.any(Number),
      totalDeductions: expect.any(Number),
      totalEmployerCost: expect.any(Number),
    });
    expect(
      body.map(
        (row: { employeeId: number; currency: string }) =>
          `${row.employeeId}:${row.currency}`,
      ),
    ).toEqual([
      '1:EUR',
      '2:EUR',
      '3:GBP',
      '4:GBP',
      '5:USD',
      '6:USD',
      '7:USD',
      '8:USD',
    ]);
  });

  it('GET /reports/employee-summary applies all cycle filters and employeeId', async () => {
    const res = await app.request(
      '/reports/employee-summary?country=US&payGroupId=3&periodStart=2026-05-10&periodEnd=2026-05-20&cutoffDate=2026-05-12&payDate=1779408000&status=approved&employeeId=5',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        employeeId: 5,
        employeeName: 'Maria Ruiz',
        countryCode: 'US',
        currency: 'USD',
        totalEarnings: 2500,
        totalDeductions: 500,
        totalEmployerCost: 375,
      },
    ]);
  });

  it.each([
    ['/reports/employee-summary?employeeId=0', 'Invalid employeeId'],
    ['/reports/employee-summary?country=USA', 'Invalid country'],
    ['/reports/employee-summary?payGroupId=0', 'Invalid payGroupId'],
    [
      '/reports/employee-summary?periodStart=2026-06-01&periodEnd=2026-05-01',
      'periodEnd must be on or after periodStart',
    ],
    [
      '/reports/employee-summary?cutoffDate=not-a-date',
      'Invalid cutoffDate',
    ],
    ['/reports/employee-summary?payDate=1.5', 'Invalid payDate'],
    ['/reports/employee-summary?status=processing', 'Invalid status'],
  ])('GET %s returns 400', async (url, error) => {
    const res = await app.request(url);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it('GET /reports/employee-summary returns 404 for unknown references', async () => {
    const country = await app.request(
      '/reports/employee-summary?country=DE,ZZ',
    );
    expect(country.status).toBe(404);
    expect(await country.json()).toEqual({ error: 'Country not found' });

    const payGroup = await app.request(
      '/reports/employee-summary?payGroupId=9999',
    );
    expect(payGroup.status).toBe(404);
    expect(await payGroup.json()).toEqual({ error: 'Pay group not found' });

    const employee = await app.request(
      '/reports/employee-summary?employeeId=9999',
    );
    expect(employee.status).toBe(404);
    expect(await employee.json()).toEqual({ error: 'Employee not found' });
  });

  it('GET /reports/employee-summary returns empty for incompatible existing references', async () => {
    const res = await app.request(
      '/reports/employee-summary?country=US&payGroupId=1',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('GET /reports/employee-summary returns empty when an existing employee has no matching items', async () => {
    const res = await app.request(
      '/reports/employee-summary?payGroupId=3&employeeId=8',
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('error handling (M-07)', () => {
  it('logs responses with status >= 400', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/payroll-cycles/not-a-number');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid id' });
    expect(errorSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/payroll-cycles/not-a-number',
      status: 400,
      error: 'Invalid id',
    });
    errorSpy.mockRestore();
  });

  it('does not log successful responses', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/countries');
    expect(res.status).toBe(200);
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns JSON 500 for uncaught errors', async () => {
    const spy = vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('db down');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await app.request('/payroll-cycles/1');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal server error' });
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(errorSpy).toHaveBeenCalledWith({
      method: 'GET',
      path: '/payroll-cycles/1',
      status: 500,
      error: 'Internal server error',
    });
    spy.mockRestore();
    errorSpy.mockRestore();
  });
});
