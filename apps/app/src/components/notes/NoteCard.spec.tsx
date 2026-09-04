import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NoteCard } from './NoteCard'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUpdateNote, useDeleteNote } from '@/references/use-notes'
import { notify } from '@/core/notifications/notifications-store'
import { makeBlock } from '@/test/block-fixture'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

jest.mock('@/lib/state/dashboard-store')
jest.mock('@/references/use-notes')
jest.mock('@/core/notifications/notifications-store', () => ({ notify: jest.fn() }))
jest.mock('@/lib/state/ui-store', () => ({
  useUiStore: () => null,
}))

const useDashboardStoreMock = useDashboardStore as unknown as jest.Mock
const notifyMock = notify as jest.Mock
const queryClient = new QueryClient()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const mockNote = makeBlock({
  id: 'note-1',
  uuid: 'uuid-1',
  type: 'note',
  properties: { text: 'This is a test note.' },
})

/**
 * NoteCard mounts BlockEditor locally (isEditorOpen), the same shape
 * EditableItem already used — replacing the old dashboard-store.editingNote
 * + separately-mounted EditNoteModal indirection nothing else ever read
 * (nau#153). BlockEditor's own contract is specced on its own
 * (BlockEditor.spec.tsx); these specs cover NoteCard's wiring of it.
 */
describe('NoteCard', () => {
  const setDraggedItem = jest.fn()
  let mockUpdateNote: jest.Mock
  let mockDeleteNote: jest.Mock

  beforeEach(() => {
    useDashboardStoreMock.mockImplementation((selector) =>
      selector({
        draggedItem: null,
        actions: { setDraggedItem },
      })
    )
    mockUpdateNote = jest.fn()
    mockDeleteNote = jest.fn()
    // Every mutation hook the component reads must return the shape
    // `useMutation` actually produces — `isPending` included — or a click
    // that reads `.isPending` crashes before the assertion under test runs.
    ;(useUpdateNote as jest.Mock).mockReturnValue({ mutate: mockUpdateNote, isPending: false })
    ;(useDeleteNote as jest.Mock).mockReturnValue({ mutate: mockDeleteNote, isPending: false })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render the note text', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    expect(screen.getByText('This is a test note.')).toBeInTheDocument()
  })

  it('opens the editor on click', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.click(screen.getByText('This is a test note.'))
    // BlockEditor's overlay renders the body in a textarea with the note's content.
    expect(screen.getByDisplayValue('This is a test note.')).toBeInTheDocument()
  })

  it('closes the editor and saves via useUpdateNote on outside click', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.click(screen.getByText('This is a test note.'))
    const body = screen.getByDisplayValue('This is a test note.')
    fireEvent.change(body, { target: { value: 'Edited text' } })
    fireEvent.keyDown(screen.getByDisplayValue('Edited text'), { key: 'Escape' })

    expect(screen.queryByDisplayValue('Edited text')).not.toBeInTheDocument()
    expect(mockUpdateNote).toHaveBeenCalledWith(
      { id: 'note-1', body: { title: null, content: 'Edited text' } },
      expect.anything(),
    )
  })

  it('notifies with Reintentar when the update fails', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.click(screen.getByText('This is a test note.'))
    fireEvent.change(screen.getByDisplayValue('This is a test note.'), { target: { value: 'Edited' } })
    fireEvent.keyDown(screen.getByDisplayValue('Edited'), { key: 'Escape' })

    const [, callbacks] = mockUpdateNote.mock.calls[0]
    callbacks.onError()
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', action: expect.objectContaining({ label: 'Reintentar' }) }),
    )
  })

  it('should call setDraggedItem on drag start', () => {
    const mockDataTransfer = {
      setData: jest.fn(),
      effectAllowed: '',
    }
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.dragStart(screen.getByText('This is a test note.').parentElement!.parentElement!, {
      dataTransfer: mockDataTransfer,
    })
    expect(setDraggedItem).toHaveBeenCalledWith(mockNote)
    expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/plain', mockNote.id)
  })

  it('should call setDraggedItem with null on drag end', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.dragEnd(screen.getByText('This is a test note.').parentElement!.parentElement!)
    expect(setDraggedItem).toHaveBeenCalledWith(null)
  })

  it('should call deleteNote on delete button click, from the on-hover bottom bar', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    const menuButton = screen.getByLabelText('Más opciones')
    fireEvent.click(menuButton)

    const deleteButton = screen.getByText('Eliminar')
    fireEvent.click(deleteButton)

    expect(mockDeleteNote).toHaveBeenCalledWith(mockNote.id)
  })

  it('deleting from inside the open editor also notifies on failure', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.click(screen.getByText('This is a test note.'))
    // The editor's own MoreVertical menu, inside the opened BlockEditor —
    // distinct DOM node from the on-hover bottom bar's, so this is the
    // second "Más opciones"/"Eliminar" pair on screen at this point.
    const menuButtons = screen.getAllByLabelText('Más opciones')
    fireEvent.click(menuButtons[menuButtons.length - 1])
    const deleteButtons = screen.getAllByText('Eliminar')
    fireEvent.click(deleteButtons[deleteButtons.length - 1])

    expect(mockDeleteNote).toHaveBeenCalledWith('note-1', expect.anything())
    const [, callbacks] = mockDeleteNote.mock.calls[0]
    callbacks.onError()
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', action: expect.objectContaining({ label: 'Reintentar' }) }),
    )
  })
})
