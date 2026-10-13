/**
 * One month of cashflow.
 *
 * Both directions ride in the same object on purpose: a chart that plots money
 * in against money out needs them aligned to the same months, and two
 * separately-fetched series would silently disagree whenever one direction had
 * a month the other did not.
 */
export interface MonthlySummary {
  month: string;
  totalSpent: number;
  expenseCount: number;
  averageExpense: number;

  totalIncome: number;
  incomeCount: number;
  /** income - spending. Negative means the month ran at a deficit. */
  net: number;
}

export interface CategoryBreakdown {
  category: string;
  totalSpent: number;
  expenseCount: number;
  percentage: number;
}

export interface BudgetComparison {
  budgetId: string;
  budgetName: string;
  budgetAmount: number;
  totalSpent: number;
  remaining: number;
  percentageUsed: number;
  status: 'under' | 'on-track' | 'over';
}

/** The latest balance a bank has told us about, for one account. */
export interface AccountBalance {
  /** Masked identifier, as the alert states it. */
  account: string;
  balance: number;
  currency: string;
  /** Date of the alert this balance came from. */
  asOf: string;
  /** How many alerts we have seen for this account. */
  transactions: number;
}

/**
 * What the user actually has, as far as their banks have said.
 *
 * This is REPORTED, never computed. It is the balance the bank itself stated
 * in its most recent alert per account, not a running total of imported
 * transactions - a derived total would drift from reality the moment anything
 * happened without an alert, and would then be confidently wrong rather than
 * honestly stale.
 */
export interface BalanceSummary {
  /** Sum of the latest balance across every identified account. */
  total: number;
  currency: string;
  /** Oldest `asOf` among the accounts: how stale the TOTAL is. */
  asOf: string | null;
  accounts: AccountBalance[];
  /**
   * Alerts whose account could not be identified.
   *
   * Excluded from the total rather than guessed at. Attributing one to the
   * wrong account would count the same money twice, and a balance that is
   * silently too high is worse than one the UI can flag as incomplete.
   */
  unattributed: number;
}

export interface DashboardOverview {
  totalSpent: number;
  totalExpenses: number;
  averageMonthlyExpense: number;
  currentMonthSpent: number;
  currentMonthExpenses: number;

  /** Money in. Transfers between the user's own accounts are excluded. */
  totalIncome: number;
  totalIncomeRecords: number;
  currentMonthIncome: number;
  currentMonthIncomeRecords: number;

  /**
   * This month's income minus this month's spending. Negative means more went
   * out than came in, which is the number most people actually want and which
   * no single-direction figure can express.
   */
  currentMonthNet: number;
}
