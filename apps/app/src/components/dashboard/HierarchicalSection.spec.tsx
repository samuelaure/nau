import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act } from 'react'
import '@testing-library/jest-dom'
import { HierarchicalSection } from './HierarchicalSection'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useCreateBlock, useUpdateBlock, useDeleteBlock } from '@/hooks/use-blocks-api'
import { HierarchicalBlock } from '@9nau/core'
import { makeHierarchicalBlock } from '@/test/block-fixture'
import React from 'react'

jest.mock('@/lib/state/dashboard-store')
jest.mock('@/hooks/use-blocks-api')

const queryClient = new QueryClient()
const mockCreateBlock = jest.fn()
const mockUpdateBlock = jest.fn()
const mockDeleteBlock = jest.fn()

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
    ;(useCreateBlock as jest.Mock).mockReturnValue({ mutate: mockCreateBlock })
    ;(useUpdateBlock as jest.Mock).mockReturnValue({ mutate: mockUpdateBlock })
    ;(useDeleteBlock as jest.Mock).mockReturnValue({ mutate: mockDeleteBlock })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render the title and items', () => {
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
      wrapper,
    })
    expect(screen.getByText('Actions')).toBeInTheDocument()
    // Items are rendered as EditableItem which might be in view or edit mode
    // Let's check for the text content instead of display value
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

  it('should call createBlock on empty section click', async () => {
    mockCreateBlock.mockImplementationOnce((dto, options) => {
      options.onSuccess({ id: 'new-block-id' })
    })
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={[]} />, { wrapper })

    act(() => {
      fireEvent.click(screen.getByText('Click to add an entry.'))
    })

    await waitFor(() => {
      expect(mockCreateBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'action',
          parentId: null,
          // 'published' is the real default (HierarchicalSection.tsx) — items
          // created here are immediately visible, not held in an inbox.
          properties: { text: '', date: '2025-08-05', status: 'published' },
        }),
        expect.any(Object)
      )
    })
    expect(setFocusedItemId).toHaveBeenCalledWith('new-block-id')
  })

  it('should call useUpdateBlock on update', () => {
    render(<HierarchicalSection dateStr="2025-08-05" sectionType="action" title="Actions" items={mockItems} />, {
      wrapper,
    })
    fireEvent.click(screen.getByText('Root item'))
    fireEvent.change(screen.getByDisplayValue('Root item'), { target: { value: 'Updated text' } })
    fireEvent.blur(screen.getByDisplayValue('Updated text'))
    // entryEditPatch stamps editedAt alongside text — see the comment on
    // handleUpdate in HierarchicalSection.tsx for why: without it, a
    // correction to a voice-captured entry is silently outranked by the
    // original transcription. editedAt is a real timestamp, not a fixed
    // value to compare exactly.
    expect(mockUpdateBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'item-1',
        updateDto: { properties: { text: 'Updated text', editedAt: expect.any(String) } },
      })
    )
  })
})
