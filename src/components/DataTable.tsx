import React from 'react'
import EmptyState from './EmptyState'
import { Inbox } from 'lucide-react'

export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  className?: string
  mobileLabel?: string
}

interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => React.Key
  emptyTitle?: string
  emptyDescription?: string
}

export default function DataTable<T>({ rows, columns, rowKey, emptyTitle = 'لا توجد بيانات', emptyDescription }: DataTableProps<T>) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} icon={<Inbox className="h-6 w-6" />} />

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
        <table className="w-full min-w-[720px]">
          <thead><tr>{columns.map(column => <th key={column.key} scope="col" className="px-4 py-3 text-start text-xs font-extrabold text-slate-600">{column.header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.key} className={`px-4 py-3 text-sm text-slate-700 ${column.className || ''}`}>{column.render(row)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map(row => (
          <article key={rowKey(row)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <dl className="space-y-3">{columns.map(column => <div key={column.key} className="flex items-start justify-between gap-4"><dt className="text-xs font-bold text-slate-500">{column.mobileLabel || column.header}</dt><dd className="min-w-0 text-end text-sm text-slate-700">{column.render(row)}</dd></div>)}</dl>
          </article>
        ))}
      </div>
    </>
  )
}
