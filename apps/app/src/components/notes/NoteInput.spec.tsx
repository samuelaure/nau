import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NoteInput } from './note-input'
import { useCreateNote } from '@/references/use-notes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { act } from 'react'

jest.mock('@/references/use-notes')

const queryClient = new QueryClient()
const mockCreateNote = jest.fn()

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

describe('NoteInput', () => {
  beforeEach(() => {
    ;(useCreateNote as jest.Mock).mockReturnValue({
      mutate: mockCreateNote,
      isPending: false,
      isError: false,
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

  it('should call createNote and collapse on blur with text', async () => {
    // The component only clears and collapses in `onSuccess` — a mock that
    // never calls it leaves the textarea mounted regardless of whether
    // `mutate` was called correctly.
    mockCreateNote.mockImplementationOnce((_dto: unknown, options: { onSuccess?: () => void }) => {
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

    await waitFor(() => expect(mockCreateNote).toHaveBeenCalledTimes(1))
    // `workspaceId` is always sent, `undefined` when no workspace is active.
    // `content` is the field name on the new NoteProperties shape.
    expect(mockCreateNote).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'This is a new note',
        title: null,
        workspaceId: undefined,
      }),
      expect.any(Object)
    )
    expect(textarea).not.toBeInTheDocument()
  })

  it('should not call createNote on blur if text is empty', () => {
    render(<NoteInput />, { wrapper })
    fireEvent.click(screen.getByText('Take a note...'))

    act(() => {
      fireEvent.mouseDown(document.body)
      jest.runAllTimers()
    })

    expect(mockCreateNote).not.toHaveBeenCalled()
  })
})
