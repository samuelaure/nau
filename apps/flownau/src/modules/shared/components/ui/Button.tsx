import * as React from 'react'
import { cn } from '@/modules/shared/utils'
import { Loader2 } from 'lucide-react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
        const variants = {
            primary: 'btn-primary', // Uses globals.css class
            secondary: 'btn-secondary', // Uses globals.css class
            ghost: 'bg-transparent hover:bg-white/5 text-text-primary',
            outline: 'bg-transparent border border-border text-text-primary hover:bg-white/5',
            danger: 'bg-error/10 text-error hover:bg-error/20 border border-error/20',
        }

        const sizes = {
            sm: 'px-3 py-1.5 text-xs',
            md: '', // base classes handle this
            lg: 'px-8 py-4 text-lg',
        }

        return (
            <button
                className={cn(
                    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
                    variants[variant],
                    size !== 'md' && sizes[size], // specific size overrides if needed
                    className
                )}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {children}
            </button>
        )
    }
)
Button.displayName = 'Button'

export { Button }
