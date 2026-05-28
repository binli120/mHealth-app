export const MIN_PASSWORD_LENGTH = 12

export function getPasswordMinLengthMessage(subject = "Password"): string {
  return `${subject} must be at least ${MIN_PASSWORD_LENGTH} characters.`
}
