/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type { AianMember } from "../types"
import { money, repeater, select, text, yesNo } from "./builders"
import { PREMIUM_FREQUENCIES } from "./options"
import type { Saca2StepContent } from "./types"

export const SUPPLEMENT_B_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    {
      id: "aianMembers",
      title: "American Indian or Alaska Native household members",
      description:
        "American Indians and Alaska Natives can get services from the Indian Health Service, tribal health programs, or Urban Indian Health Programs. They may also not have to pay cost sharing and may get special monthly enrollment periods.",
      questions: [
        repeater(
          "supplements.b.members",
          "Household members",
          {
            questions: [
              text("name", "Name (first, middle, last)", { required: true }),
              yesNo("federallyRecognizedTribe", "Member of a federally recognized tribe?", { required: true }),
              text("tribeName", "Tribe name", { required: true, visibleWhen: (ctx) => ctx.item?.federallyRecognizedTribe === "yes" }),
              yesNo("massRecognizedTribe", "Member of a Massachusetts-recognized tribe?", { required: true }),
              text("massTribeName", "Tribe name", { required: true, visibleWhen: (ctx) => ctx.item?.massRecognizedTribe === "yes" }),
              yesNo("receivedIhsService", "Has this person ever gotten a service from the Indian Health Service, a tribal health program, or Urban Indian Health Program, or through a referral from one of these programs?", { required: true }),
              yesNo("eligibleForIhs", "If No, is this person eligible to get services from the Indian Health Service, tribal health programs, or Urban Indian Health Program, or through a referral from one of these programs?", {
                required: true,
                visibleWhen: (ctx) => ctx.item?.receivedIhsService === "no",
              }),
              money("excludedIncomeAmount", "Money that may not be counted for MassHealth ($): per capita payments from a tribe from natural resources, usage rights, leases, or royalties; payments from Indian trust land; money from selling things of cultural significance", {}),
              select("excludedIncomeFrequency", "How often", PREMIUM_FREQUENCIES, {
                required: true,
                visibleWhen: (ctx) => typeof ctx.item?.excludedIncomeAmount === "number",
              }),
            ],
            emptyItem: () =>
              ({
                name: "",
                federallyRecognizedTribe: null,
                tribeName: "",
                massRecognizedTribe: null,
                massTribeName: "",
                receivedIhsService: null,
                eligibleForIhs: null,
                excludedIncomeAmount: null,
                excludedIncomeFrequency: null,
              }) satisfies AianMember,
            addLabel: "Add a household member",
            itemTitle: "Household member",
            maxItems: 6,
          },
          { required: true },
        ),
      ],
    },
  ],
}
