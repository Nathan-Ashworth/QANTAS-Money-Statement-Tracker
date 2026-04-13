import type { Transaction } from '../types'
import { fmtNum, formatDate } from '../utils/format'

type Props = {
  transactions: Transaction[]
  showOnlyWarnings: boolean
  onToggleShowWarnings: () => void
  onToggleExcluded: (fingerprint: string) => void
  onUpdateNote: (fingerprint: string, value: string) => void
}

export default function TransactionList(props: Props) {
  const visible = props.showOnlyWarnings
    ? props.transactions.filter((t) => t.hasWarning || t.excluded)
    : props.transactions

  return (
    <div className="stack-md">
      <div className="toolbar-row">
        <p className="muted">Review, exclude, and annotate imported rows.</p>
        <button className="secondary-btn" onClick={props.onToggleShowWarnings}>
          {props.showOnlyWarnings ? 'Show all rows' : 'Show warnings only'}
        </button>
      </div>

      {visible.length === 0 && (
        <p className="muted">No transactions loaded. Upload a CSV and the data will remain saved in this browser until you clear it.</p>
      )}

      {visible
        .slice()
        .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
        .map((txn) => (
          <article key={txn.id} className="txn-card">
            <div className="toolbar-row start">
              <div>
                <div className="txn-title">{txn.merchantName || txn.details || txn.transactionTypeRaw}</div>
                <div className="muted small">{txn.transactionTypeRaw} · {txn.category || 'Uncategorised'}</div>
              </div>
              <div className="right-stack">
                <div className="txn-amount">{fmtNum(txn.amount)}</div>
                <div className="pill-row">
                  <span className="neutral-pill capitalize">{txn.transactionClass}</span>
                  {txn.hasWarning && <span className="status-pill status-warn">warning</span>}
                  {txn.excluded && <span className="neutral-pill">excluded</span>}
                </div>
              </div>
            </div>

            <div className="three-col-meta">
              <div>Date: {formatDate(txn.date)}</div>
              <div>Processed: {formatDate(txn.processedOn)}</div>
              <div>Statement end: {formatDate(txn.statementEnd)}</div>
            </div>

            <div className="toolbar-row start">
              <button className="secondary-btn" onClick={() => props.onToggleExcluded(txn.fingerprint)}>
                {txn.excluded ? 'Include in calculations' : 'Exclude from calculations'}
              </button>
              <input
                className="text-input grow"
                value={txn.note}
                onChange={(event) => props.onUpdateNote(txn.fingerprint, event.target.value)}
                placeholder="Add a note for this row"
                aria-label="Transaction note"
              />
            </div>
          </article>
        ))}
    </div>
  )
}
