import * as React from 'react'
import { cn } from '@/modules/shared/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && <label className="form-label">{label}</label>}
        <input
          type={type}
          className={cn(
            'input-field', // Uses globals.css class
            error && 'border-error focus:ring-error',
            className,
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-error animate-fade-in">{error}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
