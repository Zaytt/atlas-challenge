const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INT_DIGITS = /^\d+$/;

export const CURRENCY = /^[A-Z]{3}$/;
export const PAY_ITEM_TYPES = new Set(['earning', 'deduction', 'employer_cost']);
export const GLOBAL_SUMMARY_STATUSES = ['draft', 'approved'] as const;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type GlobalSummaryStatus = (typeof GLOBAL_SUMMARY_STATUSES)[number];

export type GlobalSummaryFilters = {
  country?: string[];
  payGroupId?: number;
  periodStart?: string;
  periodEnd?: string;
  cutoffDate?: string;
  payDate?: number;
  status?: GlobalSummaryStatus;
};

export type GlobalSummaryQuery = {
  [K in keyof GlobalSummaryFilters]?: string;
};

export type EmployeeSummaryFilters = GlobalSummaryFilters & {
  employeeId?: number;
};

export type EmployeeSummaryQuery = GlobalSummaryQuery & {
  employeeId?: string;
};

export function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function parsePositiveIntParam(raw: string): number | null {
  if (!POSITIVE_INT_DIGITS.test(raw)) {
    return null;
  }
  const n = Number(raw);
  return isPositiveInt(n) ? n : null;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseGlobalSummaryFilters(
  query: GlobalSummaryQuery,
): ValidationResult<GlobalSummaryFilters> {
  const filters: GlobalSummaryFilters = {};

  if (query.country !== undefined) {
    const countryCodes = query.country
      .split(',')
      .map((country) => country.trim().toUpperCase());
    if (
      countryCodes.length === 0 ||
      countryCodes.some((country) => !/^[A-Z]{2}$/.test(country))
    ) {
      return { ok: false, error: 'Invalid country' };
    }
    filters.country = [...new Set(countryCodes)];
  }

  if (query.payGroupId !== undefined) {
    const payGroupId = parsePositiveIntParam(query.payGroupId);
    if (payGroupId === null) {
      return { ok: false, error: 'Invalid payGroupId' };
    }
    filters.payGroupId = payGroupId;
  }

  if (query.periodStart !== undefined) {
    if (!isIsoDate(query.periodStart)) {
      return { ok: false, error: 'Invalid periodStart' };
    }
    filters.periodStart = query.periodStart;
  }

  if (query.periodEnd !== undefined) {
    if (!isIsoDate(query.periodEnd)) {
      return { ok: false, error: 'Invalid periodEnd' };
    }
    filters.periodEnd = query.periodEnd;
  }

  if (
    filters.periodStart !== undefined &&
    filters.periodEnd !== undefined &&
    filters.periodStart > filters.periodEnd
  ) {
    return { ok: false, error: 'periodEnd must be on or after periodStart' };
  }

  if (query.cutoffDate !== undefined) {
    if (!isIsoDate(query.cutoffDate)) {
      return { ok: false, error: 'Invalid cutoffDate' };
    }
    filters.cutoffDate = query.cutoffDate;
  }

  if (query.payDate !== undefined) {
    if (!POSITIVE_INT_DIGITS.test(query.payDate)) {
      return { ok: false, error: 'Invalid payDate' };
    }
    const payDate = Number(query.payDate);
    if (!Number.isSafeInteger(payDate) || payDate < 0) {
      return { ok: false, error: 'Invalid payDate' };
    }
    filters.payDate = payDate;
  }

  if (query.status !== undefined) {
    if (!GLOBAL_SUMMARY_STATUSES.some((status) => status === query.status)) {
      return { ok: false, error: 'Invalid status' };
    }
    filters.status = query.status as GlobalSummaryStatus;
  }

  return { ok: true, value: filters };
}

export function parseEmployeeSummaryFilters(
  query: EmployeeSummaryQuery,
): ValidationResult<EmployeeSummaryFilters> {
  const { employeeId: rawEmployeeId, ...globalQuery } = query;
  const parsedGlobalFilters = parseGlobalSummaryFilters(globalQuery);
  if (!parsedGlobalFilters.ok) {
    return parsedGlobalFilters;
  }

  const filters: EmployeeSummaryFilters = { ...parsedGlobalFilters.value };
  if (rawEmployeeId !== undefined) {
    const employeeId = parsePositiveIntParam(rawEmployeeId);
    if (employeeId === null) {
      return { ok: false, error: 'Invalid employeeId' };
    }
    filters.employeeId = employeeId;
  }

  return { ok: true, value: filters };
}

export async function parseJsonObjectBody(request: { json(): Promise<unknown> }): Promise<ValidationResult<Record<string, unknown>>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }

  return isRecord(body) ? { ok: true, value: body } : { ok: false, error: 'Invalid body' };
}

