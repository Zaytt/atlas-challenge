import { Hono, type Context } from 'hono';
import { eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from './db/index.js';
import { isPayItemSqlColumn, payItemSqlColumns } from './db/schemaTypes.js';
import { buildEmployeeSummary, buildGlobalSummary } from './report.js';
import {
  isCycleLocked,
  isPositiveInt,
  parseEmployeeSummaryFilters,
  parseFiniteNumberParam,
  parseGlobalSummaryFilters,
  parseJsonObjectBody,
  parsePayItem,
  parsePayrollCycle,
  parsePositiveIntParam,
  type GlobalSummaryFilters,
} from './utils/validation.js';

const { countries, payGroups, payrollCycles, payItems, employees } = schema;
const app = new Hono();

function findSummaryReferenceError(
  filters: Pick<GlobalSummaryFilters, 'country' | 'payGroupId'>,
): string | null {
  const { country, payGroupId } = filters;
  if (country !== undefined) {
    const existingCountries = db
      .select({ code: countries.code })
      .from(countries)
      .where(inArray(countries.code, country))
      .all();
    if (existingCountries.length !== country.length) {
      return 'Country not found';
    }
  }

  if (payGroupId !== undefined) {
    const existingPayGroup = db
      .select({ id: payGroups.id })
      .from(payGroups)
      .where(eq(payGroups.id, payGroupId))
      .get();
    if (!existingPayGroup) {
      return 'Pay group not found';
    }
  }

  return null;
}

async function logErrorResponse(c: Context): Promise<void> {
  const status = c.res.status;
  if (status < 400) {
    return;
  }

  let error: unknown;
  try {
    const body: unknown = await c.res.clone().json();
    error =
      body !== null && typeof body === 'object' && 'error' in body
        ? (body as { error: unknown }).error
        : body;
  } catch {
    error = undefined;
  }

  console.error({ method: c.req.method, path: c.req.path, status, error });
}

/** Fallback for uncaught errors. @returns {500} `{ error }` */
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: 'Internal server error' }, 500);
});

app.use(async (c, next) => {
  await next();
  await logErrorResponse(c);
});

/**
 * List countries with nested pay groups.
 * @route GET /countries
 * @returns {200} Country[] with nested `payGroups`
 * @returns {500} `{ error }`
 */
app.get('/countries', async (c) => {
  try {
    const rows = await db.query.countries.findMany({
      with: { payGroups: true },
    });
    return c.json(rows, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch countries' }, 500);
  }
});

/**
 * List pay groups for a country. Empty list when the country exists but has no groups.
 * @route GET /countries/:code/pay-groups
 * @param code ISO 3166-1 alpha-2 (case-insensitive)
 * @returns {200} PayGroup[]
 * @returns {400} invalid country code
 * @returns {404} country not found
 * @returns {500} `{ error }`
 */
app.get('/countries/:code/pay-groups', (c) => {
  try {
    // Validate country code format
    const code = c.req.param('code').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) {
      return c.json({ error: 'Invalid country code' }, 400);
    }

    const country = db.select().from(countries).where(eq(countries.code, code)).get();
    if (!country) {
      return c.json({ error: 'Country not found' }, 404);
    }

    const rows = db.select().from(payGroups).where(eq(payGroups.countryCode, code)).all();
    return c.json(rows, 200);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch pay groups' }, 500);
  }
});

/**
 * Create a payroll cycle in `draft`, optionally with initial pay items.
 * @route POST /payroll-cycles
 * @body `{ payGroupId, periodStart, periodEnd, cutoffDate?, payDate?, items? }`
 * `periodStart`/`periodEnd` are ISO dates (`YYYY-MM-DD`); `payDate` is unix seconds.
 * Each item: `{ employeeId, type, amount, currency }` (`type`: earning | deduction | employer_cost).
 * @returns {201} inserted payroll cycle
 * @returns {400} invalid body or unknown employee
 * @returns {404} pay group not found
 * @returns {500} `{ error }`
 */
app.post('/payroll-cycles', async (c) => {
  try {
    const parsedBody = await parseJsonObjectBody(c.req);
    if (!parsedBody.ok) {
      return c.json({ error: parsedBody.error }, 400);
    }

    const parsedCycle = parsePayrollCycle(parsedBody.value);
    if (!parsedCycle.ok) {
      return c.json({ error: parsedCycle.error }, 400);
    }

    const { payGroupId, periodStart, periodEnd, cutoffDate, payDate, items } = parsedCycle.value;
    const payGroup = db.select().from(payGroups).where(eq(payGroups.id, payGroupId)).get();
    if (!payGroup) {
      return c.json({ error: 'Pay group not found' }, 404);
    }

    if (items) {
      for (const item of items) {
        const employee = db.select().from(employees).where(eq(employees.id, item.employeeId)).get();
        if (!employee) {
          return c.json({ error: 'Employee not found' }, 400);
        }
      }
    }

    const result = db.transaction((tx) => {
      const inserted = tx
        .insert(payrollCycles)
        .values({
          payGroupId,
          periodStart,
          periodEnd,
          cutoffDate,
          payDate,
          status: 'draft',
        })
        .returning()
        .get();
      if (items) {
        if (isCycleLocked(inserted.status)) {
          throw new Error('Cannot add pay items to a locked payroll cycle');
        }
        for (const item of items) {
          tx.insert(payItems).values({
            payrollCycleId: inserted.id,
            employeeId: item.employeeId,
            type: item.type,
            amount: item.amount,
            currency: item.currency,
          }).run();
        }
      }
      return inserted;
    });

    return c.json(result, 201);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to create payroll cycle' }, 500);
  }
});

