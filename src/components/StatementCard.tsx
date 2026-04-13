import type { Statement } from '../types'
import { fmtNum, formatDate } from '../utils/format'
import Card from './Card'

export default function StatementCard({ statement }: { statement: Statement }) {
  const statusClass =
    statement.status === 'retained'
      ? 'status-good'
      : statement.status === 'cannot_confirm'
        ? 'status-warn'
        : statement.status === 'pending'
          ? 'status-info'
          : 'status-bad'

  const statusLabel =
    statement.status === 'retained'
      ? 'Requirement met'
      : statement.status === 'pending'
        ? 'Payment required'
        : statement.status === 'cannot_confirm'
          ? 'Cannot confirm'
          : 'Deadline missed'

  return (
    <Card
      className="stack-sm"
      title={`${formatDate(statement.startDate)} to ${formatDate(statement.endDate)}`}
      right={<span className={`status-pill ${statusClass}`}>{statusLabel}</span>}
    >
      <p className="muted">Due {formatDate(statement.dueDate)}</p>
      <div className="action-banner">
        <div className="eyebrow">Action required</div>
        <strong>
          {statement.status === 'retained'
            ? `No further payment required by ${formatDate(statement.dueDate)}`
            : statement.status === 'cannot_confirm'
              ? 'Upload earlier history to confirm the real payment requirement.'
              : `Pay ${fmtNum(statement.paymentGap)} by ${formatDate(statement.dueDate)} to avoid interest`}
        </strong>
        {statement.status === 'lost' && (
          <div className="muted small pad-top">Estimated retail purchase interest for this cycle: {fmtNum(statement.estimatedInterestExposure)} at {statement.purchaseApr.toFixed(2)}% APR.</div>
        )}
        {statement.status === 'pending' && statement.paymentGap > 0 && (
          <div className="muted small pad-top">Estimated retail purchase interest if unpaid through the cycle: {fmtNum(statement.estimatedInterestExposure)} at {statement.purchaseApr.toFixed(2)}% APR.</div>
        )}
      </div>
      <p className="body-copy">{statement.diagnosis}</p>
      <div className="metric-grid">
        <div className="metric-box"><span className="eyebrow">Opening balance</span><strong>{fmtNum(statement.openingBalance)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Charges in period</span><strong>{fmtNum(statement.inPeriodCharges)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Payments in period</span><strong>{fmtNum(statement.inPeriodPayments)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Closing balance</span><strong>{fmtNum(statement.closingBalance)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Payments counted</span><strong>{fmtNum(statement.paymentsByDueDate)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Shortfall</span><strong>{fmtNum(statement.paymentGap)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Estimated interest</span><strong>{fmtNum(statement.estimatedInterestExposure)}</strong></div>
        <div className="metric-box"><span className="eyebrow">Retail purchase APR</span><strong>{statement.purchaseApr.toFixed(2)}%</strong></div>
      </div>
    </Card>
  )
}
