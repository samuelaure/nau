import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BlockBottomBar } from './BlockBottomBar'

describe('BlockBottomBar', () => {
  it('shows Cerrar by default and calls onClose when clicked', () => {
    const onClose = jest.fn()
    render(<BlockBottomBar onDelete={jest.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cerrar'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('hides Cerrar when showClose is false — NoteCard\'s on-hover row has nothing to close', () => {
    render(<BlockBottomBar onDelete={jest.fn()} showClose={false} />)
    expect(screen.queryByText('Cerrar')).not.toBeInTheDocument()
  })

  it('always renders BlockToolbar\'s controls alongside it', () => {
    render(<BlockBottomBar onDelete={jest.fn()} />)
    expect(screen.getByLabelText('Más opciones')).toBeInTheDocument()
  })
})
