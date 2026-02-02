import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2 pl-1">
                    {label}
                </label>
            )}
            <input
                className={`
          w-full px-4 py-2.5
          bg-white/5 border border-card rounded-xl
          text-main placeholder:text-muted/50
          transition-all duration-200
          focus:bg-white/8 focus:border-primary focus:ring-4 focus:ring-primary/10
          focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-danger focus:border-danger focus:ring-danger/10' : ''}
          ${className}
        `}
                {...props}
            />
            {error && <p className="mt-1.5 text-xs text-danger pl-1">{error}</p>}
        </div>
    );
}
