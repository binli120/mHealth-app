/**
 * Generate database schema documentation artifacts from a live Postgres database.
 *
 * Outputs:
 * - supabase/er-diagram.md
 * - docs/database-schema.drawio
 * - docs/database/CLOUD_DATABASE_ERD.md
 * - docs/database/052802026.drawio
 */

import { writeFile } from "node:fs/promises"
import { Pool } from "pg"

const DATABASE_URL =
  process.env.DATABASE_URL_DEV ||
  process.env.DATABASE_URL_PROD ||
  process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL, DATABASE_URL_DEV, or DATABASE_URL_PROD.")
  process.exit(1)
}

const EXCLUDED_TABLES = new Set(["schema_migrations"])

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function escapeHtml(value) {
  return escapeXml(value).replaceAll("\n", " ")
}

function formatColumnType(column) {
  if (column.udt_name === "vector") {
    return column.formatted_type
  }

  return column.formatted_type
    .replace("timestamp with time zone", "timestamptz")
    .replace("timestamp without time zone", "timestamp")
    .replace("character varying", "varchar")
    .replace("integer", "int")
}

function mermaidType(type) {
  return type
    .replace(/\(.+\)/, "")
    .replaceAll(" ", "_")
    .replaceAll("[", "")
    .replaceAll("]", "")
}

function toMermaidIdentifier(name) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `"${name}"`
}

function columnBadge(column, primaryKeys, foreignKeys) {
  const badges = []
  const pkOrdinal = primaryKeys.get(column.table_name)?.get(column.column_name)
  const fkCount = foreignKeys.filter(
    (fk) =>
      fk.table_name === column.table_name &&
      fk.column_name === column.column_name
  ).length

  if (pkOrdinal) badges.push("PK")
  if (fkCount > 0) badges.push("FK")
  if (column.is_nullable === "NO" && !pkOrdinal) badges.push("NN")
  if (column.unique_constraint_count > 0 && !pkOrdinal) badges.push("UK")

  return badges.join("_")
}

