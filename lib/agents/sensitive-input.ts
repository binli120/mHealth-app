/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

export const SSN_CHAT_HANDOFF_MESSAGE = "Please enter your SSN directly in the form, then come back here."

const SSN_KEYWORD_PATTERN = /\b(?:ssn|ss#|social security(?: number)?|social-security(?: number)?)\b/i
const SSN_VALUE_PATTERN = /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/

export function containsSsnLikeContent(value: string): boolean {
  return SSN_KEYWORD_PATTERN.test(value) || SSN_VALUE_PATTERN.test(value)
}
