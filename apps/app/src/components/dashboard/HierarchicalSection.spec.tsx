import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import '@testing-library/jest-dom'
import { HierarchicalSection } from './HierarchicalSection'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUpdateBlock } from '@/hooks/use-blocks-api'
import { useCreateActionItem, useUpdateActionItem, useDeleteActionItem } from '@/actions/use-action-items'
import { HierarchicalBlock } from '@9nau/core'
import { makeHierarchicalBlock } from '@/test/block-fixture'
import { notify } from '@/core/notifications/notifications-store'
import React from 'react'

jest.mock('@/lib/state/dashboard-store')
jest.mock('@/hooks/use-blocks-api')
jest.mock('@/actions/use-action-items')
jest.mock('@/journal/use-journal-api')
jest.mock('@/core/notifications/notifications-store', () => ({ notify: jest.fn() }))

const notifyMock = notify as jest.Mock

const queryClient = new QueryClient()
const mockCreateActionItem = jest.fn()
const mockUpdateActionItem = jest.fn()
const mockDeleteActionItem = jest.fn()
const mockUpdateBlock = jest.fn()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const useDashboardStoreMock = useDashboardStore as unknown as jest.Mock

describe('HierarchicalSection', () => {
  const setDraggedItem = jest.fn()
  const setDropTarget = jest.fn()
  const setFocusedItemId = jest.fn()
  const mockItems: HierarchicalBlock[] = [
    makeHierarchicalBlock({
      id: 'item-1',
      type: 'action',
      properties: { text: 'Root item', sortOrder: 1, date: '2025-08-05' },
      children: [
        makeHierarchicalBlock({
          id: 'item-2',
          type: 'action',
          parentId: 'item-1',
          properties: { text: 'Child item', sortOrder: 1, date: '2025-08-05' },
        }),
      ],
    }),
  ]

  beforeEach(() => {
    useDashboardStoreMock.mockImplementation((selector) =>
      selector({
        draggedItem: { id: 'dragged-1', type: 'action' },
        dropTarget: null,
        actions: {
          setDraggedItem,
          setDropTarget,
          setFocusedItemId,
        },
      })
    )
    ;(useCreateActionItem as jest.Mock).mockReturnValue({ mutate: mockCreateActionItem })
    ;(useUpdateActionItem as jest.Mock).mockReturnValue({ mutate: mockUpdateActionItem })
    ;(useDeleteActionItem as jest.Mock).mockReturnValue({ mutate: mockDeleteActionItem })
    ;(useUpdateBlock as jest.Mock).mockReturnValue({ mutate: mockUpdateBlock })
    // Journal hooks — not exercised by the action-type tests but must be
    // present so the component doesn't crash when calling them.
    const { useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry } =
      jest.requireMock('@/journal/use-journal-api')
    ;(useCreateJournalEntry as jest.Mock).mockReturnValue({ mutate: jest.fn() })
    ;(useUpdateJournalEntry as jest.Mock).mockReturnValue({ mutate: jest.fn() })
    ;(useDeleteJournalEntry as jest.Mock).mockReturnValue({ mutate: jest.fn() })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render the title and items', () => {
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
      wrapper,
    })
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('Root item')).toBeInTheDocument()
    expect(screen.getByText('Child item')).toBeInTheDocument()
  })

  it('should toggle visibility on header click', () => {
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
      wrapper,
    })
    const toggleButton = screen.getByRole('button', { name: 'Actions' })
    fireEvent.click(toggleButton)
    expect(screen.queryByText('Root item')).not.toBeInTheDocument()
  })

  it('should call createActionItem on empty section click', async () => {
    mockCreateActionItem.mockImplementationOnce((_dto: unknown, options: { onSuccess: (v: {id: string}) => void }) => {
      options.onSuccess({ id: 'new-item-id' })
    })
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={[]} />, { wrapper })

    act(() => {
      fireEvent.click(screen.getByText('Click to add an entry.'))
    })

    await waitFor(() => {
      expect(mockCreateActionItem).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
          parentId: undefined,
        }),
        expect.any(Object)
      )
    })
    expect(setFocusedItemId).toHaveBeenCalledWith('new-item-id')
  })

  it('should call updateActionItem on update', () => {
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
      wrapper,
    })
    fireEvent.click(screen.getByText('Root item'))
    fireEvent.change(screen.getByDisplayValue('Root item'), { target: { value: 'Updated text' } })
    fireEvent.blur(screen.getByDisplayValue('Updated text'))

    expect(mockUpdateActionItem).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        body: { text: 'Updated text' },
      })
    )
  })

  // These two are what EditableItem's BlockEditor overlay actually calls
  // through onDelete/onFullUpdate — its modal closes unconditionally
  // (nau#153), so a failure here can only be reported after the fact.
  describe('reporting failure after an optimistic close (nau#153)', () => {
    beforeEach(() => notifyMock.mockClear())

    it('handleDelete notifies with Reintentar when deleteActionItem fails', () => {
      render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
        wrapper,
      })
      fireEvent.click(screen.getAllByLabelText('Delete item')[0])
      expect(mockDeleteActionItem).toHaveBeenCalledWith('item-1', expect.anything())
      const [, callbacks] = mockDeleteActionItem.mock.calls[0]
      callbacks.onError()
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', action: expect.objectContaining({ label: 'Reintentar' }) }),
      )
    })

    it('handleFullUpdate (fed by EditableItem\'s BlockEditor overlay) notifies with Reintentar on failure', () => {
      render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
        wrapper,
      })
      // Opens EditableItem's real BlockEditor overlay (mode="overlay",
      // onFullUpdate wired to handleFullUpdate) and edits+closes it, the
      // same path a real "Expand item" click takes.
      fireEvent.mouseDown(screen.getAllByLabelText('Expand item')[0])
      const bodyField = screen.getByDisplayValue('Root item')
      fireEvent.change(bodyField, { target: { value: 'Edited via modal' } })
      fireEvent.keyDown(screen.getByDisplayValue('Edited via modal'), { key: 'Escape' })

      expect(mockUpdateBlock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'item-1' }),
        expect.anything(),
      )
      const [, callbacks] = mockUpdateBlock.mock.calls[0]
      callbacks.onError()
      expect(notifyMock).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error', action: expect.objectContaining({ label: 'Reintentar' }) }),
      )
    })
  })
})
