/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import "server-only"

import { Resend } from "resend"

// Use a placeholder key in dev so the module loads without throwing.
// The invite route checks process.env.RESEND_API_KEY before actually sending.
export const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder_dev_only")
