import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'block w-full rounded-lg border px-4 py-3 text-base transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-arena-red/20 focus:border-arena-red',
            error ? 'border-red-400' : 'border-gray-300',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
