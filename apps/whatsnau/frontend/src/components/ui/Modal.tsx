import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{
                                duration: 0.2,
                                ease: [0.4, 0, 0.2, 1],
                            }}
                            className={`
                w-full ${sizeStyles[size]}
                bg-[#141221] border border-card rounded-2xl
                shadow-2xl
                max-h-[90vh] overflow-hidden
                flex flex-col
              `}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            {title && (
                                <div className="flex items-center justify-between px-6 py-4 border-b border-card bg-white/2">
                                    <h2 className="text-xl font-semibold text-main">{title}</h2>
                                    <button
                                        onClick={onClose}
                                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                        <X size={20} className="text-muted" />
                                    </button>
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">{children}</div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
