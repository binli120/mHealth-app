import "server-only"

import {
  deleteCustomerPersonalData,
  getPersonalDataResetContext,
  verifyCustomerPersonalDataDeleted,
  withPersonalDataResetLock,
} from "@/lib/db/personal-data-reset"
import {
  deleteStoragePathsInBatches,
  findExistingStoragePaths,
  listStoragePrefix,
} from "@/lib/supabase/storage"
import { getSupabaseAdminClient } from "@/lib/supabase/server"

async function clearOptionalAuthMetadata(userId: string): Promise<void> {
  const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(userId, {
    user_metadata: {},
  })
  if (error) throw new Error("Authentication metadata cleanup failed.")
}

export async function resetPersonalData(userId: string): Promise<void> {
  await withPersonalDataResetLock(userId, async (database) => {
    const context = await getPersonalDataResetContext(userId, database)
    const prefixPaths = await listStoragePrefix({ folderPath: userId })
    const phiDraftPaths: string[] = []
    for (const applicationId of context.applicationIds) {
      phiDraftPaths.push(
        ...(await listStoragePrefix({ folderPath: `phi-drafts/${applicationId}` })),
      )
    }

    await deleteStoragePathsInBatches({
      storagePaths: [...context.storagePaths, ...prefixPaths, ...phiDraftPaths],
    })
    await clearOptionalAuthMetadata(userId)
    await deleteCustomerPersonalData(userId, database)
    await verifyCustomerPersonalDataDeleted(userId, database)

    const remainingUserPaths = await listStoragePrefix({ folderPath: userId })
    const remainingExplicitPaths = await findExistingStoragePaths(context.storagePaths)
    const hasRemainingPhiPath = await (async () => {
      for (const applicationId of context.applicationIds) {
        const paths = await listStoragePrefix({ folderPath: `phi-drafts/${applicationId}` })
        if (paths.length > 0) return true
      }
      return false
    })()
    if (remainingUserPaths.length > 0 || remainingExplicitPaths.length > 0 || hasRemainingPhiPath) {
      throw new Error("Personal data storage verification failed.")
    }
  })
}