function buildTables(columns) {
  const tables = new Map()

  for (const column of columns) {
    if (!tables.has(column.table_name)) {
      tables.set(column.table_name, {
        name: column.table_name,
        comment: column.table_comment,
        columns: [],
      })
    }

    tables.get(column.table_name).columns.push({
      ...column,
      type: formatColumnType(column),
    })
  }

  return [...tables.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function buildPrimaryKeyMap(primaryKeys) {
  const map = new Map()

  for (const key of primaryKeys) {
    if (!map.has(key.table_name)) {
      map.set(key.table_name, new Map())
    }

    map.get(key.table_name).set(key.column_name, key.ordinal_position)
  }

  return map
}

function buildForeignKeyRelationships(foreignKeys) {
  const constraints = new Map()

  for (const fk of foreignKeys) {
    const key = [fk.constraint_name, fk.table_name, fk.foreign_table_name].join(
      ":"
    )

    if (!constraints.has(key)) {
      constraints.set(key, {
        constraint_name: fk.constraint_name,
        table_name: fk.table_name,
        foreign_table_name: fk.foreign_table_name,
        columns: [],
        foreign_columns: [],
      })
    }

    const constraint = constraints.get(key)
    constraint.columns.push(fk.column_name)
    constraint.foreign_columns.push(fk.foreign_column_name)
  }

  const relationships = []
  const seen = new Set()

  for (const constraint of constraints.values()) {
    const exactRelationship = [
      constraint.table_name,
      constraint.columns.join(","),
      constraint.foreign_table_name,
      constraint.foreign_columns.join(","),
    ].join(":")

    if (seen.has(exactRelationship)) continue
    seen.add(exactRelationship)
    relationships.push(constraint)
  }

  return relationships.sort((a, b) =>
    `${a.foreign_table_name}:${a.table_name}:${a.columns.join(",")}`.localeCompare(
      `${b.foreign_table_name}:${b.table_name}:${b.columns.join(",")}`
    )
  )
}

function buildMarkdown({
  tables,
  primaryKeyMap,
  foreignKeys,
  relationships,
  generatedAt,
  title = "mHealth Database ER Diagram",
  intro = `Generated from the live Postgres database. Last updated: ${generatedAt}.`,
}) {
  const lines = [
    `# ${title}`,
    "",
    intro,
    "",
    "```mermaid",
    "erDiagram",
    "",
  ]

  for (const table of tables) {
    lines.push(`    ${toMermaidIdentifier(table.name)} {`)

    for (const column of table.columns) {
      const badge = columnBadge(column, primaryKeyMap, foreignKeys)
      const badgeText = badge ? ` ${badge}` : ""
      lines.push(
        `        ${mermaidType(column.type)} ${toMermaidIdentifier(column.column_name)}${badgeText}`
      )
    }

    lines.push("    }", "")
  }

  for (const relationship of relationships) {
    const label = `${relationship.columns.join(", ")} -> ${relationship.foreign_columns.join(", ")}`
    lines.push(
      `    ${toMermaidIdentifier(relationship.foreign_table_name)} ||--o{ ${toMermaidIdentifier(relationship.table_name)} : "${label}"`
    )
  }

  lines.push("```")

  return `${lines.join("\n")}\n`
}

function buildCloudMarkdown({
  tables,
  primaryKeyMap,
  foreignKeys,
  relationships,
  generatedAt,
}) {
  const intro = [
    "**Source:** Cloud Supabase `public` schema",
    "**Database:** `postgres`",
    `**Inspected at:** ${generatedAt}`,
    "**Scope:** Schema metadata only. No row data was read.",
    "",
    `The cloud database currently exposes **${tables.length} public base tables**. The ERD below is generated from live table, column, primary-key, unique-key, nullability, and foreign-key metadata.`,
  ].join("\n")

  return buildMarkdown({
    tables,
    primaryKeyMap,
    foreignKeys,
    relationships,
    generatedAt,
    title: "Cloud Database Entity Relationship Diagram",
    intro,
  })
}

function buildDrawio({ tables, primaryKeyMap, foreignKeys, relationships }) {
  const nodeWidth = 340
  const minNodeHeight = 118
  const rowHeight = 23
  const columnsPerRow = 4
  const xSpacing = 410
  const ySpacing = 95
  const cells = [
    '    <mxCell id="0" />',
    '    <mxCell id="1" parent="0" />',
  ]
  const nodeIds = new Map()

  tables.forEach((table, index) => {
    const id = `table-${index}`
    const x = (index % columnsPerRow) * xSpacing
    const row = Math.floor(index / columnsPerRow)
    const height = Math.max(minNodeHeight, 70 + table.columns.length * rowHeight)
    const priorRows = tables
      .slice(0, row * columnsPerRow)
      .filter((_, priorIndex) => priorIndex % columnsPerRow === 0)
      .map((_, priorRow) => {
        const rowTables = tables.slice(
          priorRow * columnsPerRow,
          priorRow * columnsPerRow + columnsPerRow
        )
        return Math.max(
          ...rowTables.map((rowTable) =>
            Math.max(minNodeHeight, 70 + rowTable.columns.length * rowHeight)
          )
        )
      })
    const y =
      priorRows.reduce((sum, rowHeightValue) => sum + rowHeightValue, 0) +
      row * ySpacing

    nodeIds.set(table.name, id)

    const columnLines = table.columns.map((column) => {
      const badge = columnBadge(column, primaryKeyMap, foreignKeys)
      const badgeText = badge ? ` [${badge}]` : ""
      return `${escapeHtml(column.column_name)}: ${escapeHtml(column.type)}${badgeText}`
    })

    const value = [
      '<p style="margin:0px;margin-top:4px;text-align:center;"><b>',
      escapeHtml(table.name),
      "</b></p>",
      '<hr size="1"/>',
      '<p style="margin:0 0 0 8px;line-height:1.55;">',
      columnLines.join("<br/>"),
      "</p>",
    ].join("")

    cells.push(
      `    <mxCell id="${id}" parent="1" vertex="1" value="${escapeXml(value)}" style="verticalAlign=top;align=left;overflow=fill;fontSize=13;fontFamily=Helvetica;html=1;rounded=0;shadow=0;comic=0;labelBackgroundColor=none;strokeWidth=1;">`,
      `      <mxGeometry x="${x}" y="${y}" width="${nodeWidth}" height="${height}" as="geometry" />`,
      "    </mxCell>"
    )
  })

  relationships.forEach((relationship, index) => {
    const source = nodeIds.get(relationship.table_name)
    const target = nodeIds.get(relationship.foreign_table_name)
    if (!source || !target) return

    cells.push(
      `    <mxCell id="edge-${index}" parent="1" edge="1" source="${source}" target="${target}" value="${escapeXml(`${relationship.columns.join(", ")} -> ${relationship.foreign_columns.join(", ")}`)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=block;endFill=1;fontSize=11;fontFamily=Helvetica;">`,
      '      <mxGeometry relative="1" as="geometry" />',
      "    </mxCell>"
    )
  })

  return [
    '<mxGraphModel dx="1600" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" background="none" math="0" shadow="0">',
    "  <root>",
    ...cells,
    "  </root>",
    "</mxGraphModel>",
    "",
  ].join("\n")
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
})

try {
  const [columnsResult, primaryKeysResult, foreignKeysResult] =
    await Promise.all([
      pool.query(`
        select
          c.table_name,
          c.column_name,
          c.ordinal_position,
          c.is_nullable,
          c.udt_name,
          format_type(a.atttypid, a.atttypmod) as formatted_type,
          coalesce(col_description(a.attrelid, a.attnum), '') as column_comment,
          coalesce(obj_description(cls.oid, 'pg_class'), '') as table_comment,
          (
            select count(*)
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on kcu.constraint_schema = tc.constraint_schema
             and kcu.constraint_name = tc.constraint_name
             and kcu.table_schema = tc.table_schema
             and kcu.table_name = tc.table_name
            where tc.constraint_type = 'UNIQUE'
              and tc.table_schema = c.table_schema
              and tc.table_name = c.table_name
              and kcu.column_name = c.column_name
          )::int as unique_constraint_count
        from information_schema.columns c
        join pg_class cls
          on cls.relname = c.table_name
        join pg_namespace ns
          on ns.oid = cls.relnamespace
         and ns.nspname = c.table_schema
        join pg_attribute a
          on a.attrelid = cls.oid
         and a.attname = c.column_name
         and a.attnum > 0
        where c.table_schema = 'public'
          and c.table_name <> all($1::text[])
          and cls.relkind in ('r', 'p')
        order by c.table_name, c.ordinal_position
      `, [[...EXCLUDED_TABLES]]),
      pool.query(`
        select
          kcu.table_name,
          kcu.column_name,
          kcu.ordinal_position
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_schema = tc.constraint_schema
         and kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
         and kcu.table_name = tc.table_name
        where tc.constraint_type = 'PRIMARY KEY'
          and tc.table_schema = 'public'
          and tc.table_name <> all($1::text[])
        order by kcu.table_name, kcu.ordinal_position
      `, [[...EXCLUDED_TABLES]]),
      pool.query(`
        select
          tc.constraint_name,
          kcu.table_name,
          kcu.column_name,
          kcu_ref.table_name as foreign_table_name,
          kcu_ref.column_name as foreign_column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on kcu.constraint_schema = tc.constraint_schema
         and kcu.constraint_name = tc.constraint_name
         and kcu.table_schema = tc.table_schema
         and kcu.table_name = tc.table_name
        join information_schema.referential_constraints rc
          on rc.constraint_schema = tc.constraint_schema
         and rc.constraint_name = tc.constraint_name
        join information_schema.key_column_usage kcu_ref
          on kcu_ref.constraint_schema = rc.unique_constraint_schema
         and kcu_ref.constraint_name = rc.unique_constraint_name
         and kcu_ref.ordinal_position = kcu.position_in_unique_constraint
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = 'public'
          and kcu.table_name <> all($1::text[])
          and kcu_ref.table_name <> all($1::text[])
        order by kcu.table_name, tc.constraint_name, kcu.ordinal_position
      `, [[...EXCLUDED_TABLES]]),
    ])

  const tables = buildTables(columnsResult.rows)
  const primaryKeyMap = buildPrimaryKeyMap(primaryKeysResult.rows)
  const foreignKeys = foreignKeysResult.rows
  const relationships = buildForeignKeyRelationships(foreignKeys)
  const generatedAt = new Date().toISOString().slice(0, 10)

  await writeFile(
    "supabase/er-diagram.md",
    buildMarkdown({
      tables,
      primaryKeyMap,
      foreignKeys,
      relationships,
      generatedAt,
    })
  )
  const drawio = buildDrawio({ tables, primaryKeyMap, foreignKeys, relationships })
  await writeFile("docs/database-schema.drawio", drawio)
  await writeFile("docs/database/052802026.drawio", drawio)
  await writeFile(
    "docs/database/CLOUD_DATABASE_ERD.md",
    buildCloudMarkdown({
      tables,
      primaryKeyMap,
      foreignKeys,
      relationships,
      generatedAt,
    })
  )

  console.log(
    `Generated schema artifacts for ${tables.length} public tables, ${foreignKeys.length} foreign-key columns, and ${relationships.length} relationships.`
  )
} finally {
  await pool.end()
}
