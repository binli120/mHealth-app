/**
 * TypeScript interfaces for the landing page data shapes.
 * @author Bin Lee
 */

import type { ReactNode } from "react"

export interface PreviewProgram {
  label: string
  badge: string
  color: string
  bg:    string
  delay: number
}

export interface Step {
  icon:  ReactNode
  title: string
  body:  string
}

export interface ProblemItem {
  icon:  ReactNode
  bg:    string
  title: string
  body:  string
  delay: number
}

export interface FeatureItem {
  icon:   ReactNode
  color:  string
  bg:     string
  title:  string
  body:   string
  delay:  number
  isNew?: boolean
}

export interface AppealCard {
  icon:  ReactNode
  color: string
  bg:    string
  title: string
  body:  string
}

export interface Testimonial {
  quote:    string
  name:     string
  location: string
  delay:    number
}

export interface StatConfig {
  /** Target (end) value for the animated counter. */
  target:     number
  suffix:     string
  prefix:     string
  label:      string
  /** Override counter animation duration in ms (default 1600). */
  duration?:  number
}

export interface FooterLink {
  label: string
  href:  string
}

export interface FadeUpProps {
  children:   ReactNode
  delay?:     number
  className?: string
}
