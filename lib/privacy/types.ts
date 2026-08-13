/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

export interface PrivacyFrontmatter {
  version: string
  effectiveDate: string
  lastReviewedBy: string
  jurisdictionsCovered: string[]
  contact: {
    name: string
    email: string
    address: string
  }
}

export interface PrivacySectionMeta {
  id: string
  title: string
}
