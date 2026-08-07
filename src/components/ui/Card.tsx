import { cn } from '@/lib/utils'

type CardProps = React.HTMLAttributes<HTMLDivElement>

/**
 * Een bordje op het beton. De witte vulling doet het werk: omdat de
 * achtergrond grijs is, staat een kaart er zichtbaar op zonder dat er een
 * zware rand of slagschaduw aan te pas komt.
 */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-xl border border-concrete-line bg-plate shadow-plate', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn('border-b border-concrete-line px-4 py-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-ink', className)} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return <div className={cn('border-t border-concrete-line px-4 py-3', className)} {...props} />
}
