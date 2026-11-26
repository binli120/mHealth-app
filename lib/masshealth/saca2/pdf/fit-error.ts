/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

/**
 * Thrown when the submitted answers cannot be placed on the form (more rows than the form and its copies
 * hold, a value longer than its field allows). The message carries counts and field names only, never an
 * answer, so a route can map it to a client error without leaking the data.
 */
export class Saca2FitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "Saca2FitError"
  }
}
