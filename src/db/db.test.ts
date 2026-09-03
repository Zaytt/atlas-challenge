import { describe, it, expect } from 'vitest';
import { db } from './index.js';
import { countries, payItems } from './schema.js';

describe('db bootstrap', () => {
  it('applies DDL and seeds reference data', () => {
    const rows = db.select().from(countries).all();
    expect(rows.map((r) => r.code).sort()).toEqual(['DE', 'GB', 'US']);
  });

  it('seeds pay items with multiple currencies', () => {
    const rows = db.select().from(payItems).all();
    const currencies = new Set(rows.map((r) => r.currency));
    expect(currencies).toEqual(new Set(['EUR', 'GBP', 'USD']));
  });
});
