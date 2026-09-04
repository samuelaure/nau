import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NoteCard } from './NoteCard'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useDeleteNote } from '@/references/use-notes'
import { makeBlock } from '@/test/block-fixture'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

jest.mock('@/lib/state/dashboard-store')
jest.mock('@/references/use-notes')
jest.mock('@/lib/state/ui-store', () => ({
  useUiStore: () => null,
}))

const useDashboardStoreMock = useDashboardStore as unknown as jest.Mock
const mockDeleteNote = jest.fn()
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

describe('NoteCard', () => {
  const setDraggedItem = jest.fn()
  const setEditingNoteId = jest.fn()

  beforeEach(() => {
    useDashboardStoreMock.mockImplementation((selector) =>
      selector({
        draggedItem: null,
        actions: {
          setDraggedItem,
          setEditingNoteId,
        },
      })
    )
    // Every mutation hook the component reads must return the shape
    // `useMutation` actually produces — `isPending` included — or a click
    // that reads `.isPending` crashes before the assertion under test runs.
    ;(useDeleteNote as jest.Mock).mockReturnValue({ mutate: mockDeleteNote, isPending: false })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render the note text', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    expect(screen.getByText('This is a test note.')).toBeInTheDocument()
  })

  it('should call setEditingNoteId on click', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    fireEvent.click(screen.getByText('This is a test note.'))
    expect(setEditingNoteId).toHaveBeenCalledWith(mockNote.id)
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

  it('should call deleteNote on delete button click', () => {
    render(<NoteCard note={mockNote} />, { wrapper })
    const menuButton = screen.getByLabelText('Más opciones')
    fireEvent.click(menuButton)

    const deleteButton = screen.getByText('Eliminar')
    fireEvent.click(deleteButton)

    expect(mockDeleteNote).toHaveBeenCalledWith(mockNote.id)
  })
})
