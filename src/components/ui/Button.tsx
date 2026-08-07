import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Rood betekent in deze app één ding: hier moet je iets doen. Daarom is het
 * voorbehouden aan de primaire actie en niet aan koppen of cijfers.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-arena-red text-white active:bg-arena-press',
        secondary: 'bg-ink text-plate active:bg-ink/90',
        outline: 'border border-concrete-deep bg-plate text-ink active:bg-concrete-light',
        ghost: 'text-ink active:bg-concrete-light',
        destructive: 'bg-arena-press text-white active:bg-arena-red',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-base',
        lg: 'h-14 px-6 text-lg',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = 'Button'

export { Button, buttonVariants }