/**
 * Fetch a single payroll cycle.
 * @route GET /payroll-cycles/:id
 * @param id positive integer
 * @returns {200} payroll cycle
 * @returns {400} invalid id
 * @returns {404} cycle not found
 */
app.get('/payroll-cycles/:id', (c) => {
  const id = parsePositiveIntParam(c.req.param('id'));
  if (id === null) {
    return c.json({ error: 'Invalid id' }, 400);
  }

  const cycle = db.select().from(payrollCycles).where(eq(payrollCycles.id, id)).get();
  if (!cycle) {
    return c.json({ error: 'Payroll cycle not found' }, 404);
  }

  return c.json(cycle, 200);
});

/**
 * Approve a payroll cycle (sets status to `approved`).
 * @route POST /payroll-cycles/:id/approve
 * @param id positive integer
 * @returns {200} `{ id, status: "approved" }`
 * @returns {400} invalid id
 * @returns {404} cycle not found
 */
app.post('/payroll-cycles/:id/approve', (c) => {
  const id = parsePositiveIntParam(c.req.param('id'));
  if (id === null) {
    return c.json({ error: 'Invalid id' }, 400);
  }
  const existing = db.select().from(payrollCycles).where(eq(payrollCycles.id, id)).get();
  if (!existing) {
    return c.json({ error: 'Payroll cycle not found' }, 404);
  }
  db.update(payrollCycles).set({ status: 'approved' }).where(eq(payrollCycles.id, id)).run();
  return c.json({ id: existing.id, status: 'approved' });
});

/**
 * List pay items for a cycle, with employee names.
 * @route GET /getPayItemsByCycle
 * @query cycleId positive integer
 * @returns {200} `{ pay_item_id, employee_name, item_type, amount, currency }[]`
 * @returns {400} invalid or missing cycleId
 * @returns {404} cycle not found
 */
app.get('/getPayItemsByCycle', (c) => {
  const rawCycleId = c.req.query('cycleId');
  const cycleId = rawCycleId === undefined ? null : parsePositiveIntParam(rawCycleId);
  if (cycleId === null) {
    return c.json({ error: 'Invalid cycleId' }, 400);
  }

  const cycle = db.select().from(payrollCycles).where(eq(payrollCycles.id, cycleId)).get();
  if (!cycle) {
    return c.json({ error: 'Payroll cycle not found' }, 404);
  }

  const items = db.select().from(payItems).where(eq(payItems.payrollCycleId, cycleId)).all();
  const responseItems = items.map((item) => {
    const emp = db.select().from(employees).where(eq(employees.id, item.employeeId)).get();
    return {
      pay_item_id: item.id,
      employee_name: emp?.name ?? null,
      item_type: item.type,
      amount: item.amount,
      currency: item.currency,
    };
  });
  return c.json(responseItems, 200);
});

/**
 * Add a pay item to a draft (or processing) cycle.
 * @route POST /pay-items
 * @body `{ payrollCycleId, employeeId, type, amount, currency }`
 * `type`: earning | deduction | employer_cost; `amount` ≥ 0; `currency` is ISO 4217.
 * @returns {201} inserted pay item
 * @returns {400} invalid body or unknown employee
 * @returns {404} cycle not found
 * @returns {409} cycle is approved or paid
 */
