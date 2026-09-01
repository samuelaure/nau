'use client'

import { FormEvent, useState } from 'react'
import { BookOpen, CheckSquare, Lightbulb, Loader2, Send } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { useCreateNote } from '@/references/use-notes'
import { useCreateJournalEntry } from '@/journal/use-journal-api'
import { useCreateActionItem } from '@/actions/use-action-items'
import { useUpsertPlanning } from '@/hooks/use-schedule-api'

type CaptureKind = 'note' | 'journal' | 'action'

const CAPTURE_OPTIONS: Array<{ id: CaptureKind; label: string; hint: string; icon: typeof Lightbulb }> = [
  { id: 'note', label: 'Capturar idea', hint: 'Para revisar u organizar después', icon: Lightbulb },
  { id: 'journal', label: 'Registrar experiencia', hint: 'Algo que quieres recordar', icon: BookOpen },
  { id: 'action', label: 'Planificar acción', hint: 'Algo que quieres hacer', icon: CheckSquare },
]

/** The only entry point for a thought on Home. The user assigns intent once. */
export function HomeCapture() {
  const workspaceId = useActiveWorkspaceId()
  const [kind, setKind] = useState<CaptureKind>('note')
  const [text, setText] = useState('')
  const [planToday, setPlanToday] = useState(true)
  const [daily, setDaily] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createNote = useCreateNote()
  const createJournal = useCreateJournalEntry()
  const createAction = useCreateActionItem()
  const upsertPlanning = useUpsertPlanning()

  const busy = createNote.isPending || createJournal.isPending || createAction.isPending || upsertPlanning.isPending
  const selected = CAPTURE_OPTIONS.find((option) => option.id === kind)!

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    setError(null)
    try {
      if (kind === 'note') {
        await createNote.mutateAsync({ content: value, title: null, workspaceId: workspaceId ?? undefined })
      } else if (kind === 'journal') {
        await createJournal.mutateAsync({ text: value, date: new Date().toISOString(), workspaceId: workspaceId ?? undefined })
      } else {
        const action = await createAction.mutateAsync({ text: value, workspaceId: workspaceId ?? undefined })
        if (planToday || daily) {
          await upsertPlanning.mutateAsync({
            blockId: action.id,
            scale: 'day',
            anchor: new Date().toISOString(),
            recurrence: daily ? 'FREQ=DAILY' : null,
            recurrenceMode: 'FIXED',
          })
        }
      }
      setText('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Tu texto sigue aquí.')
    }
  }

  return (
    <section aria-label="Captura rápida" className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Tu día, de un vistazo</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Captura ahora; decide y mueve después entre los períodos.</p>
        </div>
      </div>
      <div role="tablist" aria-label="Tipo de captura" className="mb-3 flex flex-wrap gap-2">
        {CAPTURE_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = option.id === kind
          return <button key={option.id} type="button" role="tab" aria-selected={active} onClick={() => setKind(option.id)} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors', active ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300')}><Icon className="h-4 w-4" />{option.label}</button>
        })}
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor="home-capture">{selected.label}</label>
        <textarea id="home-capture" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit(event) }} placeholder={kind === 'note' ? 'Una idea, enlace o recordatorio…' : kind === 'journal' ? '¿Qué pasó? ¿Qué quieres recordar?' : '¿Qué necesitas hacer?'} rows={3} className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:focus:bg-gray-900" />
        {kind === 'action' && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600 dark:text-gray-300"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={planToday} onChange={(event) => setPlanToday(event.target.checked)} /> Planificar hoy</label><label className="inline-flex items-center gap-2"><input type="checkbox" checked={daily} onChange={(event) => { setDaily(event.target.checked); if (event.target.checked) setPlanToday(true) }} /> Repetir cada día</label></div>}
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-gray-400">⌘/Ctrl + Enter para guardar</p><button disabled={busy || !text.trim()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{kind === 'action' ? 'Añadir' : 'Guardar'}</button></div>
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      </form>
    </section>
  )
}
