export type TransactionClass = 'purchase' | 'debit' | 'payment' | 'refund' | 'interest' | 'ignored'
export type StatementStatus = 'retained' | 'pending' | 'lost' | 'cannot_confirm'

export type RawCsvRow = {
  _row: number
  Date: string
  Amount: string
  'Transaction Type': string
  'Transaction Details'?: string
  Category?: string
  'Merchant Name'?: string
  'Processed On'?: string
  [key: string]: string | number | undefined
}

export type Transaction = {
  id: string
  fingerprint: string
  rowNumber: number
  date: Date | null
  processedOn: Date | null
  amount: number
  rawAmount: number
  transactionClass: TransactionClass
  transactionTypeRaw: string
  details: string
  category: string
  merchantName: string
  statementEnd: Date | null
  statementStart: Date | null
  dueDate: Date | null
  statementId: string
  excluded: boolean
  note: string
  hasWarning: boolean
}

export type Statement = {
  id: string
  startDate: Date | null
  endDate: Date | null
  dueDate: Date | null
  transactions: Transaction[]
  totals: {
    purchases: number
    debits: number
    payments: number
    refunds: number
    interest: number
  }
  openingBalance: number
  inPeriodCharges: number
  inPeriodRefunds: number
  inPeriodPayments: number
  closingBalance: number
  requiredPayment: number
  paymentsByDueDate: number
  paymentsAvailableForThisStatement: number
  paymentGap: number
  status: StatementStatus
  diagnosis: string
  purchaseApr: number
  estimatedInterestExposure: number
  actualInterestCharged: number
  cycleDays: number
}

export type ProcessedData = {
  txns: Transaction[]
  activeTxns: Transaction[]
  statements: Statement[]
  currentStatement: Statement | null
  totalOwing: number
  overdueAmount: number
  totals: {
    purchases: number
    debits: number
    payments: number
    refunds: number
    interest: number
    ignored: number
  }
  warnings: string[]
  unknownTransactions: Transaction[]
  excludedCount: number
  warningTransactions: Transaction[]
}
