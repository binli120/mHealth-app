/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import inventoryJson from "./field-inventory.json"

export type Saca2FieldInfo = {
  name: string
  type: "text" | "checkbox" | "button"
  /** 0-based page indexes the field's widgets appear on. */
  pages: number[]
  widgets: Array<{
    /** 0-based page index. */
    page: number
    /** [x1, y1, x2, y2] in PDF points, rounded to 2 decimals. */
    rect: [number, number, number, number]
    /** Non-Off appearance-state name (checkbox widgets only). */
    onState?: string
  }>
  maxLen?: number
}

const inventory = inventoryJson as Saca2FieldInfo[]
const byName = new Map(inventory.map((f) => [f.name, f]))

export function getInventory(): readonly Saca2FieldInfo[] {
  return inventory
}

export function getFieldInfo(name: string): Saca2FieldInfo | undefined {
  return byName.get(name)
}