app.post('/pay-items', async (c) => {
  const parsedBody = await parseJsonObjectBody(c.req);
  if (!parsedBody.ok) {
    return c.json({ error: parsedBody.error }, 400);
  }
  const body = parsedBody.value;

  if (!isPositiveInt(body.payrollCycleId)) {
    return c.json({ error: 'Invalid payrollCycleId' }, 400);
  }

  const item = parsePayItem(body);
  if (!item.ok) {
    return c.json({ error: item.error }, 400);
  }

  const cycle = db
    .select()
    .from(payrollCycles)
    .where(eq(payrollCycles.id, body.payrollCycleId))
    .get();
  if (!cycle) {
    return c.json({ error: 'Payroll cycle not found' }, 404);
  }
  if (isCycleLocked(cycle.status)) {
    return c.json({ error: 'Payroll cycle is locked' }, 409);
  }

  const employee = db.select().from(employees).where(eq(employees.id, item.value.employeeId)).get();
  if (!employee) {
    return c.json({ error: 'Employee not found' }, 400);
  }

  const inserted = db
    .insert(payItems)
    .values({
      payrollCycleId: body.payrollCycleId,
      employeeId: item.value.employeeId,
      type: item.value.type,
      amount: item.value.amount,
      currency: item.value.currency,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

/**
 * List pay items, optionally filtered by minimum amount and sorted.
 * @route GET /pay-items
 * @query sort allowlisted SQL column (`id` default): id, payroll_cycle_id, employee_id, type, amount, currency
 * @query minAmount finite number; omit to skip the filter
 * @returns {200} PayItem[]
 * @returns {400} invalid `sort` or `minAmount`
 */
app.get('/pay-items', (c) => {
  const sortParam = c.req.query('sort') ?? 'id';
  const minAmountParam = c.req.query('minAmount');

  // Validate sort option
  if (!isPayItemSqlColumn(sortParam)) {
    return c.json({ error: 'Invalid sort option' }, 400);
  }
  const sortColumn = payItemSqlColumns[sortParam];

  // Validate min amount
  let minAmount: number | undefined;
  if (minAmountParam !== undefined) {
    const parsed = parseFiniteNumberParam(minAmountParam);
    if (parsed === null) {
      return c.json({ error: 'Invalid minAmount' }, 400);
    }
    minAmount = parsed;
  }

  const rows =
    minAmount !== undefined
      ? db.select(payItemSqlColumns).from(payItems).where(gte(payItems.amount, minAmount)).orderBy(sortColumn).all()
      : db.select(payItemSqlColumns).from(payItems).orderBy(sortColumn).all();

  return c.json(rows);
});

/**
 * Country- and currency-separated payroll totals across matching cycles.
 * @route GET /reports/global-summary
 * @query country optional comma-separated ISO 3166-1 alpha-2 codes (case-insensitive)
 * @query payGroupId optional positive integer
 * @query periodStart optional ISO date lower bound; matches cycles ending on/after it
 * @query periodEnd optional ISO date upper bound; matches cycles starting on/before it
 * @query cutoffDate optional exact ISO date
 * @query payDate optional exact non-negative Unix timestamp in seconds
 * @query status optional `draft` or `approved`
 * @returns {200} `{ countryCode, countryName, currency, totalEarnings, totalDeductions, totalEmployerCost }[]`
 * @returns {400} malformed or unsupported filter
 * @returns {404} country or pay group not found
 */
app.get('/reports/global-summary', (c) => {
  const parsedFilters = parseGlobalSummaryFilters({
    country: c.req.query('country'),
    payGroupId: c.req.query('payGroupId'),
    periodStart: c.req.query('periodStart'),
    periodEnd: c.req.query('periodEnd'),
    cutoffDate: c.req.query('cutoffDate'),
    payDate: c.req.query('payDate'),
    status: c.req.query('status'),
  });
  if (!parsedFilters.ok) {
    return c.json({ error: parsedFilters.error }, 400);
  }

  const referenceError = findSummaryReferenceError(parsedFilters.value);
  if (referenceError !== null) {
    return c.json({ error: referenceError }, 404);
  }

  return c.json(buildGlobalSummary(parsedFilters.value), 200);
});

/**
 * Employee- and currency-separated payroll totals across matching cycles.
 * `country` filters payroll/pay-group country; row `countryCode` is the employee's home country.
 * @route GET /reports/employee-summary
 * @query country optional comma-separated ISO 3166-1 alpha-2 codes (case-insensitive)
 * @query payGroupId optional positive integer
 * @query periodStart optional ISO date lower bound; matches cycles ending on/after it
 * @query periodEnd optional ISO date upper bound; matches cycles starting on/before it
 * @query cutoffDate optional exact ISO date
 * @query payDate optional exact non-negative Unix timestamp in seconds
 * @query status optional `draft` or `approved`
 * @query employeeId optional positive integer
 * @returns {200} `{ employeeId, employeeName, countryCode, currency, totalEarnings, totalDeductions, totalEmployerCost }[]`
 * @returns {400} malformed or unsupported filter
 * @returns {404} country, pay group, or employee not found
 */
app.get('/reports/employee-summary', (c) => {
  const parsedFilters = parseEmployeeSummaryFilters({
    country: c.req.query('country'),
    payGroupId: c.req.query('payGroupId'),
    periodStart: c.req.query('periodStart'),
    periodEnd: c.req.query('periodEnd'),
    cutoffDate: c.req.query('cutoffDate'),
    payDate: c.req.query('payDate'),
    status: c.req.query('status'),
    employeeId: c.req.query('employeeId'),
  });
  if (!parsedFilters.ok) {
    return c.json({ error: parsedFilters.error }, 400);
  }

  const referenceError = findSummaryReferenceError(parsedFilters.value);
  if (referenceError !== null) {
    return c.json({ error: referenceError }, 404);
  }

  const { employeeId } = parsedFilters.value;
  if (employeeId !== undefined) {
    const employee = db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .get();
    if (!employee) {
      return c.json({ error: 'Employee not found' }, 404);
    }
  }

  return c.json(buildEmployeeSummary(parsedFilters.value), 200);
});

export default app;
