import { AlertTriangle, CreditCard, Receipt, RefreshCw } from 'lucide-react'
import Card from './Card'
import { fmtNum } from '../utils/format'

type Props = {
  totalPaid: number
  totalOwing: number
  overdueAmount: number
  interestCharged: number
}

export default function SummaryGrid({ totalPaid, totalOwing, overdueAmount, interestCharged }: Props) {
  const items = [
    { label: 'Total paid', value: fmtNum(totalPaid), icon: CreditCard },
    { label: 'Total owing', value: fmtNum(totalOwing), icon: Receipt },
    { label: 'Overdue', value: fmtNum(overdueAmount), icon: AlertTriangle },
    { label: 'Interest charged', value: fmtNum(interestCharged), icon: RefreshCw },
  ]

  return (
    <div className="summary-grid">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.label} className="summary-card">
            <div>
              <div className="eyebrow">{item.label}</div>
              <div className="summary-value">{item.value}</div>
            </div>
            <div className="icon-chip">
              <Icon size={18} />
            </div>
          </Card>
        )}
      )}
    </div>
  )
}
