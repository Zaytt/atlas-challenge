CREATE TABLE countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL REFERENCES countries(code)
);

CREATE TABLE pay_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL REFERENCES countries(code),
  name TEXT NOT NULL,
  pay_frequency TEXT NOT NULL,
  currency TEXT NOT NULL
);

CREATE TABLE payroll_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_group_id INTEGER NOT NULL REFERENCES pay_groups(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  cutoff_date TEXT,
  pay_date INTEGER,
  status TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE pay_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payroll_cycle_id INTEGER NOT NULL REFERENCES payroll_cycles(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL
);
