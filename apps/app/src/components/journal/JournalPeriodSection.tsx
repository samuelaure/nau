'use client'

import { FormEvent, useState } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import type { JournalEntryView } from '@/journal/use-journal-api'
import { useCreateJournalEntry, useDeleteJournalEntry, useUpdateJournalEntry } from '@/journal/use-journal-api'
import { EditableText } from './EditableText'

/** Journal belongs in the day it was lived; it is not a competing destination. */
export function JournalPeriodSection({ entries, date, workspaceId }: { entries: JournalEntryView[]; date: Date; workspaceId?: string }) {
  const [open, setOpen] = useState(true)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const create = useCreateJournalEntry()
  const update = useUpdateJournalEntry()
  const remove = useDeleteJournalEntry()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    await create.mutateAsync({ text: value, date: date.toISOString(), workspaceId })
    setText('')
    setAdding(false)
  }

  return <section className="mb-4">
    <div className="flex items-center">
      <button onClick={() => setOpen((value) => !value)} className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        <BookOpen className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Experiencias</h3>
        {entries.length > 0 && <span className="text-xs text-gray-400">{entries.length}</span>}
      </button>
      <button type="button" onClick={() => { setOpen(true); setAdding(true) }} className="mr-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"><Plus className="h-3.5 w-3.5" /> Registrar</button>
    </div>
    {open && <div className="ml-6 mt-1 space-y-2 border-l border-violet-100 pl-4 dark:border-violet-900/60">
      {entries.map((entry) => <JournalEntry key={entry.id} entry={entry} workspaceId={workspaceId} onUpdate={(text) => update.mutate({ id: entry.id, text, workspaceId })} onDelete={() => remove.mutate({ id: entry.id, workspaceId })} />)}
      {adding ? <form onSubmit={(event) => void submit(event)} className="rounded-lg bg-violet-50/70 p-2 dark:bg-violet-950/20"><textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setAdding(false); setText('') } }} rows={2} placeholder="Escribe lo que viviste o aprendiste…" className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-gray-400" /><div className="mt-1 flex justify-end gap-2"><button type="button" onClick={() => { setAdding(false); setText('') }} className="px-2 py-1 text-xs text-gray-500">Cancelar</button><button disabled={create.isPending || !text.trim()} className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">Guardar</button></div></form> : null}
      {!entries.length && !adding && <p className="py-1 text-xs text-gray-400">Nada registrado todavía.</p>}
    </div>}
  </section>
}

function JournalEntry({ entry, workspaceId, onUpdate, onDelete }: { entry: JournalEntryView; workspaceId?: string; onUpdate: (text: string) => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  return <article className="group rounded-lg py-1.5"><div className="flex gap-2"><div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" /><div className="min-w-0 flex-1"><EditableText value={entry.text} placeholder="Sin contenido" label="experiencia" onSave={onUpdate} className="text-sm leading-relaxed text-gray-700 dark:text-gray-300" /><p className="mt-1 text-[10px] text-gray-400">{new Date(entry.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}{entry.originFormat === 'voice' ? ' · voz' : ''}</p></div><button type="button" aria-label="Eliminar experiencia" title="Mover a la papelera" onClick={() => confirming ? onDelete() : setConfirming(true)} className={cn('mt-0.5 rounded p-1 text-gray-400 hover:text-red-600', confirming && 'bg-red-50 text-red-600 dark:bg-red-950/30')}>{confirming ? '¿Eliminar?' : <Trash2 className="h-3.5 w-3.5" />}</button></div></article>
}
