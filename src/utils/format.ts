export const currency = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
})

export function fmtNum(value: number): string {
  return currency.format(Number(value || 0))
}

export function formatDate(date: Date | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
