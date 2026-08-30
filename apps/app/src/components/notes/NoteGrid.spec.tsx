import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NoteGrid } from './NoteGrid'
import { makeBlock } from '@/test/block-fixture'
import React from 'react'

jest.mock('./NoteCard', () => ({
  NoteCard: jest.fn(({ note }) => <div data-testid={`note-card-${note.id}`}>{note.properties.text as string}</div>),
}))

const mockNotes = [
  makeBlock({ id: '1', type: 'note', properties: { text: 'First note' } }),
  makeBlock({ id: '2', type: 'note', properties: { text: 'Second note' } }),
]

describe('NoteGrid', () => {
  it('should render a NoteCard for each note', () => {
    render(<NoteGrid notes={mockNotes} />)
    expect(screen.getByTestId('note-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('note-card-2')).toBeInTheDocument()
    expect(screen.getByText('First note')).toBeInTheDocument()
    expect(screen.getByText('Second note')).toBeInTheDocument()
  })

  it('should handle an empty notes array', () => {
    render(<NoteGrid notes={[]} />)
    expect(screen.queryByTestId(/note-card/)).not.toBeInTheDocument()
  })
})
