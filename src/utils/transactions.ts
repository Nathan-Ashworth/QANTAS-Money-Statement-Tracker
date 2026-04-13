import Papa from 'papaparse'
import type { ProcessedData, RawCsvRow, Statement, Transaction, TransactionClass } from '../types'
import { fmtNum, formatDate } from './format'

export function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const clean = String(value).trim()
  const parsed = new Date(clean)
  if (!Number.isNaN(parsed.getTime())) return parsed

  const parts = clean.split(/[\/-]/)
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number)
    const alt = new Date(y, m - 1, d)
    if (!Number.isNaN(alt.getTime())) return alt
  }

  return null
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function endOfStatementForDate(date: Date, statementEndDay: number): Date {
  const y = date.getFullYear()
  const m = date.getMonth()
  const currentMonthEnd = new Date(y, m + 1, 0).getDate()
  const safeDay = Math.min(statementEndDay, currentMonthEnd)
  const candidate = new Date(y, m, safeDay)

  if (date <= candidate) return candidate

  const nextMonthDays = new Date(y, m + 2, 0).getDate()
  return new Date(y, m + 1, Math.min(statementEndDay, nextMonthDays))
}

export function startOfStatement(endDate: Date, statementEndDay: number): Date {
  const prevMonth = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1)
  const prevMonthLastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate()
  const safeDay = Math.min(statementEndDay, prevMonthLastDay)
  return new Date(prevMonth.getFullYear(), prevMonth.getMonth(), safeDay + 1)
}

export function classifyType(rawType: string | undefined): TransactionClass {
  switch ((rawType || '').trim().toUpperCase()) {
    case 'CREDIT CARD PURCHASE':
      return 'purchase'
    case 'MISCELLANEOUS DEBIT':
      return 'debit'
    case 'CREDIT CARD PAYMENT':
      return 'payment'
    case 'CREDIT CARD REFUND':
      return 'refund'
    case 'INTEREST CHARGED':
      return 'interest'
    default:
      return 'ignored'
  }
}

function normalizeAmount(rawAmount: number, transactionClass: TransactionClass): number {
  if (Number.isNaN(rawAmount)) return 0
  switch (transactionClass) {
    case 'purchase':
    case 'debit':
    case 'payment':
    case 'refund':
    case 'interest':
      return Math.abs(rawAmount)
    default:
      return rawAmount
  }
}

export function makeTransactionFingerprint(row: Partial<RawCsvRow>): string {
  return [
    String(row.Date || '').trim(),
    String(row.Amount || '').trim(),
    String(row['Transaction Type'] || '').trim(),
    String(row['Transaction Details'] || '').trim(),
    String(row['Merchant Name'] || '').trim(),
    String(row['Processed On'] || '').trim(),
  ].join('|')
}

export function parseCsvText(text: string): { headers: string[]; rows: RawCsvRow[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header, index) => header.trim() || `Unnamed_${index}`,
  })

  const headers = parsed.meta.fields ?? []
  const rows: RawCsvRow[] = parsed.data.map((row, index) => ({
    _row: index + 2,
    Date: row.Date || '',
    Amount: row.Amount || '',
    'Transaction Type': row['Transaction Type'] || '',
    'Transaction Details': row['Transaction Details'] || '',
    Category: row.Category || '',
    'Merchant Name': row['Merchant Name'] || '',
    'Processed On': row['Processed On'] || '',
    ...row,
  }))

  return { headers, rows }
}

