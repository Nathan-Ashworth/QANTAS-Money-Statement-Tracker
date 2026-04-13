import type { Transaction } from '../types'
import Card from './Card'
import { fmtNum } from '../utils/format'

type Props = {
  warnings: Transaction[]
  unknowns: Transaction[]
  excluded: Transaction[]
}

export default function ReviewQueue({ warnings, unknowns, excluded }: Props) {
  const empty = warnings.length === 0 && unknowns.length === 0 && excluded.length === 0

  return (
    <Card title="Review queue">
      {empty ? (
        <p className="muted">No review items flagged from the current data set.</p>
      ) : (
        <div className="stack-md">
          {warnings.length > 0 && (
            <section className="stack-sm">
              <h3 className="subheading">Rows needing review</h3>
              {warnings.map((txn) => (
                <div key={`warn-${txn.id}`} className="flag-card warn-bg">
                  <strong>{txn.merchantName || txn.details || txn.transactionTypeRaw}</strong>
                  <div className="muted small">Row {txn.rowNumber} · {txn.transactionTypeRaw} · {fmtNum(txn.amount)}</div>
                </div>
              ))}
            </section>
          )}

          {unknowns.length > 0 && (
            <section className="stack-sm">
              <h3 className="subheading">Unknown transaction types</h3>
              {unknowns.map((txn) => (
                <div key={`unknown-${txn.id}`} className="flag-card bad-bg">
                  <strong>{txn.transactionTypeRaw || 'Unknown type'}</strong>
                  <div className="muted small">Row {txn.rowNumber} · {txn.merchantName || txn.details || 'No details'}</div>
                </div>
              ))}
            </section>
          )}

          {excluded.length > 0 && (
            <section className="stack-sm">
              <h3 className="subheading">Excluded rows</h3>
              {excluded.map((txn) => (
                <div key={`excluded-${txn.id}`} className="flag-card neutral-bg">
                  <strong>{txn.merchantName || txn.details || txn.transactionTypeRaw}</strong>
                  <div className="muted small">{fmtNum(txn.amount)} · {txn.note || 'No note added'}</div>
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </Card>
  )
}
