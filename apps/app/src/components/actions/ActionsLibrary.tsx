'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Circle, FolderKanban, Plus, Repeat, Trash2 } from 'lucide-react'
import { cn } from '@9nau/ui/lib/utils'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import {
  type ActionItem,
  useCreateActionItem,
  useDeleteActionItem,
  useGetActionItems,
  useUpdateActionItem,
} from '@/actions/use-action-items'
import { useUpsertPlanning } from '@/hooks/use-schedule-api'

type ItemKind = 'action' | 'habit' | 'project' | 'routine'

const KIND_COPY: Record<ItemKind, { label: string; hint: string }> = {
  action: { label: 'Acción', hint: 'Una tarea puntual.' },
  habit: { label: 'Hábito', hint: 'Una acción que se repite cada día.' },
  project: { label: 'Proyecto', hint: 'Un resultado con un primer paso.' },
  routine: { label: 'Rutina', hint: 'Un conjunto de pasos que se repite cada día.' },
}

/**
 * The Actions domain has one persisted item kind. Action, habit, project and
 * routine are useful UI names derived from recurrence and whether it has
 * children, so this screen creates the minimum real structure for each.
 */
export function ActionsLibrary() {
  const workspaceId = useActiveWorkspaceId()
  const { data: items = [], isLoading, isError } = useGetActionItems({ workspaceId })
  const create = useCreateActionItem()
  const update = useUpdateActionItem()
  const remove = useDeleteActionItem()
  const plan = useUpsertPlanning()
  const [kind, setKind] = useState<ItemKind>('action')
  const [title, setTitle] = useState('')
  const [firstStep, setFirstStep] = useState('')
  const [error, setError] = useState<string | null>(null)

  const roots = useMemo(() => items.filter((item) => !item.parentId), [items])
  const childrenOf = (id: string) => items.filter((item) => item.parentId === id)

  const createItem = async (event: FormEvent) => {
    event.preventDefault()
    const text = title.trim()
    if (!text) return
    setError(null)
    try {
      const parent = await create.mutateAsync({ text, workspaceId: workspaceId ?? undefined })
      if (kind === 'habit' || kind === 'routine') {
        await plan.mutateAsync({
          blockId: parent.id,
          scale: 'day',
          anchor: new Date().toISOString(),
          recurrence: 'FREQ=DAILY',
          recurrenceMode: 'FIXED',
        })
      }
      if (kind === 'project' || kind === 'routine') {
        await create.mutateAsync({
          text: firstStep.trim() || 'Primer paso',
          parentId: parent.id,
          workspaceId: workspaceId ?? undefined,
        })
      }
      setTitle('')
      setFirstStep('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el elemento.')
    }
  }

  const busy = create.isPending || plan.isPending
  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Acciones</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Organiza tareas, hábitos, proyectos y rutinas. Eliminar envía el elemento a la papelera.
        </p>
      </header>

      <form onSubmit={(event) => void createItem(event)} className="rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(KIND_COPY) as ItemKind[]).map((value) => (
            <button
              type="button"
              key={value}
              onClick={() => setKind(value)}
              className={cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', kind === value ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300')}
            >
              <span className="block font-medium">{KIND_COPY[value].label}</span>
              <span className="block text-[11px] opacity-70">{KIND_COPY[value].hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={`Nombre del ${KIND_COPY[kind].label.toLowerCase()}…`}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-gray-600"
          />
          {(kind === 'project' || kind === 'routine') && (
            <input
              value={firstStep}
              onChange={(event) => setFirstStep(event.target.value)}
              placeholder="Primer paso (opcional)"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-gray-600"
            />
          )}
          <button disabled={busy || !title.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> Crear
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </form>

      {isLoading ? <p className="py-10 text-center text-sm text-gray-400">Cargando acciones…</p> : null}
      {isError ? <p className="py-10 text-center text-sm text-red-600">No se pudieron cargar las acciones.</p> : null}
      {!isLoading && !isError && (roots.length ? (
        <div className="space-y-2">{roots.map((item) => <ActionRow key={item.id} item={item} childrenOf={childrenOf} level={0} onCreateChild={async (parentId, text) => create.mutateAsync({ text, parentId, workspaceId: workspaceId ?? undefined })} onUpdate={(id, body) => update.mutateAsync({ id, body })} onDelete={(id) => remove.mutateAsync(id)} />)}</div>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500 dark:border-gray-700">Todavía no hay acciones. Crea la primera arriba.</div>
      ))}
    </section>
  )
}

function ActionRow({ item, childrenOf, level, onCreateChild, onUpdate, onDelete }: { item: ActionItem; childrenOf: (id: string) => ActionItem[]; level: number; onCreateChild: (parentId: string, text: string) => Promise<unknown>; onUpdate: (id: string, body: { text?: string; status?: 'todo' | 'done' | 'cancelled' }) => Promise<unknown>; onDelete: (id: string) => Promise<unknown> }) {
  const children = childrenOf(item.id)
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.properties.text)
  const [childText, setChildText] = useState('')
  const save = async () => { if (text.trim() && text.trim() !== item.properties.text) await onUpdate(item.id, { text: text.trim() }); setEditing(false) }
  const shape = children.length ? <><FolderKanban className="h-4 w-4" /> Proyecto</> : <><Circle className="h-3.5 w-3.5" /> Acción</>
  return <div style={{ marginLeft: `${level * 18}px` }} className="rounded-xl border bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
    <div className="group flex items-center gap-2">
      {children.length ? <button aria-label="Mostrar pasos" onClick={() => setOpen((value) => !value)} className="text-gray-400">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button> : <span className="w-4" />}
      <button aria-label="Marcar completada" onClick={() => void onUpdate(item.id, { status: item.properties.status === 'done' ? 'todo' : 'done' })} className={cn('grid h-5 w-5 place-items-center rounded-full border', item.properties.status === 'done' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 text-transparent')}><Check className="h-3.5 w-3.5" /></button>
      {editing ? <input autoFocus value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void save(); if (event.key === 'Escape') setEditing(false) }} onBlur={() => void save()} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /> : <button onClick={() => setEditing(true)} className={cn('min-w-0 flex-1 text-left text-sm', item.properties.status === 'done' && 'text-gray-400 line-through')}>{item.properties.text || 'Sin título'}</button>}
      <span className="hidden items-center gap-1 text-[10px] text-gray-400 sm:inline-flex">{shape}</span>
      <button aria-label="Eliminar elemento" title="Mover a la papelera" onClick={() => void onDelete(item.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
    </div>
    {open && <div className="mt-2 space-y-2"><div className="ml-12 flex gap-2"><input value={childText} onChange={(event) => setChildText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && childText.trim()) { void onCreateChild(item.id, childText.trim()).then(() => setChildText('')) } }} placeholder="Añadir paso…" className="w-full bg-transparent text-xs outline-none placeholder:text-gray-400" /></div>{children.map((child) => <ActionRow key={child.id} item={child} childrenOf={childrenOf} level={level + 1} onCreateChild={onCreateChild} onUpdate={onUpdate} onDelete={onDelete} />)}</div>}
  </div>
}
