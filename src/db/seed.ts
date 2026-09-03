import type Database from 'better-sqlite3';

export function seed(sqlite: Database.Database): void {
  sqlite.exec(`
    INSERT INTO countries (code, name, currency) VALUES
      ('DE', 'Germany', 'EUR'),
      ('GB', 'United Kingdom', 'GBP'),
      ('US', 'United States', 'USD');

    INSERT INTO employees (name, country_code) VALUES
      ('Anke Weber', 'DE'), ('Lukas Braun', 'DE'),
      ('Olivia Shah', 'GB'), ('Tom Reed', 'GB'),
      ('Maria Ruiz', 'US'), ('James Cole', 'US'),
      ('Priya Nair', 'US'), ('Dan Kim', 'US');

    INSERT INTO pay_groups (country_code, name, pay_frequency, currency) VALUES
      ('DE', 'DE Monthly', 'monthly', 'EUR'),
      ('GB', 'GB Monthly', 'monthly', 'GBP'),
      ('US', 'US Semi-Monthly', 'semimonthly', 'USD'),
      ('US', 'US Bi-Weekly', 'biweekly', 'USD');

    -- Two cycles per group: one approved, one draft.
    INSERT INTO payroll_cycles (pay_group_id, period_start, period_end, cutoff_date, pay_date, status) VALUES
      (1, '2026-05-01', '2026-05-31', '2026-05-25', 1780704000, 'approved'),
      (1, '2026-06-01', '2026-06-30', '2026-06-25', 1783296000, 'draft'),
      (2, '2026-05-01', '2026-05-31', '2026-05-25', 1780704000, 'approved'),
      (2, '2026-06-01', '2026-06-30', '2026-06-25', 1783296000, 'draft'),
      (3, '2026-05-01', '2026-05-15', '2026-05-12', 1779408000, 'approved'),
      (3, '2026-05-16', '2026-05-31', '2026-05-28', 1780704000, 'draft'),
      (4, '2026-05-04', '2026-05-17', '2026-05-14', 1779580800, 'approved'),
      (4, '2026-05-18', '2026-05-31', '2026-05-28', 1780704000, 'draft');

    -- Pay items: earning/deduction/employer_cost.
    INSERT INTO pay_items (payroll_cycle_id, employee_id, type, amount, currency) VALUES
      (1, 1, 'earning', 4333.33, 'EUR'), 
      (1, 1, 'deduction', 866.67, 'EUR'), 
      (1, 1, 'employer_cost', 650.12, 'EUR'),
      (1, 2, 'earning', 3750.00, 'EUR'), 
      (1, 2, 'deduction', 712.50, 'EUR'),
      (3, 3, 'earning', 3900.10, 'GBP'), 
      (3, 3, 'deduction', 780.02, 'GBP'), 
      (3, 3, 'employer_cost', 585.00, 'GBP'),
      (3, 4, 'earning', 3100.00, 'GBP'), 
      (3, 4, 'deduction', 620.00, 'GBP'),
      (5, 5, 'earning', 2500.00, 'USD'), 
      (5, 5, 'deduction', 500.00, 'USD'), 
      (5, 5, 'employer_cost', 375.00, 'USD'),
      (5, 6, 'earning', 2708.34, 'USD'), 
      (5, 6, 'deduction', 541.67, 'USD'),
      (7, 7, 'earning', 2400.00, 'USD'), 
      (7, 7, 'deduction', 480.00, 'USD'),
      (7, 8, 'earning', 2150.55, 'USD'), 
      (7, 8, 'deduction', 430.11, 'USD'), 
      (7, 8, 'employer_cost', 322.58, 'USD');
  `);
}
