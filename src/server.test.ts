import { describe, it, expect } from 'vitest';
import app from './server.js';

describe('payroll-api routes (E1-E5)', () => {
  it('E1 GET /countries returns countries with their pay groups', async () => {
    const res = await app.request('/countries');
    expect(res.status).toBe(200);
    const body = await res.json();
    const de = body.find((c: any) => c.code === 'DE');
    expect(de.payGroups.length).toBeGreaterThan(0);
  });

  it('E2 GET /countries/:code/pay-groups lists a country pay groups', async () => {
    const res = await app.request('/countries/US/pay-groups');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBe(2);
  });

  it('E3 POST /payroll-cycles creates a cycle', async () => {
    const res = await app.request('/payroll-cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payGroupId: 1, periodStart: '2026-07-01', periodEnd: '2026-07-31' }),
    });
    const body = await res.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.status).toBe('draft');
  });

  it('E4 GET /payroll-cycles/:id returns a cycle', async () => {
    const res = await app.request('/payroll-cycles/1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(1);
  });

  it('E5 POST /payroll-cycles/:id/approve approves a cycle', async () => {
    const res = await app.request('/payroll-cycles/2/approve', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('approved');
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

  it('E7 POST /pay-items adds an item', async () => {
    const res = await app.request('/pay-items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ payrollCycleId: 2, employeeId: 1, type: 'earning', amount: 1000, currency: 'EUR' }),
    });
    const body = await res.json();
    expect(body.id).toBeGreaterThan(0);
  });

  it('E8 GET /pay-items filters by minAmount', async () => {
    const res = await app.request('/pay-items?minAmount=3000&sort=amount');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.every((r: any) => r.amount >= 3000)).toBe(true);
  });

  it('E9 GET /reports/global-summary returns totals', async () => {
    const res = await app.request('/reports/global-summary');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('totalEarnings');
    expect(body).toHaveProperty('totalDeductions');
    expect(body).toHaveProperty('totalEmployerCost');
  });
});
