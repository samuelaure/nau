import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BlockEditor } from './BlockEditor'
import { useCreateNote } from '@/references/use-notes'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { notify } from '@/core/notifications/notifications-store'
import { makeBlock } from '@/test/block-fixture'

jest.mock('@/references/use-notes')
jest.mock('@/core/identity/workspace-store')
jest.mock('@/core/notifications/notifications-store', () => ({
  notify: jest.fn(),
}))

const useCreateNoteMock = useCreateNote as jest.Mock
const useActiveWorkspaceIdMock = useActiveWorkspaceId as jest.Mock
const notifyMock = notify as jest.Mock

const queryClient = new QueryClient()
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

/**
 * BlockEditor is the merge of NoteInput's Keep-style collapsed card,
 * BlockEditorModal's open editor, and EditNoteModal's save-on-click-outside
 * — none of the three predecessors had a spec of their own. This one exists
 * because a real bug (overlay+no-block never closing on save/empty-close)
 * was only found by manual code reading, not by any test — see nau#153.
 */
describe('BlockEditor', () => {
  let createNoteMutate: jest.Mock

  beforeEach(() => {
    createNoteMutate = jest.fn()
    useCreateNoteMock.mockReturnValue({ mutate: createNoteMutate, isError: false, isPending: false })
    useActiveWorkspaceIdMock.mockReturnValue('workspace-1')
    notifyMock.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('capturing a new note (no block)', () => {
    it('inline mode starts collapsed with the "Take a note..." card', () => {
      render(<BlockEditor />, { wrapper })
      expect(screen.getByText('Take a note...')).toBeInTheDocument()
    })

    it('inline mode expands on click and shows the body field', () => {
      render(<BlockEditor />, { wrapper })
      fireEvent.click(screen.getByText('Take a note...'))
      expect(screen.getByPlaceholderText('Escribe algo…')).toBeInTheDocument()
    })

    it('overlay mode starts expanded directly, no collapsed card', () => {
      render(<BlockEditor mode="overlay" onClose={jest.fn()} />, { wrapper })
      expect(screen.queryByText('Take a note...')).not.toBeInTheDocument()
      expect(screen.getByPlaceholderText('Escribe algo…')).toBeInTheDocument()
    })

    it('closing an empty inline capture just re-collapses, without creating a note', () => {
      render(
        <div>
          <BlockEditor />
          <button>outside</button>
        </div>,
        { wrapper },
      )
      fireEvent.click(screen.getByText('Take a note...'))
      fireEvent.mouseDown(screen.getByText('outside'))
      expect(screen.getByText('Take a note...')).toBeInTheDocument()
      expect(createNoteMutate).not.toHaveBeenCalled()
    })

    // The bug fixed in nau#153: closing an empty overlay capture (no block)
    // used to call setExpanded(false) unconditionally, which for overlay mode
    // has no effect the host can see — the fixed-position backdrop stayed
    // mounted with the (now invisible, since isExpanded still gates the
    // whole render) editor gone dark. onClose must fire instead.
    it('closing an empty overlay capture calls onClose, not setExpanded', () => {
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" onClose={onClose} />, { wrapper })
      fireEvent.keyDown(screen.getByPlaceholderText('Escribe algo…'), { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(createNoteMutate).not.toHaveBeenCalled()
    })

    it('closes immediately on a non-empty overlay capture — does not wait for the mutation', () => {
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" onClose={onClose} />, { wrapper })
      fireEvent.change(screen.getByPlaceholderText('Escribe algo…'), { target: { value: 'A new note' } })
      fireEvent.keyDown(screen.getByPlaceholderText('Escribe algo…'), { key: 'Escape' })
      // Closed synchronously, before createNote's mutate callback (onError,
      // below) ever has a chance to run — this is the "optimistic close"
      // contract, not a race that happens to pass.
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(createNoteMutate).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'A new note', workspaceId: 'workspace-1' }),
        expect.anything(),
      )
    })

    it('trims the body and omits an empty title as null', () => {
      render(<BlockEditor mode="overlay" onClose={jest.fn()} />, { wrapper })
      fireEvent.change(screen.getByPlaceholderText('Título'), { target: { value: '  ' } })
      fireEvent.change(screen.getByPlaceholderText('Escribe algo…'), { target: { value: '  hello  ' } })
      fireEvent.keyDown(screen.getByPlaceholderText('Escribe algo…'), { key: 'Escape' })
      expect(createNoteMutate).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'hello', title: null }),
        expect.anything(),
      )
    })

    it('notifies with a Reintentar action when createNote fails, after already closing', () => {
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" onClose={onClose} />, { wrapper })
      fireEvent.change(screen.getByPlaceholderText('Escribe algo…'), { target: { value: 'will fail' } })
      fireEvent.keyDown(screen.getByPlaceholderText('Escribe algo…'), { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
      // Simulate the mutation's onError firing, the way react-query would.
      const [, callbacks] = createNoteMutate.mock.calls[0]
      callbacks.onError()

      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tone: 'error',
          action: expect.objectContaining({ label: 'Reintentar' }),
        }),
      )
    })
  })

  describe('editing an existing block', () => {
    const noteBlock = makeBlock({
      id: 'note-1',
      type: 'note',
      properties: { title: 'Original title', body: 'Original body' },
    })

    it('loads the block\'s title and body into the fields', () => {
      render(<BlockEditor mode="overlay" block={noteBlock} onClose={jest.fn()} onUpdate={jest.fn()} />, { wrapper })
      expect(screen.getByDisplayValue('Original title')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Original body')).toBeInTheDocument()
    })

    it('a block with no title field (e.g. an action) uses its one text field as the title row', () => {
      const actionBlock = makeBlock({ id: 'action-1', type: 'action', properties: { text: 'Do the thing' } })
      render(<BlockEditor mode="overlay" block={actionBlock} onClose={jest.fn()} onUpdate={jest.fn()} />, { wrapper })
      expect(screen.getByDisplayValue('Do the thing')).toBeInTheDocument()
    })

    it('calls onUpdate with the new properties when something changed, then closes', () => {
      const onUpdate = jest.fn()
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" block={noteBlock} onClose={onClose} onUpdate={onUpdate} />, { wrapper })
      fireEvent.change(screen.getByDisplayValue('Original body'), { target: { value: 'Edited body' } })
      fireEvent.keyDown(screen.getByDisplayValue('Edited body'), { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onUpdate).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({ properties: expect.objectContaining({ text: 'Edited body', body: 'Edited body' }) }),
      )
    })

    it('does not call onUpdate when nothing changed, but still closes', () => {
      const onUpdate = jest.fn()
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" block={noteBlock} onClose={onClose} onUpdate={onUpdate} />, { wrapper })
      fireEvent.keyDown(screen.getByDisplayValue('Original body'), { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('closes on an outside click in overlay mode via the backdrop', () => {
      const onClose = jest.fn()
      const { container } = render(<BlockEditor mode="overlay" block={noteBlock} onClose={onClose} onUpdate={jest.fn()} />, { wrapper })
      const backdrop = container.firstChild as HTMLElement
      fireEvent.mouseDown(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('clicking inside the editor does not close it', () => {
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" block={noteBlock} onClose={onClose} onUpdate={jest.fn()} />, { wrapper })
      fireEvent.mouseDown(screen.getByDisplayValue('Original body'))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('deleting calls onDelete and closes, without going through commit/onUpdate', () => {
      const onDelete = jest.fn()
      const onUpdate = jest.fn()
      const onClose = jest.fn()
      render(<BlockEditor mode="overlay" block={noteBlock} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />, {
        wrapper,
      })
      fireEvent.click(screen.getByLabelText('Más opciones'))
      fireEvent.click(screen.getByText('Eliminar'))
      expect(onDelete).toHaveBeenCalledWith('note-1')
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onUpdate).not.toHaveBeenCalled()
    })
  })
})
