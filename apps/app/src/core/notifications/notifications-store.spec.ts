import { useNotificationsStore, notify } from './notifications-store'

describe('notifications-store', () => {
  beforeEach(() => {
    useNotificationsStore.setState({ queue: [] })
  })

  it('notify() pushes a notification onto the queue and returns its id', () => {
    const id = notify({ tone: 'error', message: 'Something failed' })
    const queue = useNotificationsStore.getState().queue
    expect(queue).toHaveLength(1)
    expect(queue[0].id).toBe(id)
    expect(queue[0].message).toBe('Something failed')
    expect(queue[0].tone).toBe('error')
  })

  it('defaults durationMs per tone when not given', () => {
    notify({ tone: 'error', message: 'e' })
    notify({ tone: 'success', message: 's' })
    const [errorNotif, successNotif] = useNotificationsStore.getState().queue
    expect(errorNotif.durationMs).toBeGreaterThan(successNotif.durationMs)
  })

  it('carries an optional action through untouched', () => {
    const onClick = jest.fn()
    notify({ tone: 'error', message: 'e', action: { label: 'Reintentar', onClick } })
    const [n] = useNotificationsStore.getState().queue
    expect(n.action?.label).toBe('Reintentar')
    n.action?.onClick()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('dismiss() removes only the matching notification', () => {
    const id1 = notify({ tone: 'info', message: 'one' })
    notify({ tone: 'info', message: 'two' })
    useNotificationsStore.getState().dismiss(id1)
    const queue = useNotificationsStore.getState().queue
    expect(queue).toHaveLength(1)
    expect(queue[0].message).toBe('two')
  })
})
