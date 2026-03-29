/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  OPEN_SW_CHAT_EVENT,
  dispatchOpenSwChat,
} from '../../../lib/events/chat-events'
import type { OpenSwChatDetail } from '../../../lib/events/chat-events'

describe('OPEN_SW_CHAT_EVENT', () => {
  it('has the expected event name constant', () => {
    expect(OPEN_SW_CHAT_EVENT).toBe('chat:open-sw')
  })
})

describe('dispatchOpenSwChat', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dispatches a CustomEvent on window', () => {
    const handler = vi.fn()
    window.addEventListener(OPEN_SW_CHAT_EVENT, handler)

    dispatchOpenSwChat('sw-123', 'Alice Smith')

    expect(handler).toHaveBeenCalledOnce()
    window.removeEventListener(OPEN_SW_CHAT_EVENT, handler)
  })

  it('event detail contains swUserId and swName', () => {
    let capturedDetail: OpenSwChatDetail | null = null

    const handler = (e: Event) => {
      capturedDetail = (e as CustomEvent<OpenSwChatDetail>).detail
    }
    window.addEventListener(OPEN_SW_CHAT_EVENT, handler)

    dispatchOpenSwChat('sw-456', 'Bob Jones')

    expect(capturedDetail).not.toBeNull()
    expect(capturedDetail?.swUserId).toBe('sw-456')
    expect(capturedDetail?.swName).toBe('Bob Jones')

    window.removeEventListener(OPEN_SW_CHAT_EVENT, handler)
  })

  it('dispatches separate events for multiple calls', () => {
    const handler = vi.fn()
    window.addEventListener(OPEN_SW_CHAT_EVENT, handler)

    dispatchOpenSwChat('sw-1', 'First SW')
    dispatchOpenSwChat('sw-2', 'Second SW')

    expect(handler).toHaveBeenCalledTimes(2)
    window.removeEventListener(OPEN_SW_CHAT_EVENT, handler)
  })

  it('forwards the exact arguments as detail properties', () => {
    const details: OpenSwChatDetail[] = []
    const handler = (e: Event) => {
      details.push((e as CustomEvent<OpenSwChatDetail>).detail)
    }
    window.addEventListener(OPEN_SW_CHAT_EVENT, handler)

    dispatchOpenSwChat('uid-aaa', 'Name One')
    dispatchOpenSwChat('uid-bbb', 'Name Two')

    expect(details[0]).toEqual({ swUserId: 'uid-aaa', swName: 'Name One' })
    expect(details[1]).toEqual({ swUserId: 'uid-bbb', swName: 'Name Two' })

    window.removeEventListener(OPEN_SW_CHAT_EVENT, handler)
  })
})
