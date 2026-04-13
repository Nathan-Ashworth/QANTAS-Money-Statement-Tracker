export const REQUIRED_COLUMNS = ['Date', 'Amount', 'Transaction Type'] as const

export const STORAGE_KEYS = {
  rows: 'qantas_tracker_rows',
  fileName: 'qantas_tracker_file_name',
  statementEndDay: 'qantas_tracker_statement_end_day',
  dueDays: 'qantas_tracker_due_days',
  importWarnings: 'qantas_tracker_import_warnings',
  exclusions: 'qantas_tracker_exclusions',
  notes: 'qantas_tracker_notes',
  accountStartsAtFirstTransaction: 'qantas_tracker_account_starts_at_first_transaction',
  purchaseApr: 'qantas_tracker_purchase_apr',
} as const
