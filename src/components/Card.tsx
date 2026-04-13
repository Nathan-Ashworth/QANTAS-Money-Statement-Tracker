import type { PropsWithChildren, ReactNode } from 'react'

type CardProps = PropsWithChildren<{
  title?: string
  right?: ReactNode
  className?: string
}>

export default function Card({ title, right, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || right) && (
        <div className="card-header">
          {title ? <h2 className="card-title">{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}
