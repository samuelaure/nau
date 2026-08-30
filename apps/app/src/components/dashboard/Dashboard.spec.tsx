import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Dashboard } from './Dashboard'
import { useDashboardStore } from '@/lib/state/dashboard-store'
import { useUiStore } from '@/lib/state/ui-store'
import { useUpdateBlock, useCreateBlock, useDeleteBlock } from '@/hooks/use-blocks-api'
import { useAgendaRange, useSetCompletion } from '@/hooks/use-agenda-api'
import { useUpsertPlanning } from '@/hooks/use-schedule-api'
import { usePeriodAt, usePeriodsIn } from '@/core/periods/use-periods'
import { apiClient } from '@/lib/api-client'
import type { HierarchicalBlock } from '@9nau/core'
import type { Block } from '@9nau/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

/**
 * Rewritten against the component as it is today, not the pre-migration one.
 *
 * `Dashboard.tsx` now resolves periods against the server (`usePeriodAt`,
 * `usePeriodsIn` from `core/periods`) instead of computing them client-side,
 * and its children (`ActionsSection`, `HierarchicalSection`, `NextActions`)
 * each have their own network dependencies. Every hook the tree can reach is
 * mocked here rather than letting requests actually fire — the alternative,
 * a real QueryClient hitting a real `apiClient`, would make this an
 * integration test of the whole dashboard rather than a unit test of the
 * component whose behaviour is under test.
 */

