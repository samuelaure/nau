import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NoteInput } from './note-input'
import { useCreateBlock } from '@/hooks/use-blocks-api'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { act } from 'react'

jest.mock('@/hooks/use-blocks-api')

const queryClient = new QueryClient()
const mockCreateBlock = jest.fn()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('NoteInput', () => {
  beforeEach(() => {
    ;(useCreateBlock as jest.Mock).mockReturnValue({
      mutate: mockCreateBlock,
    })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  it('should render in collapsed state initially', () => {
    render(<NoteInput />, { wrapper })
    const placeholder = screen.getByText('Take a note...')
    expect(placeholder).toBeInTheDocument()
  })

  it('should expand when clicked and focus textarea', () => {
    render(<NoteInput />, { wrapper })
    fireEvent.click(screen.getByText('Take a note...'))
    const textarea = screen.getByPlaceholderText('Take a note...') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveFocus()
  })

  it('should call createBlock and collapse on blur with text', async () => {
    // The component only clears and collapses in `onSuccess` (see
    // note-input.tsx's `handleClose`) — a mock that never calls it leaves the
    // textarea mounted regardless of whether `mutate` was called correctly.
    mockCreateBlock.mockImplementationOnce((_dto, options) => {
      options?.onSuccess?.()
    })
    render(<NoteInput />, { wrapper })
    fireEvent.click(screen.getByText('Take a note...'))
    const textarea = screen.getByPlaceholderText('Take a note...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'This is a new note' } })

    act(() => {
      fireEvent.mouseDown(document.body)
      jest.runAllTimers()
    })

    await waitFor(() => expect(mockCreateBlock).toHaveBeenCalledTimes(1))
    // `mutate` is called with a second argument (`{ onSuccess }`), so the
    // assertion has to match both positional arguments, not just the first.
    // `workspaceId` is always sent, `undefined` when no workspace is active
    // (`activeWorkspaceId ?? undefined` in note-input.tsx) — not omitted.
    expect(mockCreateBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'note',
        workspaceId: undefined,
        properties: { text: 'This is a new note', status: 'inbox', date: expect.any(String) },
      }),
      expect.any(Object)
    )
    expect(textarea).not.toBeInTheDocument()
  })

  it('should not call createBlock on blur if text is empty', () => {
    render(<NoteInput />, { wrapper })
    fireEvent.click(screen.getByText('Take a note...'))
    // const textarea = screen.getByPlaceholderText('Take a note...') as HTMLTextAreaElement;

    act(() => {
      fireEvent.mouseDown(document.body)
      jest.runAllTimers()
    })

    expect(mockCreateBlock).not.toHaveBeenCalled()
  })
})
