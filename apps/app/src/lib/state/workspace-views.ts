import { Home, ListChecks, BookOpen, Search, FolderOpen } from 'lucide-react'
import type { View } from './ui-store'

/** The user-facing workspace surfaces; shell only renders this configuration. */
export const WORKSPACE_VIEWS: Array<{ view: View; label: string; icon: typeof Home }> = [
  { view: 'home', label: 'Inicio', icon: Home },
  { view: 'agenda', label: 'Acciones', icon: ListChecks },
  { view: 'journal', label: 'Journal', icon: BookOpen },
  { view: 'search', label: 'Buscar', icon: Search },
  { view: 'projects', label: 'Proyectos', icon: FolderOpen },
]