jest.mock('@/lib/state/dashboard-store')
jest.mock('@/lib/state/ui-store')
jest.mock('@/hooks/use-blocks-api')
jest.mock('@/hooks/use-agenda-api')
jest.mock('@/hooks/use-schedule-api')
jest.mock('@/core/periods/use-periods')
jest.mock('@/lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }))

const useDashboardStoreMock = useDashboardStore as unknown as jest.Mock
const useUiStoreMock = useUiStore as unknown as jest.Mock
const queryClient = new QueryClient()
const mockUpdateBlock = jest.fn()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const resolvedPeriod = (overrides: Partial<{ scale: string; anchor: string; from: string; to: string; name: string }> = {}) => ({
  system: 'gregorian',
  scale: 'day',
  anchor: '2025-08-05T00:00:00.000Z',
  name: '5 de agosto',
  from: '2025-08-05T00:00:00.000Z',
  to: '2025-08-05T23:59:59.999Z',
  title: null,
  ...overrides,
})

describe('Dashboard', () => {
  const setCurrentDate = jest.fn()
  const setGranularity = jest.fn()
  const loadMorePast = jest.fn()
  const loadMoreFuture = jest.fn()
  const hideFuture = jest.fn()
  const setMainContentRef = jest.fn()
  const setTodayRef = jest.fn()
  const setDraggedItem = jest.fn()
  const setDropTarget = jest.fn()

  const mockNotesByDate = new Map<string, Block[]>()
  const mockActions: HierarchicalBlock[] = []
  const mockExperiences: HierarchicalBlock[] = []

  const baseState = {
    viewMode: 'list' as const,
    currentDate: new Date('2025-08-05T12:00:00'),
    granularity: 'day' as const,
    visiblePast: 7,
    visibleFuture: 0,
    mainContentRef: { current: null },
    draggedItem: null,
    dropTarget: null,
    actions: {
      setCurrentDate,
      setGranularity,
      loadMorePast,
      loadMoreFuture,
      hideFuture,
      setMainContentRef,
      setTodayRef,
      setDraggedItem,
      setDropTarget,
    },
  }

  beforeEach(() => {
    useDashboardStoreMock.mockImplementation((selector) => selector(baseState))
    useUiStoreMock.mockImplementation((selector) => selector({ activeWorkspaceId: 'ws-1' }))
    ;(useUpdateBlock as jest.Mock).mockReturnValue({ mutate: mockUpdateBlock })
    ;(useCreateBlock as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false })
    ;(useDeleteBlock as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false })
    ;(useAgendaRange as jest.Mock).mockReturnValue({ data: { items: [], timezone: 'UTC' }, isLoading: false })
    ;(useSetCompletion as jest.Mock).mockReturnValue({ mutate: jest.fn() })
    ;(useUpsertPlanning as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false })
    ;(usePeriodsIn as jest.Mock).mockReturnValue({ data: { periods: [resolvedPeriod()], timezone: 'UTC' } })
    ;(usePeriodAt as jest.Mock).mockReturnValue({ data: { period: resolvedPeriod(), timezone: 'UTC' } })
    ;(apiClient.get as jest.Mock).mockResolvedValue({ items: [] })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render in list view by default, with the future/past controls', () => {
    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })
    // Real copy today is Spanish — see Dashboard.tsx's "Futuro"/"Pasado"
    // buttons, not the English placeholders this spec used to assert.
    expect(screen.getByText('Futuro')).toBeInTheDocument()
    expect(screen.getByText('Pasado')).toBeInTheDocument()
  })

  it('should call loadMoreFuture when the Futuro button is clicked', () => {
    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })
    fireEvent.click(screen.getByText('Futuro'))
    expect(loadMoreFuture).toHaveBeenCalled()
  })

  it('should call loadMorePast when the Pasado button is clicked', () => {
    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })
    fireEvent.click(screen.getByText('Pasado'))
    expect(loadMorePast).toHaveBeenCalled()
  })

  it('should render in horizontal view when viewMode is "horizontal"', async () => {
    useDashboardStoreMock.mockImplementation((selector) => selector({ ...baseState, viewMode: 'horizontal' }))
    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })
    // The label comes from the server-resolved period's own name now
    // (`slot.label`, via `usePeriodAt`), not a client-formatted date string.
    await waitFor(() => expect(screen.getByText('5 de agosto')).toBeInTheDocument())
    expect(screen.getByLabelText('Previous')).toBeInTheDocument()
    expect(screen.getByLabelText('Next')).toBeInTheDocument()
  })

  it('should call setCurrentDate when navigating in horizontal view', async () => {
    useDashboardStoreMock.mockImplementation((selector) => selector({ ...baseState, viewMode: 'horizontal' }))
    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })
    await waitFor(() => expect(screen.getByLabelText('Next')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('Next'))
    expect(setCurrentDate).toHaveBeenCalled()
  })

  it('should call loadMorePast on scroll near the bottom in list view', () => {
    const mockAddEventListener = jest.fn()
    const mockMainContentRef = {
      current: {
        scrollTop: 801,
        scrollHeight: 1000,
        clientHeight: 200,
        addEventListener: mockAddEventListener,
        removeEventListener: jest.fn(),
      } as unknown as HTMLDivElement,
    }

    useDashboardStoreMock.mockImplementation((selector) =>
      selector({ ...baseState, mainContentRef: mockMainContentRef })
    )

    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })

    const handleScroll = mockAddEventListener.mock.calls.find(
      (call: [string, EventListener]) => call[0] === 'scroll'
    )?.[1]

    expect(handleScroll).toBeDefined()
    handleScroll?.({} as Event)

    expect(loadMorePast).toHaveBeenCalled()
  })

  it('should update the block on drop when a note is dragged onto an action section', () => {
    const draggedNote: Block = {
      id: 'note-1',
      uuid: 'note-1',
      type: 'note',
      properties: { text: 'A note' },
      parentId: null,
      source: null,
      sourceRef: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    }

    useDashboardStoreMock.mockImplementation((selector) =>
      selector({
        ...baseState,
        draggedItem: draggedNote,
        dropTarget: { id: null, position: 'end', date: '2025-08-05', section: 'action' },
      })
    )

    render(<Dashboard notesByDate={mockNotesByDate} actions={mockActions} experiences={mockExperiences} />, {
      wrapper,
    })
    fireEvent.drop(screen.getByTestId('dashboard-main-content'))

    expect(mockUpdateBlock).toHaveBeenCalledWith({
      id: 'note-1',
      updateDto: {
        type: 'action',
        properties: { text: 'A note', status: 'inbox', date: '2025-08-05' },
      },
    })
    expect(setDraggedItem).toHaveBeenCalledWith(null)
    expect(setDropTarget).toHaveBeenCalledWith(null)
  })
})
