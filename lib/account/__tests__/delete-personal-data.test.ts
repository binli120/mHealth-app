import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/personal-data-reset", () => ({
  deleteCustomerPersonalData: vi.fn(),
  getPersonalDataResetContext: vi.fn(),
  verifyCustomerPersonalDataDeleted: vi.fn(),
  withPersonalDataResetLock: vi.fn((_userId: string, work: (database: object) => Promise<unknown>) => work({})),
}))
vi.mock("@/lib/supabase/storage", () => ({
  deleteStoragePathsInBatches: vi.fn(),
  findExistingStoragePaths: vi.fn(),
  listStoragePrefix: vi.fn(),
}))
const updateUserById = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: () => ({
    auth: { admin: { updateUserById } },
  }),
}))

import { resetPersonalData } from "@/lib/account/delete-personal-data"
import {
  deleteCustomerPersonalData,
  getPersonalDataResetContext,
  verifyCustomerPersonalDataDeleted,
} from "@/lib/db/personal-data-reset"
import {
  deleteStoragePathsInBatches,
  findExistingStoragePaths,
  listStoragePrefix,
} from "@/lib/supabase/storage"

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPersonalDataResetContext).mockResolvedValue({
    applicationIds: ["application-id"],
    storagePaths: ["explicit-file"],
  })
  vi.mocked(listStoragePrefix)
    .mockResolvedValueOnce(["user-file"])
    .mockResolvedValueOnce(["phi-file"])
    .mockResolvedValue([])
  vi.mocked(deleteStoragePathsInBatches).mockResolvedValue(undefined)
  vi.mocked(findExistingStoragePaths).mockResolvedValue([])
  updateUserById.mockResolvedValue({ error: null })
  vi.mocked(deleteCustomerPersonalData).mockResolvedValue(undefined)
  vi.mocked(verifyCustomerPersonalDataDeleted).mockResolvedValue(undefined)
})

describe("resetPersonalData", () => {
  it("deletes every inventoried path before deleting database rows", async () => {
    await resetPersonalData("user-id")
    expect(deleteStoragePathsInBatches).toHaveBeenCalledWith({
      storagePaths: ["explicit-file", "user-file", "phi-file"],
    })
    expect(deleteStoragePathsInBatches).toHaveBeenCalledBefore(
      vi.mocked(deleteCustomerPersonalData),
    )
    expect(verifyCustomerPersonalDataDeleted).toHaveBeenCalledWith("user-id", {})
    expect(updateUserById).toHaveBeenCalledWith("user-id", { user_metadata: {} })
  })

  it("does not delete database rows when storage cleanup fails", async () => {
    vi.mocked(deleteStoragePathsInBatches).mockRejectedValue(new Error("storage unavailable"))
    await expect(resetPersonalData("user-id")).rejects.toThrow("storage unavailable")
    expect(deleteCustomerPersonalData).not.toHaveBeenCalled()
  })

  it("fails when residual objects remain", async () => {
    vi.mocked(listStoragePrefix).mockReset()
    vi.mocked(listStoragePrefix)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["residual"])
      .mockResolvedValueOnce([])
    await expect(resetPersonalData("user-id")).rejects.toThrow("storage verification")
  })

  it("fails when an explicitly referenced object remains outside known prefixes", async () => {
    vi.mocked(findExistingStoragePaths).mockResolvedValue(["help/question/file.pdf"])
    await expect(resetPersonalData("user-id")).rejects.toThrow("storage verification")
  })
})
