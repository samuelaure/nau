import * as React from 'react'
import { cn } from '@/modules/shared/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string
    error?: string
    options?: { label: string; value: string }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, label, error, options, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="form-label">
                        {label}
                    </label>
                )}
                <select
                    className={cn(
                        'input-field',
                        error && 'border-error',
                        className
                    )}
                    ref={ref}
                    {...props}
                >
                    {options
                        ? options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))
                        : children}
                </select>
                {error && (
                    <p className="mt-1 text-xs text-error">{error}</p>
                )}
            </div>
        )
    }
)
Select.displayName = 'Select'

export { Select }
