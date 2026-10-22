/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { Saca2QuestionContext } from "./types"

export const person = (ctx: Saca2QuestionContext) => ctx.answers.persons[ctx.personIndex]
export const who = (you: string, they: string) => (ctx: Saca2QuestionContext) => (ctx.personIndex === 0 ? you : they)
export const isSecondPerson = (ctx: Saca2QuestionContext) => ctx.personIndex > 0
export const applying = (ctx: Saca2QuestionContext) => person(ctx)?.applyingForCoverage === "yes"
export const noncitizen = (ctx: Saca2QuestionContext) => applying(ctx) && person(ctx)?.usCitizenOrNational === "no"
