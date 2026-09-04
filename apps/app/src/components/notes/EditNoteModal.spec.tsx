import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import { EditNoteModal } from './EditNoteModal'
import { useUpdateNote, useDeleteNote } from '@/references/use-notes'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useActiveWorkspaceId } from '@/core/identity/workspace-store'
import { notify } from '@/core/notifications/notifications-store'
import { makeBlock } from '@/test/block-fixture'

jest.mock('@/references/use-notes')
jest.mock('@/lib/state/dashboard-store')
jest.mock('@/core/identity/workspace-store')
jest.mock('@/core/notifications/notifications-store', () => ({ notify: jest.fn() }))

// BlockEditor itself is specced on its own (BlockEditor.spec.tsx) — this
// mock isolates EditNoteModal's actual job, the wiring, by exposing its
// props as plain buttons the spec can drive directly.
jest.mock('@/components/editor/BlockEditor', () => ({
  BlockEditor: ({ onUpdate, onDelete, onClose, block }: any) => (
    <div>
      <button onClick={() => onUpdate(block.id, { properties: { title: 'New title', text: 'New body' } })}>fire-update</button>
      <button onClick={() => onDelete(block.id)}>fire-delete</button>
      <button onClick={onClose}>fire-close</button>
    </div>
  ),
}))

const useUpdateNoteMock = useUpdateNote as jest.Mock
const useDeleteNoteMock = useDeleteNote as jest.Mock
const useDashboardStoreMock = useDashboardStore as unknown as jest.Mock
const useActiveWorkspaceIdMock = useActiveWorkspaceId as jest.Mock
const notifyMock = notify as jest.Mock

describe('EditNoteModal', () => {
  const setEditingNoteId = jest.fn()
  let updateMutate: jest.Mock
  let deleteMutate: jest.Mock
  const editingNote = makeBlock({ id: 'note-1', type: 'note', properties: { title: 'Old', text: 'Old body' } })

  beforeEach(() => {
    updateMutate = jest.fn()
    deleteMutate = jest.fn()
    useUpdateNoteMock.mockReturnValue({ mutate: updateMutate })
    useDeleteNoteMock.mockReturnValue({ mutate: deleteMutate })
    useActiveWorkspaceIdMock.mockReturnValue('ws-1')
    useDashboardStoreMock.mockImplementation((selector) => selector({ editingNote, actions: { setEditingNoteId } }))
    notifyMock.mockClear()
  })

  afterEach(() => jest.clearAllMocks())

  it('renders nothing when there is no editing note', () => {
    useDashboardStoreMock.mockImplementation((selector) => selector({ editingNote: null, actions: { setEditingNoteId } }))
    const { container } = render(<EditNoteModal />)
    expect(container).toBeEmptyDOMElement()
  })

  it('maps BlockEditor\'s onUpdate dto onto UpdateNoteInput and mutates', () => {
    render(<EditNoteModal />)
    fireEvent.click(screen.getByText('fire-update'))
    expect(updateMutate).toHaveBeenCalledWith(
      { id: 'note-1', body: { title: 'New title', content: 'New body' } },
      expect.anything(),
    )
  })

  it('notifies with Reintentar when the update mutation fails', () => {
    render(<EditNoteModal />)
    fireEvent.click(screen.getByText('fire-update'))
    const [, callbacks] = updateMutate.mock.calls[0]
    callbacks.onError()
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', action: expect.objectContaining({ label: 'Reintentar' }) }),
    )
  })

  it('closes the modal immediately on delete, before the mutation settles', () => {
    render(<EditNoteModal />)
    fireEvent.click(screen.getByText('fire-delete'))
    expect(setEditingNoteId).toHaveBeenCalledWith(null)
    expect(deleteMutate).toHaveBeenCalledWith('note-1', expect.anything())
  })

  it('notifies with Reintentar when the delete mutation fails', () => {
    render(<EditNoteModal />)
    fireEvent.click(screen.getByText('fire-delete'))
    const [, callbacks] = deleteMutate.mock.calls[0]
    callbacks.onError()
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ tone: 'error', action: expect.objectContaining({ label: 'Reintentar' }) }),
    )
  })

  it('closing clears the editing note', () => {
    render(<EditNoteModal />)
    fireEvent.click(screen.getByText('fire-close'))
    expect(setEditingNoteId).toHaveBeenCalledWith(null)
  })
})
