const NAME_PART_PATTERN = /[\p{L}\p{M}]/u

function getNamePartCount(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .filter((part) => NAME_PART_PATTERN.test(part)).length
}

export function hasFirstAndLastName(value: string): boolean {
  return getNamePartCount(value) >= 2
}