export function processRows(args: {
  rows: RawCsvRow[]
  statementEndDay: number
  dueDays: number
  exclusions: Record<string, boolean>
  notes: Record<string, string>
  accountStartsAtFirstTransaction: boolean
  purchaseApr: number
}): ProcessedData {
  const { rows, statementEndDay, dueDays, exclusions, notes, accountStartsAtFirstTransaction, purchaseApr } = args
  const warnings: string[] = []

  const txns: Transaction[] = rows
    .map((row, idx) => {
      const date = parseDate(row.Date)
      const rawAmount = Number(String(row.Amount || '').replace(/,/g, ''))
      const transactionClass = classifyType(row['Transaction Type'])
      const amount = normalizeAmount(rawAmount, transactionClass)
      const fingerprint = makeTransactionFingerprint(row)
      const isExcluded = Boolean(exclusions[fingerprint])
      const note = notes[fingerprint] || ''

      if (!date) warnings.push(`Row ${row._row || idx + 2}: invalid Date`)
      if (Number.isNaN(rawAmount)) warnings.push(`Row ${row._row || idx + 2}: invalid Amount`)
      if (transactionClass === 'ignored') warnings.push(`Row ${row._row || idx + 2}: unknown Transaction Type '${row['Transaction Type'] || ''}'`)

      const statementEnd = date ? endOfStatementForDate(date, statementEndDay) : null
      const dueDate = statementEnd ? addDays(statementEnd, dueDays) : null
      const statementId = statementEnd
        ? `${statementEnd.getFullYear()}-${String(statementEnd.getMonth() + 1).padStart(2, '0')}-${String(statementEnd.getDate()).padStart(2, '0')}`
        : 'unknown'

      return {
        id: `${idx}-${row.Date}-${row.Amount}-${row['Transaction Type']}`,
        fingerprint,
        rowNumber: row._row || idx + 2,
        date,
        processedOn: parseDate(row['Processed On']),
        amount,
        rawAmount: Number.isNaN(rawAmount) ? 0 : rawAmount,
        transactionClass,
        transactionTypeRaw: row['Transaction Type'] || '',
        details: row['Transaction Details'] || '',
        category: row.Category || '',
        merchantName: row['Merchant Name'] || '',
        statementEnd,
        statementStart: statementEnd ? startOfStatement(statementEnd, statementEndDay) : null,
        dueDate,
        statementId,
        excluded: isExcluded,
        note,
        hasWarning: !date || Number.isNaN(rawAmount) || transactionClass === 'ignored',
      }
    })
    .filter((t) => t.date)
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()))

  const activeTxns = txns.filter((t) => !t.excluded)

  const grouped = activeTxns.reduce<Record<string, Statement>>((acc, txn) => {
    if (!acc[txn.statementId]) {
      acc[txn.statementId] = {
        id: txn.statementId,
        startDate: txn.statementStart,
        endDate: txn.statementEnd,
        dueDate: txn.dueDate,
        transactions: [],
        totals: { purchases: 0, debits: 0, payments: 0, refunds: 0, interest: 0 },
        openingBalance: 0,
        inPeriodCharges: 0,
        inPeriodRefunds: 0,
        inPeriodPayments: 0,
        closingBalance: 0,
        requiredPayment: 0,
        paymentsByDueDate: 0,
        paymentsAvailableForThisStatement: 0,
        paymentGap: 0,
        status: 'cannot_confirm',
        diagnosis: 'Not yet processed.',
        purchaseApr,
        estimatedInterestExposure: 0,
        actualInterestCharged: 0,
        cycleDays: 0,
      }
    }

    acc[txn.statementId].transactions.push(txn)
    if (txn.transactionClass === 'purchase') acc[txn.statementId].totals.purchases += txn.amount
    if (txn.transactionClass === 'debit') acc[txn.statementId].totals.debits += txn.amount
    if (txn.transactionClass === 'payment') acc[txn.statementId].totals.payments += txn.amount
    if (txn.transactionClass === 'refund') acc[txn.statementId].totals.refunds += txn.amount
    if (txn.transactionClass === 'interest') acc[txn.statementId].totals.interest += txn.amount
    return acc
  }, {})

  const sortedStatementIds = Object.keys(grouped).sort((a, b) => {
    const aTime = grouped[a].endDate?.getTime() ?? 0
    const bTime = grouped[b].endDate?.getTime() ?? 0
    return aTime - bTime
  })

  const statements: Statement[] = []
  let runningBalanceAtClose = 0
  let unallocatedPayments: Array<{ id: string; date: Date; remaining: number }> = []
  const importStartDate = activeTxns[0]?.date || null

  sortedStatementIds.forEach((id, index) => {
    const statement = grouped[id]
    const periodPayments = statement.transactions
      .filter((t) => t.transactionClass === 'payment')
      .reduce((sum, t) => sum + t.amount, 0)
    const inPeriodCharges = statement.totals.purchases + statement.totals.debits + statement.totals.interest
    const inPeriodRefunds = statement.totals.refunds
    const openingBalance = runningBalanceAtClose
    const closingBalance = Math.max(openingBalance + inPeriodCharges - inPeriodRefunds - periodPayments, 0)
    const requiredPayment = closingBalance

    const statementPaymentsWindow = activeTxns
      .filter((t) => t.transactionClass === 'payment' && t.date! > statement.endDate! && t.date! <= statement.dueDate!)
      .map((t) => ({ id: t.id, date: t.date!, remaining: t.amount }))

    unallocatedPayments = [...unallocatedPayments, ...statementPaymentsWindow].sort((a, b) => a.date.getTime() - b.date.getTime())

    let paymentsAllocatedToThisStatement = 0
    let outstandingForThisStatement = requiredPayment

    for (const payment of unallocatedPayments) {
      if (outstandingForThisStatement <= 0) break
      if (payment.remaining <= 0) continue
      const applied = Math.min(payment.remaining, outstandingForThisStatement)
      payment.remaining -= applied
      outstandingForThisStatement -= applied
      paymentsAllocatedToThisStatement += applied
    }

    unallocatedPayments = unallocatedPayments.filter((p) => p.remaining > 0.0001)

    const firstStatementHasIncompleteHistory =
      !accountStartsAtFirstTransaction &&
      index === 0 && importStartDate && statement.startDate && importStartDate > statement.startDate

    const dueDatePassed = Boolean(statement.dueDate && statement.dueDate < new Date())

    let status: Statement['status'] = outstandingForThisStatement <= 0 ? 'retained' : dueDatePassed ? 'lost' : 'pending'
    if (firstStatementHasIncompleteHistory) status = 'cannot_confirm'

    const cycleDays = statement.startDate && statement.endDate
      ? Math.max(1, Math.round((statement.endDate.getTime() - statement.startDate.getTime()) / 86400000) + 1)
      : 31
    const estimatedInterestExposure = Math.max(outstandingForThisStatement, 0) * (purchaseApr / 100) * (cycleDays / 365)
    const actualInterestCharged = statement.totals.interest

    let diagnosis = 'No issue detected.'
    if (firstStatementHasIncompleteHistory) {
      diagnosis = 'Opening history is incomplete. This statement cannot be confirmed from the current import alone.'
    } else if (statement.totals.interest > 0 && status === 'lost') {
      diagnosis = `Deadline missed. Estimated retail purchase interest exposure for this cycle is ${fmtNum(estimatedInterestExposure)} at ${purchaseApr.toFixed(2)}% APR.`
    } else if (statement.totals.interest > 0 && status === 'retained') {
      diagnosis = 'Interest may be trailing interest from an earlier statement period.'
    } else if (status === 'pending') {
      diagnosis = `Pay ${fmtNum(Math.max(outstandingForThisStatement, 0))} by ${formatDate(statement.dueDate)} to avoid interest. Estimated retail purchase interest exposure if unpaid through the cycle is ${fmtNum(estimatedInterestExposure)}.`
    } else if (status === 'lost') {
      diagnosis = `The due date has passed and this statement does not appear fully paid. Estimated retail purchase interest exposure for this cycle is ${fmtNum(estimatedInterestExposure)} at ${purchaseApr.toFixed(2)}% APR.`
    }

    runningBalanceAtClose = closingBalance

    statements.push({
      ...statement,
      openingBalance,
      inPeriodCharges,
      inPeriodRefunds,
      inPeriodPayments: periodPayments,
      closingBalance,
      requiredPayment,
      paymentsByDueDate: paymentsAllocatedToThisStatement,
      paymentsAvailableForThisStatement: paymentsAllocatedToThisStatement,
      paymentGap: Math.max(outstandingForThisStatement, 0),
      status,
      diagnosis,
      purchaseApr,
      estimatedInterestExposure,
      actualInterestCharged,
      cycleDays,
    })
  })

  const totals = activeTxns.reduce(
    (acc, txn) => {
      if (txn.transactionClass === 'purchase') acc.purchases += txn.amount
      if (txn.transactionClass === 'debit') acc.debits += txn.amount
      if (txn.transactionClass === 'payment') acc.payments += txn.amount
      if (txn.transactionClass === 'refund') acc.refunds += txn.amount
      if (txn.transactionClass === 'interest') acc.interest += txn.amount
      if (txn.transactionClass === 'ignored') acc.ignored += 1
      return acc
    },
    { purchases: 0, debits: 0, payments: 0, refunds: 0, interest: 0, ignored: 0 },
  )

  const currentStatement = statements[statements.length - 1] || null
  const totalOwing = Math.max(totals.purchases + totals.debits + totals.interest - totals.payments - totals.refunds, 0)
  const overdueAmount = statements
    .filter((s) => s.status !== 'cannot_confirm' && s.dueDate && s.dueDate < new Date() && s.paymentGap > 0)
    .reduce((sum, s) => sum + s.paymentGap, 0)

  const unknownTransactions = txns.filter((t) => t.transactionClass === 'ignored')
  const excludedCount = txns.filter((t) => t.excluded).length
  const warningTransactions = txns.filter((t) => t.hasWarning)

  return {
    txns,
    activeTxns,
    totals,
    statements,
    currentStatement,
    totalOwing,
    overdueAmount,
    warnings,
    unknownTransactions,
    excludedCount,
    warningTransactions,
  }
}
