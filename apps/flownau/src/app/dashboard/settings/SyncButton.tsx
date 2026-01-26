'use client'

import { useState } from 'react'
import { RotateCw, Check, AlertCircle } from 'lucide-react'
import { triggerAssetSync } from './actions'

export default function SyncButton() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    const handleSync = async () => {
        setStatus('loading')
        setMessage('')

        try {
            const result = await triggerAssetSync()
            if (result.success) {
                setStatus('success')
                setMessage(result.message || 'Sync successful')

                // Reset after 3 seconds
                setTimeout(() => {
                    setStatus('idle')
                    setMessage('')
                }, 3000)
            } else {
                setStatus('error')
                setMessage(result.message || 'Sync failed')
            }
        } catch (e: any) {
            setStatus('error')
            setMessage(e.message || 'Error triggering sync')
        }
    }

    return (
        <div>
            <button
                onClick={handleSync}
                disabled={status === 'loading'}
                className="btn-primary"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '140px',
                    justifyContent: 'center'
                }}
            >
                {status === 'loading' && <RotateCw className="animate-spin" size={16} />}
                {status === 'success' && <Check size={16} />}
                {status === 'error' && <AlertCircle size={16} />}

                {status === 'loading' ? 'Syncing...' : status === 'success' ? 'Done' : status === 'error' ? 'Retry' : 'Sync Assets'}
            </button>
            {message && (
                <p style={{
                    fontSize: '12px',
                    marginTop: '8px',
                    color: status === 'error' ? 'var(--error-color, #ef4444)' : 'var(--text-secondary)'
                }}>
                    {message}
                </p>
            )}
        </div>
    )
}
