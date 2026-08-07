import { describe, it, expect } from 'vitest'
import { KeyedQueue } from '../keyedQueue'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('KeyedQueue', () => {
  it('voert taken met dezelfde sleutel op volgorde uit', async () => {
    const queue = new KeyedQueue()
    const order: number[] = []
    const first = deferred()

    const a = queue.run('x', async () => {
      await first.promise
      order.push(1)
    })
    const b = queue.run('x', async () => {
      order.push(2)
    })

    first.resolve()
    await Promise.all([a, b])

    expect(order).toEqual([1, 2])
  })

  it('laat taken met verschillende sleutels parallel lopen', async () => {
    const queue = new KeyedQueue()
    const order: string[] = []
    const blocker = deferred()

    const slow = queue.run('a', async () => {
      await blocker.promise
      order.push('a')
    })
    const fast = queue.run('b', async () => {
      order.push('b')
    })

    await fast
    expect(order).toEqual(['b'])

    blocker.resolve()
    await slow
    expect(order).toEqual(['b', 'a'])
  })

  it('flush wacht tot alle taken klaar zijn', async () => {
    const queue = new KeyedQueue()
    let done = false
    const blocker = deferred()

    void queue.run('x', async () => {
      await blocker.promise
      done = true
    })

    setTimeout(() => blocker.resolve(), 0)
    await queue.flush()

    expect(done).toBe(true)
    expect(queue.pending).toBe(0)
  })

  it('een mislukte taak blokkeert de volgende niet', async () => {
    const queue = new KeyedQueue()
    const failing = queue.run('x', async () => {
      throw new Error('boem')
    })
    await expect(failing).rejects.toThrow('boem')

    await expect(queue.run('x', async () => 'ok')).resolves.toBe('ok')
  })

  it('flush gooit niet wanneer een taak faalt', async () => {
    const queue = new KeyedQueue()
    void queue.run('x', async () => {
      throw new Error('boem')
    }).catch(() => undefined)

    await expect(queue.flush()).resolves.toBeUndefined()
  })
})
