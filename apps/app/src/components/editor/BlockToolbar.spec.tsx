import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BlockToolbar } from './BlockToolbar'

/**
 * Shared between NoteCard's on-hover row and BlockEditor's open editor — see
 * BlockToolbar.tsx's docstring. No spec existed before this: the flex-1
 * right-alignment bug (nau session 2026-09-03/04) shipped and needed two
 * rounds of manual user testing to catch. These specs cover the parts a DOM
 * assertion actually can: menu open/close and the Eliminar action, not the
 * visual alignment itself (that needs a real layout engine, not jsdom).
 */
describe('BlockToolbar', () => {
  it('renders the disabled placeholder buttons', () => {
    render(<BlockToolbar onDelete={jest.fn()} />)
    expect(screen.getByTitle('Recordatorio — próximamente')).toBeDisabled()
    expect(screen.getByTitle('Frecuencia — próximamente')).toBeDisabled()
    expect(screen.getByTitle('Mover a… — próximamente')).toBeDisabled()
    expect(screen.getByTitle('Etiquetas — próximamente')).toBeDisabled()
  })

  it('the Eliminar menu is closed by default', () => {
    render(<BlockToolbar onDelete={jest.fn()} />)
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })

  it('opens the menu on click and shows Eliminar', () => {
    render(<BlockToolbar onDelete={jest.fn()} />)
    fireEvent.click(screen.getByLabelText('Más opciones'))
    expect(screen.getByText('Eliminar')).toBeInTheDocument()
  })

  it('calls onDelete and closes the menu when Eliminar is clicked', () => {
    const onDelete = jest.fn()
    render(<BlockToolbar onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Más opciones'))
    fireEvent.click(screen.getByText('Eliminar'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })

  it('disables Eliminar when canDelete is false', () => {
    render(<BlockToolbar onDelete={jest.fn()} canDelete={false} />)
    fireEvent.click(screen.getByLabelText('Más opciones'))
    expect(screen.getByText('Eliminar')).toBeDisabled()
  })

  it('closes the menu on an outside click', () => {
    render(
      <div>
        <BlockToolbar onDelete={jest.fn()} />
        <button>outside</button>
      </div>,
    )
    fireEvent.click(screen.getByLabelText('Más opciones'))
    expect(screen.getByText('Eliminar')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })

  it('marks Frecuencia active when isHabit is true', () => {
    render(<BlockToolbar onDelete={jest.fn()} isHabit />)
    expect(screen.getByTitle('Frecuencia — próximamente')).toHaveClass('text-emerald-600')
  })
})
