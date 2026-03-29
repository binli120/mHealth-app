/**
 * Shared custom-event helpers for opening the patient chat widget
 * programmatically from anywhere on the page (dashboard card, notification
 * dropdown, etc.) without prop-drilling or shared state.
 */

export const OPEN_SW_CHAT_EVENT = "chat:open-sw"

export interface OpenSwChatDetail {
  swUserId: string
  swName: string
}

export function dispatchOpenSwChat(swUserId: string, swName: string): void {
  window.dispatchEvent(
    new CustomEvent<OpenSwChatDetail>(OPEN_SW_CHAT_EVENT, {
      detail: { swUserId, swName },
    }),
  )
}
