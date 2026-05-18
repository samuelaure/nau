import * as React from 'react'
import { cn } from '@/modules/shared/utils'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null)

    const setRef = React.useCallback(
      (el: HTMLTextAreaElement | null) => {
        ;(innerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
      },
      [ref],
    )

    const resize = React.useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [])

    React.useLayoutEffect(() => {
      resize()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.value, props.defaultValue])

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        resize()
        onChange?.(e)
      },
      [onChange, resize],
    )

    return (
      <textarea
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-hidden resize-none',
          className,
        )}
        ref={setRef}
        onChange={handleChange}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
