import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn('card', className)} // Uses globals.css class
            {...props}
        />
    )
)
Card.displayName = 'Card'

export { Card }
