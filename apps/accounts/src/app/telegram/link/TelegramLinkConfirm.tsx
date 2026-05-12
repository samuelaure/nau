'use client'

import { useState } from 'react'

const NAU_API_URL = typeof window !== 'undefined' ? '' : (process.env['NEXT_PUBLIC_API_URL'] ?? 'https://api.9nau.com')

export function TelegramLinkConfirm({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'expired' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleConfirm() {
    setState('loading')
    try {
      const res = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        setState('success')
        return
      }
      const data = await res.json() as { message?: string }
      if (res.status === 401 || (data.message && data.message.toLowerCase().includes('expir'))) {
        setState('expired')
      } else {
        setErrorMsg(data.message ?? 'Error desconocido')
        setState('error')
      }
    } catch {
      setErrorMsg('Error de red')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-2xl">✅</p>
          <p className="text-lg font-medium">¡Cuenta vinculada!</p>
          <p className="text-sm text-muted-foreground">
            Tu cuenta naŭ ya está conectada con Telegram. Puedes volver al bot.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-2xl">⏰</p>
          <p className="text-lg font-medium">El enlace expiró</p>
          <p className="text-sm text-muted-foreground">
            Este enlace tiene una validez de 15 minutos. Escribe <strong>/link</strong> en el bot para generar uno nuevo.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-3">
          <p className="text-2xl">❌</p>
          <p className="text-lg font-medium">No se pudo vincular</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-2xl">🔗</p>
          <p className="text-lg font-medium">Vincular Telegram</p>
          <p className="text-sm text-muted-foreground">
            ¿Deseas vincular tu cuenta Telegram con tu cuenta naŭ Platform?
          </p>
        </div>
        <button
          onClick={handleConfirm}
          disabled={state === 'loading'}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {state === 'loading' ? 'Vinculando…' : 'Confirmar vinculación'}
        </button>
      </div>
    </div>
  )
}
