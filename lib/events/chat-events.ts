/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

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

/** Opens the widget to the Live Assistant (find-a-social-worker) tab. */
export const OPEN_LIVE_ASSISTANT_EVENT = "chat:open-live-assistant"

export function dispatchOpenLiveAssistant(): void {
  window.dispatchEvent(new CustomEvent(OPEN_LIVE_ASSISTANT_EVENT))
}

/**
 * Fired when a patient's SW engagement request changes (sent, accepted,
 * rejected, cancelled) so other mounted views — e.g. the dashboard's
 * "Social Worker Access" card — can refetch and stay in sync with the
 * corner chat widget's Live Assistant panel.
 */
export const SW_REQUEST_CHANGED_EVENT = "chat:sw-request-changed"

export function dispatchSwRequestChanged(): void {
  window.dispatchEvent(new CustomEvent(SW_REQUEST_CHANGED_EVENT))
}
