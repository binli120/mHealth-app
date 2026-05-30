/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

"use client"

import { useCallback, useState } from "react"
import {
  splitWizardState,
  buildPhiToken,
  decryptPhiToken,
  mergePhiIntoState,
  serializeToken,
  deserializeToken,
  downloadTokenFile,
  type PhiToken,
} from "@/lib/phi-token/token"

export interface PhiTokenExportResult {
  token: PhiToken
  tokenString: string
  safeState: Record<string, unknown>
}

export interface UsePhiTokenReturn {
  /**
   * Split the wizard state, encrypt PHI, and return the token + safe state.
   * The caller decides whether to download the file or show the export dialog.
   */
  exportToken: (
    wizardState: Record<string, unknown>,
    applicationId: string,
  ) => Promise<PhiTokenExportResult>

  /** Download the token file directly (convenience wrapper). */
  downloadToken: (
    wizardState: Record<string, unknown>,
    applicationId: string,
  ) => Promise<PhiTokenExportResult>

  /**
   * Parse and decrypt a token string (file contents or pasted code), then
   * merge the recovered PHI back into the given server state snapshot.
   */
  importToken: (
    tokenString: string,
    serverState: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>

  /** Last successfully exported token (used to re-trigger download). */
  lastToken: PhiToken | null

  importError: string | null
  isImporting: boolean
}

export function usePhiToken(): UsePhiTokenReturn {
  const [lastToken, setLastToken] = useState<PhiToken | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const exportToken = useCallback(
    async (
      wizardState: Record<string, unknown>,
      applicationId: string,
    ): Promise<PhiTokenExportResult> => {
      const { safeState, phiPayload } = splitWizardState(wizardState)
      const token = await buildPhiToken(applicationId, phiPayload)
      setLastToken(token)
      return { token, tokenString: serializeToken(token), safeState }
    },
    [],
  )

  const downloadToken = useCallback(
    async (
      wizardState: Record<string, unknown>,
      applicationId: string,
    ): Promise<PhiTokenExportResult> => {
      const result = await exportToken(wizardState, applicationId)
      downloadTokenFile(result.token, applicationId)
      return result
    },
    [exportToken],
  )

  const importToken = useCallback(
    async (
      tokenString: string,
      serverState: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => {
      setImportError(null)
      setIsImporting(true)
      try {
        const token = deserializeToken(tokenString)
        const phiPayload = await decryptPhiToken(token)
        return mergePhiIntoState(serverState, phiPayload)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to restore from resume file."
        setImportError(message)
        throw err
      } finally {
        setIsImporting(false)
      }
    },
    [],
  )

  return { exportToken, downloadToken, importToken, lastToken, importError, isImporting }
}
