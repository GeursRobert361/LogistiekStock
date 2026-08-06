import { cn } from '@/lib/utils'

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-gray-200', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <Skeleton className="mb-2 h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-3/4" />
    </div>
  )
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
