import { BookOpen, CalendarDays, FolderKanban, Home, ListTodo, StickyNote } from 'lucide-react'
import type { View } from './ui-store'

/** The user-facing workspace surfaces; shell only renders this configuration. */
export const WORKSPACE_VIEWS: Array<{ view: View; label: string; icon: typeof Home }> = [
  { view: 'home', label: 'Inicio', icon: Home },
  { view: 'inbox', label: 'Notas', icon: StickyNote },
  { view: 'agenda', label: 'Agenda', icon: CalendarDays },
  { view: 'actions', label: 'Acciones', icon: ListTodo },
  { view: 'projects', label: 'Proyectos y rutinas', icon: FolderKanban },
  { view: 'journal', label: 'Journal', icon: BookOpen },
]
