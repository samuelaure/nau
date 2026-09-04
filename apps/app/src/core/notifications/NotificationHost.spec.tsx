import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { NotificationHost } from './NotificationHost'
import { useNotificationsStore, notify } from './notifications-store'

describe('NotificationHost', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ queue: [] })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders nothing when the queue is empty', () => {
    render(<NotificationHost />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders a queued notification\'s message', () => {
    render(<NotificationHost />)
    act(() => {
      notify({ tone: 'error', message: 'It broke' })
    })
    expect(screen.getByText('It broke')).toBeInTheDocument()
  })

  it('renders the action button and calls it, then dismisses', () => {
    const onClick = jest.fn()
    render(<NotificationHost />)
    act(() => {
      notify({ tone: 'error', message: 'It broke', action: { label: 'Reintentar', onClick } })
    })
    fireEvent.click(screen.getByText('Reintentar'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('It broke')).not.toBeInTheDocument()
  })

  it('dismisses on the close button', () => {
    render(<NotificationHost />)
    act(() => {
      notify({ tone: 'info', message: 'FYI' })
    })
    fireEvent.click(screen.getByLabelText('Cerrar notificación'))
    expect(screen.queryByText('FYI')).not.toBeInTheDocument()
  })

  it('auto-dismisses after its durationMs', () => {
    render(<NotificationHost />)
    act(() => {
      notify({ tone: 'success', message: 'Saved', durationMs: 1000 })
    })
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('stacks multiple notifications independently', () => {
    render(<NotificationHost />)
    act(() => {
      notify({ tone: 'error', message: 'First' })
      notify({ tone: 'success', message: 'Second' })
    })
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})
