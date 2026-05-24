/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 *
 * Password strength rules and scoring for the registration flow.
 *
 * Rules (all must pass for a "strong" password):
 *   1. Minimum 12 characters
 *   2. At least one uppercase letter (A–Z)
 *   3. At least one lowercase letter (a–z)
 *   4. At least one digit (0–9)
 *   5. At least one special character
 */

export interface PasswordRule {
  key: "length" | "uppercase" | "lowercase" | "digit" | "special"
  met: boolean
}

export type PasswordStrengthLevel = "empty" | "weak" | "fair" | "good" | "strong"

export interface PasswordStrength {
  rules: PasswordRule[]
  /** 0–5: number of rules currently satisfied */
  score: number
  level: PasswordStrengthLevel
  /** True when every rule is satisfied */
  isValid: boolean
}

const SPECIAL_RE = /[!@#$%^&*()\-_=+[\]{};:'",.<>/?\\|`~]/

export function checkPasswordStrength(password: string): PasswordStrength {
  const rules: PasswordRule[] = [
    { key: "length",    met: password.length >= 12 },
    { key: "uppercase", met: /[A-Z]/.test(password) },
    { key: "lowercase", met: /[a-z]/.test(password) },
    { key: "digit",     met: /[0-9]/.test(password) },
    { key: "special",   met: SPECIAL_RE.test(password) },
  ]

  const score = rules.filter((r) => r.met).length

  let level: PasswordStrengthLevel
  if (password.length === 0) level = "empty"
  else if (score <= 2)       level = "weak"
  else if (score === 3)      level = "fair"
  else if (score === 4)      level = "good"
  else                       level = "strong"

  return { rules, score, level, isValid: score === 5 }
}
