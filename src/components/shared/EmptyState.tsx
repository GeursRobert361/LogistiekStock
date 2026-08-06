interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: string
}

export function EmptyState({ title, description, action, icon = '📭' }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">{icon}</div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
