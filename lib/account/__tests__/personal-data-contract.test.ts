import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  CASCADE_DELETED_TABLES,
  PERSONAL_DATA_TABLE_CLASSIFICATION,
} from "@/lib/account/personal-data-contract"

describe("personal-data table contract", () => {
  it("classifies every table created by the current migration set", () => {
    const migrationDirectory = path.join(process.cwd(), "supabase", "migrations")
    const discovered = new Set<string>()
    const tablePattern = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi

    for (const fileName of fs.readdirSync(migrationDirectory).filter((name) => name.endsWith(".sql"))) {
      const sql = fs.readFileSync(path.join(migrationDirectory, fileName), "utf8")
      for (const match of sql.matchAll(tablePattern)) discovered.add(match[1])
    }

    const unclassified = [...discovered]
      .filter((table) => !(table in PERSONAL_DATA_TABLE_CLASSIFICATION))
      .sort()
    expect(unclassified).toEqual([])
  })

  it("maps every delete-classified table to an explicit delete or reviewed cascade", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260806000001_personal_data_reset.sql"),
      "utf8",
    )
    const explicitlyDeleted = new Set(
      [...migration.matchAll(/DELETE\s+FROM\s+public\.([a-z_][a-z0-9_]*)/gi)].map((match) => match[1]),
    )
    const covered = new Set([...explicitlyDeleted, ...CASCADE_DELETED_TABLES])
    const required = Object.entries(PERSONAL_DATA_TABLE_CLASSIFICATION)
      .filter(([, disposition]) => disposition === "delete")
      .map(([table]) => table)
    expect(required.filter((table) => !covered.has(table)).sort()).toEqual([])
  })

  it("guards optional public.users columns used by the reset", () => {
    const migration = fs.readFileSync(
      path.join(process.cwd(), "supabase", "migrations", "20260806000001_personal_data_reset.sql"),
      "utf8",
    )
    expect(migration).toMatch(/information_schema\.columns[\s\S]*column_name = 'avatar_url'/)
  })
})