export function parseFiniteNumberParam(raw: string): number | null {
  if (raw.trim() === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function isCycleLocked(status: string): boolean {
  return status === 'approved' || status === 'paid';
}

export type PayItemInput = {
  employeeId: number;
  type: string;
  amount: number;
  currency: string;
};

export function parsePayItem(item: unknown): ValidationResult<PayItemInput> {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    return { ok: false, error: 'Invalid item' };
  }
  const { employeeId, type, amount, currency } = item as Record<string, unknown>;
  if (!isPositiveInt(employeeId)) {
    return { ok: false, error: 'Invalid employeeId' };
  }
  if (typeof type !== 'string' || !PAY_ITEM_TYPES.has(type)) {
    return { ok: false, error: 'Invalid item type' };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Invalid amount' };
  }
  if (typeof currency !== 'string' || !CURRENCY.test(currency)) {
    return { ok: false, error: 'Invalid currency' };
  }
  return { ok: true, value: { employeeId, type, amount, currency } };
}

export type PayrollCycleInput = {
  payGroupId: number;
  periodStart: string;
  periodEnd: string;
  cutoffDate: string | null;
  payDate: number | null;
  items?: PayItemInput[];
};

export function parsePayrollCycle(body: Record<string, unknown>): ValidationResult<PayrollCycleInput> {
  const { payGroupId, periodStart, periodEnd, cutoffDate, payDate, items } = body;

  if (!isPositiveInt(payGroupId)) {
    return { ok: false, error: 'Invalid payGroupId' };
  }
  if (!isIsoDate(periodStart)) {
    return { ok: false, error: 'Invalid periodStart' };
  }
  if (!isIsoDate(periodEnd)) {
    return { ok: false, error: 'Invalid periodEnd' };
  }
  if (periodEnd < periodStart) {
    return { ok: false, error: 'periodEnd must be on or after periodStart' };
  }

  let parsedCutoffDate: string | null = null;
  if (cutoffDate !== undefined && cutoffDate !== null) {
    if (!isIsoDate(cutoffDate)) {
      return { ok: false, error: 'Invalid cutoffDate' };
    }
    parsedCutoffDate = cutoffDate;
  }

  let parsedPayDate: number | null = null;
  if (payDate !== undefined && payDate !== null) {
    if (typeof payDate !== 'number' || !Number.isInteger(payDate) || !Number.isFinite(payDate)) {
      return { ok: false, error: 'Invalid payDate' };
    }
    parsedPayDate = payDate;
  }

  let parsedItems: PayItemInput[] | undefined;
  if (items !== undefined) {
    if (!Array.isArray(items)) {
      return { ok: false, error: 'Invalid items' };
    }
    parsedItems = [];
    for (const item of items) {
      const parsed = parsePayItem(item);
      if (!parsed.ok) {
        return parsed;
      }
      parsedItems.push(parsed.value);
    }
  }

  return {
    ok: true,
    value: {
      payGroupId,
      periodStart,
      periodEnd,
      cutoffDate: parsedCutoffDate,
      payDate: parsedPayDate,
      items: parsedItems,
    },
  };
}