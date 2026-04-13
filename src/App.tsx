import { useEffect, useMemo, useRef, useState } from 'react'
import qantasLogo from './qantas-logo.png'
import Card from './components/Card'
import SummaryGrid from './components/SummaryGrid'
import StatementCard from './components/StatementCard'
import TransactionList from './components/TransactionList'
import ReviewQueue from './components/ReviewQueue'
import type { RawCsvRow } from './types'
import { REQUIRED_COLUMNS, STORAGE_KEYS } from './utils/constants'
import { fmtNum, formatDate } from './utils/format'
import { loadJson, saveJson } from './utils/storage'
import { makeTransactionFingerprint, parseCsvText, parseDate, processRows } from './utils/transactions'

const tabs = ['statements', 'transactions', 'review', 'interest'] as const
const LOADING_MESSAGES = [
  'Crunching numbers...',
  'Reconciling ledger movements...',
  'Mapping statement exposures...',
  'Allocating payments against balances...',
  'Running interest diagnostics...',
] as const

type TabKey = (typeof tabs)[number]

function getImportNoticeClass(message: string): string {
  if (/saved history|history check complete|duplicate/i.test(message)) return 'info-bg'
  if (/ignored junk columns/i.test(message)) return 'info-bg'
  return 'warn-bg'
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('statements')
  const [fileName, setFileName] = useState('')
  const [statementEndDay, setStatementEndDay] = useState(22)
  const [dueDays, setDueDays] = useState(14)
  const [accountStartsAtFirstTransaction, setAccountStartsAtFirstTransaction] = useState(true)
  const [purchaseApr, setPurchaseApr] = useState(20.99)
  const [rows, setRows] = useState<RawCsvRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [loadedFromStorage, setLoadedFromStorage] = useState(false)
  const [exclusions, setExclusions] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [showOnlyWarnings, setShowOnlyWarnings] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)

  useEffect(() => {
    setRows(loadJson(STORAGE_KEYS.rows, []))
    setFileName(loadJson(STORAGE_KEYS.fileName, ''))
    setStatementEndDay(loadJson(STORAGE_KEYS.statementEndDay, 22))
    setDueDays(loadJson(STORAGE_KEYS.dueDays, 14))
    setImportWarnings(loadJson(STORAGE_KEYS.importWarnings, []))
    setExclusions(loadJson(STORAGE_KEYS.exclusions, {}))
    setNotes(loadJson(STORAGE_KEYS.notes, {}))
    setAccountStartsAtFirstTransaction(loadJson(STORAGE_KEYS.accountStartsAtFirstTransaction, true))
    setPurchaseApr(loadJson(STORAGE_KEYS.purchaseApr, 20.99))
    setLoadedFromStorage(true)
  }, [])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.rows, rows)
  }, [rows, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.fileName, fileName)
  }, [fileName, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.statementEndDay, statementEndDay)
  }, [statementEndDay, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.dueDays, dueDays)
  }, [dueDays, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.importWarnings, importWarnings)
  }, [importWarnings, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.exclusions, exclusions)
  }, [exclusions, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.notes, notes)
  }, [notes, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.accountStartsAtFirstTransaction, accountStartsAtFirstTransaction)
  }, [accountStartsAtFirstTransaction, loadedFromStorage])

  useEffect(() => {
    if (!loadedFromStorage) return
    saveJson(STORAGE_KEYS.purchaseApr, purchaseApr)
  }, [purchaseApr, loadedFromStorage])

  useEffect(() => {
    if (!isImporting) {
      setLoadingMessageIndex(0)
      return
    }

    const interval = window.setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 850)

    return () => window.clearInterval(interval)
  }, [isImporting])

  const processed = useMemo(
    () => processRows({ rows, statementEndDay, dueDays, exclusions, notes, accountStartsAtFirstTransaction, purchaseApr }),
    [rows, statementEndDay, dueDays, exclusions, notes, accountStartsAtFirstTransaction, purchaseApr],
  )

  async function handleFile(file: File) {
    setIsImporting(true)

    try {
      const text = await file.text()
      await new Promise((resolve) => window.setTimeout(resolve, 900))
      const parsed = parseCsvText(text)

      const missing = REQUIRED_COLUMNS.filter((col) => !parsed.headers.includes(col))
      if (missing.length) {
        setImportWarnings([`Missing required columns: ${missing.join(', ')}`])
        setFileName(file.name)
        return
      }

      const notices: string[] = []
      const ignoredHeaders = parsed.headers.filter((h) => h.startsWith('Unnamed') || /^Unnamed:/i.test(h) || !String(h).trim())
      if (ignoredHeaders.length) notices.push(`Ignored junk columns: ${ignoredHeaders.join(', ')}`)

      const existingFingerprints = new Set(rows.map(makeTransactionFingerprint))
      const dedupedIncoming: RawCsvRow[] = []
      let duplicateCount = 0

      for (const row of parsed.rows) {
        const fingerprint = makeTransactionFingerprint(row)
        if (existingFingerprints.has(fingerprint)) {
          duplicateCount += 1
          continue
        }
        existingFingerprints.add(fingerprint)
        dedupedIncoming.push(row)
      }

      if (duplicateCount > 0) {
        notices.push(
          `${duplicateCount} transaction${duplicateCount === 1 ? '' : 's'} already existed in saved history and ${duplicateCount === 1 ? 'was' : 'were'} not added again.`,
        )
      }

      if (duplicateCount === 0) {
        notices.push(`History check complete: ${dedupedIncoming.length} new transaction${dedupedIncoming.length === 1 ? '' : 's'} added.`)
      }

      const mergedRows = [...rows, ...dedupedIncoming].sort((a, b) => {
        const aDate = parseDate(a.Date)?.getTime() || 0
        const bDate = parseDate(b.Date)?.getTime() || 0
        return aDate - bDate
      })

      setHeaders(parsed.headers)
      setRows(mergedRows)
      setFileName(file.name)
      setImportWarnings(notices)
    } finally {
      setIsImporting(false)
    }
  }

  function clearAllData() {
    setRows([])
    setHeaders([])
    setFileName('')
    setImportWarnings([])
    setExclusions({})
    setNotes({})
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
  }

  function toggleExcluded(fingerprint: string) {
    setExclusions((prev) => ({ ...prev, [fingerprint]: !prev[fingerprint] }))
  }

  function updateNote(fingerprint: string, value: string) {
    setNotes((prev) => ({ ...prev, [fingerprint]: value }))
  }

  const currentStatementAction = processed.currentStatement
    ? processed.currentStatement.status === 'retained'
      ? `No further payment required by ${formatDate(processed.currentStatement.dueDate)}`
      : processed.currentStatement.status === 'cannot_confirm'
        ? 'Upload earlier history to confirm the amount required to avoid interest.'
        : `Pay ${fmtNum(processed.currentStatement.paymentGap)} by ${formatDate(processed.currentStatement.dueDate)} to avoid interest`
    : ''

  const currentStatementStatusClass = processed.currentStatement
    ? processed.currentStatement.status === 'retained'
      ? 'status-good'
      : processed.currentStatement.status === 'pending'
        ? 'status-info'
        : processed.currentStatement.status === 'cannot_confirm'
          ? 'status-warn'
          : 'status-bad'
    : 'status-warn'

  const currentStatementStatusLabel = processed.currentStatement
    ? processed.currentStatement.status === 'retained'
      ? 'Requirement met'
      : processed.currentStatement.status === 'pending'
        ? 'Payment required'
        : processed.currentStatement.status === 'cannot_confirm'
          ? 'Cannot confirm yet'
          : 'Deadline missed'
    : ''

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-one" />
      <div className="bg-orb bg-orb-two" />
      <div className="bg-orb bg-orb-three" />
      <div className="page-wrap">
        <header className="hero-row glass-panel glass-hero">
          <div className="hero-brand">
            <div className="brand-lockup">
              <div className="brand-mark glass-chip">
                <img src={qantasLogo} alt="Qantas Money" className="brand-logo" />
              </div>
              <div>
                <div className="eyebrow brand-eyebrow">Personal cashflow cockpit</div>
                <h1 className="page-title">Qantas Money Statement Tracker</h1>
              </div>
            </div>
            <p className="body-copy max-copy hero-copy">
              Web-based personal tracker for statement balance, payments by due date, refunds, and interest review.
            </p>
          </div>
          <div className="button-row">
            <button className="primary-btn" onClick={() => fileInputRef.current?.click()}>Upload CSV</button>
            <button className="secondary-btn" onClick={clearAllData}>Clear local data</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
          </div>
        </header>

        {isImporting && (
          <Card className="loading-card">
            <div className="loading-row">
              <div>
                <div className="eyebrow eyebrow-info">Import in progress</div>
                <div className="loading-title">{LOADING_MESSAGES[loadingMessageIndex]}</div>
                <div className="body-copy loading-copy">
                  Running balance checks, validating transaction history, and updating statement positions.
                </div>
              </div>
              <div className="loading-side-note">Capital management workflow active</div>
            </div>
            <div className="loading-bar-shell">
              <div className="loading-bar-fill" />
            </div>
          </Card>
        )}

        <div className="three-col-layout">
          <Card title="Statement settings">
            <div className="stack-sm">
              <label className="field-label">
                <span className="eyebrow">Statement closes on day of month</span>
                <input className="text-input" type="number" min={1} max={31} value={statementEndDay} onChange={(e) => setStatementEndDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
              </label>
              <label className="field-label">
                <span className="eyebrow">Due days after statement end</span>
                <input className="text-input" type="number" min={1} max={60} value={dueDays} onChange={(e) => setDueDays(Math.max(1, Math.min(60, Number(e.target.value) || 14)))} />
              </label>
              <label className="field-label">
                <span className="eyebrow">Retail purchase APR</span>
                <input className="text-input" type="number" min={0} max={99.99} step={0.01} value={purchaseApr} onChange={(e) => setPurchaseApr(Math.max(0, Number(e.target.value) || 0))} />
                <div className="muted small">Used for estimated interest exposure on unpaid retail purchase balances.</div>
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={accountStartsAtFirstTransaction}
                  onChange={(e) => setAccountStartsAtFirstTransaction(e.target.checked)}
                />
                <div>
                  <span className="eyebrow">Account opened at first imported transaction</span>
                  <div className="muted small">Use a zero opening balance and do not auto-flag the first statement as incomplete history.</div>
                </div>
              </label>
            </div>
          </Card>

          <Card title="Import status" className="span-two">
            <div className="stack-sm muted small">
              <div><span className="eyebrow">File</span> {fileName || 'No file uploaded'}</div>
              <div><span className="eyebrow">Rows stored locally</span> {rows.length}</div>
              <div><span className="eyebrow">Headers found</span> {headers.length ? headers.join(', ') : '—'}</div>
              <div><span className="eyebrow">Persistence</span> {loadedFromStorage ? 'Local browser storage active' : 'Loading local storage...'}</div>
              {importWarnings.map((warning) => (
                <div key={warning} className={`alert-row ${getImportNoticeClass(warning)}`}>{warning}</div>
              ))}
              {processed.warnings.slice(0, 3).map((warning) => (
                <div key={warning} className="alert-row warn-bg">{warning}</div>
              ))}
            </div>
          </Card>
        </div>

        <SummaryGrid
          totalPaid={processed.totals.payments}
          totalOwing={processed.totalOwing}
          overdueAmount={processed.overdueAmount}
          interestCharged={processed.totals.interest}
        />

        {processed.currentStatement && (
          <Card className="action-card">
            <div className="action-card-row">
              <div>
                <div className="eyebrow">Avoid interest</div>
                <div className="action-card-title">{currentStatementAction}</div>
                <div className="body-copy">Already counted toward this statement: {fmtNum(processed.currentStatement.paymentsByDueDate)} · Statement close balance: {fmtNum(processed.currentStatement.closingBalance)} · Statement cycle anchored to day {statementEndDay} · Retail purchase APR {purchaseApr.toFixed(2)}%</div>
                {processed.currentStatement.status !== 'cannot_confirm' && processed.currentStatement.paymentGap > 0 && (
                  <div className="muted small">Estimated interest exposure for this cycle: {fmtNum(processed.currentStatement.estimatedInterestExposure)}</div>
                )}
              </div>
              <span className={`status-pill ${currentStatementStatusClass}`}>{currentStatementStatusLabel}</span>
            </div>
          </Card>
        )}

        <Card title="Validation summary">
          <div className="metric-grid four-up">
            <div className="metric-box"><span className="eyebrow">Warning rows</span><strong>{processed.warningTransactions.length}</strong></div>
            <div className="metric-box"><span className="eyebrow">Unknown transaction types</span><strong>{processed.unknownTransactions.length}</strong></div>
            <div className="metric-box"><span className="eyebrow">Excluded rows</span><strong>{processed.excludedCount}</strong></div>
            <div className="metric-box"><span className="eyebrow">Active rows in calculations</span><strong>{processed.activeTxns.length}</strong></div>
          </div>
        </Card>

        {processed.currentStatement && (
          <Card title="Current statement">
            <div className="metric-grid four-up">
              <div className="metric-box"><span className="eyebrow">Statement period</span><strong>{formatDate(processed.currentStatement.startDate)} to {formatDate(processed.currentStatement.endDate)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Due date</span><strong>{formatDate(processed.currentStatement.dueDate)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Required payment</span><strong>{fmtNum(processed.currentStatement.requiredPayment)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Paid by due date</span><strong>{fmtNum(processed.currentStatement.paymentsAvailableForThisStatement)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Opening balance</span><strong>{fmtNum(processed.currentStatement.openingBalance)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Refunds in statement</span><strong>{fmtNum(processed.currentStatement.inPeriodRefunds)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Payments in statement</span><strong>{fmtNum(processed.currentStatement.inPeriodPayments)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Shortfall by due date</span><strong>{fmtNum(processed.currentStatement.paymentGap)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Estimated interest exposure</span><strong>{fmtNum(processed.currentStatement.estimatedInterestExposure)}</strong></div>
              <div className="metric-box"><span className="eyebrow">Retail purchase APR</span><strong>{purchaseApr.toFixed(2)}%</strong></div>
            </div>
            <div className="pad-top">
              <span className={`status-pill ${currentStatementStatusClass}`}>
                {currentStatementStatusLabel}
              </span>
              <p className="body-copy">{processed.currentStatement.diagnosis}</p>
            </div>
          </Card>
        )}

        <nav className="tab-grid" aria-label="Sections">
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? 'tab-btn tab-active' : 'tab-btn'} onClick={() => setActiveTab(tab)}>
              {tab === 'interest' ? 'Interest review' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {activeTab === 'statements' && (
          <div className="stack-md">
            {processed.statements.length === 0 ? (
              <Card title="Statements"><p className="muted">Upload a CSV to generate statement periods.</p></Card>
            ) : (
              processed.statements.map((statement) => <StatementCard key={statement.id} statement={statement} />)
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <Card title="Imported transactions">
            <TransactionList
              transactions={processed.txns}
              showOnlyWarnings={showOnlyWarnings}
              onToggleShowWarnings={() => setShowOnlyWarnings((prev) => !prev)}
              onToggleExcluded={toggleExcluded}
              onUpdateNote={updateNote}
            />
          </Card>
        )}

        {activeTab === 'review' && (
          <ReviewQueue
            warnings={processed.warningTransactions}
            unknowns={processed.unknownTransactions}
            excluded={processed.txns.filter((txn) => txn.excluded)}
          />
        )}

        {activeTab === 'interest' && (
          <Card title="Interest review">
            {processed.txns.filter((t) => t.transactionClass === 'interest').length === 0 ? (
              <p className="muted">No interest rows detected in the current import.</p>
            ) : (
              <div className="stack-md">
                {processed.txns
                  .filter((t) => t.transactionClass === 'interest')
                  .map((txn) => {
                    const statement = processed.statements.find((s) => s.id === txn.statementId)
                    return (
                      <article key={txn.id} className="txn-card">
                        <div className="toolbar-row start">
                          <div>
                            <div className="txn-title">Interest charged on {formatDate(txn.date)}</div>
                            <div className="muted small">{txn.details || 'Interest charge detected in import.'}</div>
                          </div>
                          <div className="txn-amount">{fmtNum(txn.amount)}</div>
                        </div>
                        <div className="metric-grid three-up">
                          <div className="metric-box"><span className="eyebrow">Likely cause</span><strong>{statement?.diagnosis || 'Incomplete history. Interest may relate to an earlier statement.'}</strong></div>
                          <div className="metric-box"><span className="eyebrow">Related statement</span><strong>{statement ? `${formatDate(statement.startDate)} to ${formatDate(statement.endDate)}` : 'Not matched'}</strong></div>
                          <div className="metric-box"><span className="eyebrow">Remaining shortfall</span><strong>{statement ? fmtNum(statement.paymentGap) : '—'}</strong></div>
                        </div>
                      </article>
                    )
                  })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
