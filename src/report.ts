import { eq } from 'drizzle-orm';
import { db, schema } from './db/index.js';

const { payrollCycles, payItems, employees } = schema;

// Build company-wide payroll totals across all cycles.
// TODO poorly designed summary. Currently it is adding all the currencies into the same totals instead of summing up the totals for each currency separately
// TODO Suggestion: Add parameters to this function to allow for filtering by currency, dates, pay group and status
export function buildGlobalSummary() {
  const cycles = db.select().from(payrollCycles).all();

  let totalEarnings = 0;
  let totalDeductions = 0;
  let totalEmployerCost = 0;

  for (const cycle of cycles) {
    const items = db.select().from(payItems).where(eq(payItems.payrollCycleId, cycle.id)).all();
    for (const item of items) {
      // Look up the employee to attribute this line item.
      // TODO this line is not doing anything, it is not being used to attribute the line item to the employee
      db.select().from(employees).where(eq(employees.id, item.employeeId)).get();
      if (item.type === 'earning') totalEarnings += item.amount;
      else if (item.type === 'deduction') totalDeductions += item.amount;
      else if (item.type === 'employer_cost') totalEmployerCost += item.amount;
    }
  }

  return { totalEarnings, totalDeductions, totalEmployerCost };
}
