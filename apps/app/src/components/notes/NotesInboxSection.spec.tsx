import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NotesInboxSection } from './NotesInboxSection'
import { makeBlock } from '@/test/block-fixture'
import React from 'react'

jest.mock('./NoteGrid', () => ({
  NoteGrid: jest.fn(() => <div>Mocked NoteGrid</div>),
}))

const mockNotes = [makeBlock({ id: '1', type: 'note', properties: { text: 'Note 1' } })]

describe('NotesInboxSection', () => {
  it('should render the title and toggle content on click', () => {
    render(<NotesInboxSection title="Notes Inbox" notes={mockNotes} />)
    const headerButton = screen.getByRole('button', { name: /Notes Inbox/ })
    expect(headerButton).toBeInTheDocument()
    expect(screen.getByText('Mocked NoteGrid')).toBeInTheDocument()
    fireEvent.click(headerButton)
    expect(screen.queryByText('Mocked NoteGrid')).not.toBeInTheDocument()
  })

  it('should show "No inbox notes" message when notes array is empty', () => {
    render(<NotesInboxSection title="Notes Inbox" notes={[]} />)
    expect(screen.getByText('No inbox notes for this day.')).toBeInTheDocument()
    expect(screen.queryByText('Mocked NoteGrid')).not.toBeInTheDocument()
  })

  it('does not render a divider by default', () => {
    const { container } = render(<NotesInboxSection title="Notes Inbox" notes={mockNotes} />)
    expect(container.querySelector('.bg-gray-200')).not.toBeInTheDocument()
  })

  it('renders a divider next to the title when withDivider is true', () => {
    const { container } = render(<NotesInboxSection title="Notes Inbox" notes={mockNotes} withDivider />)
    expect(container.querySelector('.bg-gray-200')).toBeInTheDocument()
  })
})
