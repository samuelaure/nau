'use client'

import { useCallback, useRef, useState } from 'react'
import { Mic, Square, Loader2, Send } from 'lucide-react'
import { useCaptureText, useCaptureVoice } from '@/hooks/use-captures-api'
import { useUiStore } from '@/lib/state/ui-store'

/**
 * Writing or speaking a journal entry.
 *
 * Recording is held entirely in the browser until the user stops, then uploaded
 * in one go. Streaming it would mean a half-entry existing server-side if the
 * tab closes mid-thought, and a journal should never hold a fragment the person
 * did not choose to keep.
 */
export function JournalCapture() {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId)

  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const captureText = useCaptureText()
  const captureVoice = useCaptureVoice()
  const busy = captureText.isPending || captureVoice.isPending

  const submitText = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    setError(null)
    captureText.mutate(
      { text: trimmed, workspaceId: activeWorkspaceId ?? undefined },
      {
        // Cleared only after the server confirms. Clearing on submit loses the
        // text if the request fails, and it is not recoverable anywhere.
        onSuccess: () => setText(''),
        onError: (e) => setError(e instanceof Error ? e.message : String(e)),
      },
    )
  }, [text, activeWorkspaceId, captureText])

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      startedAtRef.current = new Date().toISOString()

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType })
        if (audio.size === 0) {
          setError('The recording came out empty.')
          return
        }
        captureVoice.mutate(
          {
            audio,
            workspaceId: activeWorkspaceId ?? undefined,
            // When the user started speaking, not when the upload finished.
            capturedAt: startedAtRef.current ?? undefined,
          },
          { onError: (e) => setError(e instanceof Error ? e.message : String(e)) },
        )
      }

      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } catch {
      setError('Microphone unavailable. Check the browser permission.')
    }
  }, [activeWorkspaceId, captureVoice])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    stopTimer()
    setRecording(false)
  }, [])

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitText()
        }}
        placeholder="¿Qué está pasando?"
        rows={3}
        disabled={busy || recording}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-neutral-400 disabled:opacity-50"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {recording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white"
            >
              <Square size={14} /> Detener · {mmss}
            </button>
          ) : (
            <button
              onClick={startRecording}
              disabled={busy}
              title="Grabar una nota de voz"
              className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
            >
              <Mic size={14} /> Voz
            </button>
          )}

          {captureVoice.isPending && (
            <span className="flex items-center gap-2 text-xs text-neutral-500">
              <Loader2 size={12} className="animate-spin" /> Transcribiendo…
            </span>
          )}
        </div>

        <button
          onClick={submitText}
          disabled={busy || recording || !text.trim()}
          className="flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {captureText.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Guardar
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
