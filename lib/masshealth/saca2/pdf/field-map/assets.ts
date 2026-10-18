/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import { BANK_LINES, BURIAL_KINDS, OWNERS, SECURITIES_KINDS, TRUST_LINES } from "../derived-assets"
import type { Encoder, FieldEntry } from "../types"

const YES_NO_1_2: Encoder = { kind: "yesNo", yes: "1", no: "2" }
/** Most Step 5 groups name their states: the Yes widget is "Yes", the No widget "No". */
const YES_NO_NAMED: Encoder = { kind: "yesNo", yes: "Yes", no: "No" }
const OPEN_CLOSED: Encoder = { kind: "pick", states: { open: "1", closed: "2" } }

const gate = (field: string, category: string, encode: Encoder = YES_NO_NAMED): FieldEntry => ({
  fields: [field],
  source: { kind: "answer", stepId: "assets", path: `assets.gates.${category}` },
  encode,
})

const row = (field: string, path: string, index: number, key: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "row", stepId: "assets", path, index, key },
  encode,
})

const derived = (field: string, id: string, encode: Encoder): FieldEntry => ({
  fields: [field],
  source: { kind: "derived", id },
  encode,
})

// ---------------------------------------------------------------------------------------------
// Bank accounts (form page 12 gates, page 13 table of 2 accounts)
// ---------------------------------------------------------------------------------------------

/** One field name per column for each of the two account blocks (the second block's names end in `_2`). */
const BANK_FIELDS = [
  {
    owner: "Name on account",
    type: "Account type",
    institution: "Name of bankinstitution",
    number: "Account number",
    balance: "Current balance",
    admission: "Balance on admission date",
    status: "Account open or closed",
    closedOn: "Date account closed mmddyyyy",
    closedBalance: "Amount on the date account closed",
  },
  {
    owner: "Name on account_2",
    type: "Account type_2",
    institution: "Name of bankinstitution_2",
    number: "Account number_2",
    balance: "Current balance_2",
    admission: "Balance on admission date_2",
    status: "Account open or closed_2",
    closedOn: "Date account closed mmddyyyy_2",
    closedBalance: "Amount on the date account closed_2",
  },
]

const BANK_PATH = "assets.bankAccounts"

const bankEntries: FieldEntry[] = [
  gate("S5.1", "bankAccounts", YES_NO_1_2),
  gate("S5.1a", "retirementAccounts", YES_NO_1_2),
  gate("S5.1b", "closedAccounts", YES_NO_1_2),
  ...BANK_FIELDS.slice(0, BANK_LINES).flatMap((f, line) => [
    row(f.owner, BANK_PATH, line, "ownerName", "text"),
    derived(f.type, `assets.bank.${line}.accountType`, "text"),
    row(f.institution, BANK_PATH, line, "institution", "text"),
    row(f.number, BANK_PATH, line, "accountNumber", "text"),
    // a closed account has no current balance: the wizard hides it, so only the closing amount is written
    row(f.balance, BANK_PATH, line, "currentBalance", "money"),
    row(f.admission, BANK_PATH, line, "balanceOnAdmissionDate", "money"),
    derived(f.status, `assets.bank.${line}.status`, OPEN_CLOSED),
    row(f.closedOn, BANK_PATH, line, "closedOn", "date"),
    row(f.closedBalance, BANK_PATH, line, "balanceWhenClosed", "money"),
  ]),
]

// ---------------------------------------------------------------------------------------------
// Real estate: four You / Your spouse groups and one table of 2 properties
// ---------------------------------------------------------------------------------------------

const REAL_ESTATE_FIELDS = [
  { address: "Address_real estate", type: "Type of property", value: "Current value" },
  { address: "Address_real estate_2", type: "Type of property_2", value: "Current value_2" },
]

const realEstateEntries: FieldEntry[] = [
  derived("Do you own or have a legal interest in your primary residence?", "assets.realEstate.primary.ownerGate", YES_NO_NAMED),
  derived("Does your spouse own or have a legal interest in your primary residence?", "assets.realEstate.primary.ownerGate", YES_NO_NAMED),
  derived("Do you own or have a legal interest in any real estate other than your primary residence?", "assets.realEstate.other.ownerGate", YES_NO_NAMED),
  derived(
    "Does your spouse own or have a legal interest in any real estate other than your primary residence?",
    "assets.realEstate.other.ownerGate",
    YES_NO_NAMED,
  ),
  ...REAL_ESTATE_FIELDS.flatMap((f, line) => [
    derived(f.address, `assets.realEstate.${line}.address`, "text"),
    derived(f.type, `assets.realEstate.${line}.propertyType`, "text"),
    derived(f.value, `assets.realEstate.${line}.currentValue`, "money"),
  ]),
]

// ---------------------------------------------------------------------------------------------
// Life insurance (2 policies; the wizard's cash-surrender value has no field on the form)
// ---------------------------------------------------------------------------------------------

const LIFE_PATH = "assets.lifeInsurance"
const LIFE_FIELDS = [
  {
    owners: "Name(s) of owner(s)_life insurance",
    company: "Insurance company_life insurance",
    number: "Policy number_life insurance",
    face: "Face value_life insurance",
    type: "Insurance type_life insurance",
  },
  {
    owners: "Name(s) of owner(s)_life insurance_2",
    company: "Insurance company_life insurance_2",
    number: "Policy number_life insurance_2",
    face: "Face value_life insurance_2",
    type: "Insurance type_life insurance_2",
  },
]

const lifeEntries: FieldEntry[] = [
  gate("Do you or your spouse own any life insurance?", "lifeInsurance"),
  ...LIFE_FIELDS.flatMap((f, line) => [
    row(f.owners, LIFE_PATH, line, "owners", "text"),
    row(f.company, LIFE_PATH, line, "company", "text"),
    row(f.number, LIFE_PATH, line, "policyNumber", "text"),
    row(f.face, LIFE_PATH, line, "faceValue", "money"),
    row(f.type, LIFE_PATH, line, "insuranceType", "text"),
  ]),
]

// ---------------------------------------------------------------------------------------------
// Securities: one row per type. Field names are the form's own (`fill_N` for the two value columns).
// ---------------------------------------------------------------------------------------------

/** Per type: the name suffix of the three text columns, the Joint asset group, and the two value fields. */
const SECURITIES_FIELDS: Record<(typeof SECURITIES_KINDS)[number][0], { suffix: string; joint: string; current: string; admission: string }> = {
  cash: { suffix: "Cash", joint: "Joint assetCash?", current: "fill_34", admission: "fill_35" },
  stocks: { suffix: "Stocks", joint: "Joint assetStocks?", current: "fill_36", admission: "fill_37" },
  bonds: { suffix: "Bonds", joint: "Joint assetBonds?", current: "fill_38", admission: "fill_39" },
  savingsBonds: { suffix: "Savings bonds", joint: "Joint assetSavingsBonds?", current: "fill_40", admission: "fill_41" },
  mutualFunds: { suffix: "Mutual funds", joint: "Joint assetMutualFunds?", current: "fill_42", admission: "fill_43" },
  options: { suffix: "Options", joint: "Joint assetOptions?", current: "fill_44", admission: "fill_45" },
  futures: { suffix: "Future contracts", joint: "Joint assetFutureContracts?", current: "fill_46", admission: "fill_47" },
  other: { suffix: "Other", joint: "Joint assetOther?", current: "fill_48", admission: "fill_49" },
}

const securitiesEntries: FieldEntry[] = [
  gate("Securities brokerage accounts?", "securities"),
  ...SECURITIES_KINDS.flatMap(([kind]) => {
    const f = SECURITIES_FIELDS[kind]
    const id = (key: string) => `assets.securities.${kind}.${key}`
    return [
      derived(`Owners names${f.suffix}`, id("owners"), "text"),
      derived(`Company name${f.suffix}`, id("company"), "text"),
      derived(`Account number${f.suffix}`, id("accountNumber"), "text"),
      derived(f.current, id("currentValue"), "money"),
      derived(f.admission, id("valueOnAdmissionDate"), "money"),
      derived(f.joint, id("joint"), YES_NO_NAMED),
    ]
  }),
]

// ---------------------------------------------------------------------------------------------
// Annuities (2), assisted living deposit (1)
// ---------------------------------------------------------------------------------------------

const ANNUITY_PATH = "assets.annuities"
const ANNUITY_FIELDS = [
  {
    owners: "Name(s) of owner(s)_Annuities",
    institution: "Name of institution issuing annuity_Annuities",
    contract: "Contract number_Annuities",
    date: "Date purchased mmddyyyy_Annuities",
  },
  {
    owners: "Name(s) of owner(s)_Annuities_2",
    institution: "Name of institution issuing annuity_Annuities_2",
    contract: "Contract number__Annuities_2",
    date: "Date purchased mmddyyyy__Annuities_2",
  },
]

const DEPOSIT_PATH = "assets.assistedLivingDeposits"

const annuityEntries: FieldEntry[] = [
  gate("Annuities", "annuities"),
  ...ANNUITY_FIELDS.flatMap((f, line) => [
    row(f.owners, ANNUITY_PATH, line, "owners", "text"),
    row(f.institution, ANNUITY_PATH, line, "institution", "text"),
    row(f.contract, ANNUITY_PATH, line, "contractNumber", "text"),
    row(f.date, ANNUITY_PATH, line, "purchasedOn", "date"),
  ]),
  gate("Assisted living", "assistedLivingDeposit"),
  row("Name of facility_Assisted living", DEPOSIT_PATH, 0, "facilityName", "text"),
  row("Address_Assisted living", DEPOSIT_PATH, 0, "facilityAddress", "text"),
  row("Amount of deposit_Assisted living", DEPOSIT_PATH, 0, "amount", "money"),
  row("Date deposit given to facility_Assisted living", DEPOSIT_PATH, 0, "depositedOn", "date"),
]

// ---------------------------------------------------------------------------------------------
// Vehicles: a block for "You" and one for "Your spouse"
// ---------------------------------------------------------------------------------------------

const VEHICLE_FIELDS: Record<(typeof OWNERS)[number][0], { type: string; model: string; value: string; owed: string }> = {
  you: { type: "You Type of vehicle", model: "Yearmakemodel", value: "Fair-market value", owed: "Amount owed" },
  spouse: { type: "Your spouse Type of vehicle_2", model: "Yearmakemodel_2", value: "Fair-market value_2", owed: "Amount owed_2" },
}

const vehicleEntries: FieldEntry[] = [
  gate("Vehicles", "vehicles"),
  ...OWNERS.flatMap(([owner]) => {
    const f = VEHICLE_FIELDS[owner]
    const id = (key: string) => `assets.vehicles.${owner}.${key}`
    return [
      derived(f.type, id("vehicleType"), "text"),
      derived(f.model, id("yearMakeModel"), "text"),
      derived(f.value, id("fairMarketValue"), "money"),
      derived(f.owed, id("amountOwed"), "money"),
    ]
  }),
]

// ---------------------------------------------------------------------------------------------
// Prepaid burial plans: five lines per owner, each "Yes (Amount $ )" / "No"
// ---------------------------------------------------------------------------------------------

/** Per owner and arrangement: the Yes / No group and the amount field (there is no amount for a plot). */
const BURIAL_FIELDS: Record<string, { checkbox: string; amount?: string }> = {
  "you.contract": { checkbox: "Burial contract for you?", amount: "Amount_PBP_1" },
  "you.trust": { checkbox: "Burial trust for you?", amount: "Amount_PBP_2" },
  "you.lifeInsurance": { checkbox: "Life insurance for burial for you?", amount: "Amount_PBP_3" },
  "you.burialOnlyAccount": { checkbox: "Burial only account for you?", amount: "Amount_PBP_4" },
  "you.plot": { checkbox: "Burial plot for you?" },
  "spouse.contract": { checkbox: "Burial contract for your spouse?", amount: "Amount_PBP_5" },
  "spouse.trust": { checkbox: "Burial trust for your spouse?", amount: "Amount_PBP_6" },
  "spouse.lifeInsurance": { checkbox: "Life insurance for burial for your spouse?", amount: "Amount_PBP_7" },
  "spouse.burialOnlyAccount": { checkbox: "Burial only account for your spouse?", amount: "Amount_PBP_8" },
  "spouse.plot": { checkbox: "Prepaid burial plot for your spouse?" },
}

const burialEntries: FieldEntry[] = [
  gate("Prepaid Burial Plans", "burial"),
  ...OWNERS.flatMap(([owner]) =>
    BURIAL_KINDS.flatMap(([kind]) => {
      const slot = `${owner}.${kind}`
      const f = BURIAL_FIELDS[slot]
      return [
        derived(f.checkbox, `assets.burial.${slot}.checked`, YES_NO_NAMED),
        ...(f.amount ? [derived(f.amount, `assets.burial.${slot}.amount`, "money")] : []),
      ]
    }),
  ),
]

// ---------------------------------------------------------------------------------------------
// Trusts: questions 10 and 11 (one wizard gate) and a table of 2 trusts
// ---------------------------------------------------------------------------------------------

const TRUST_PATH = "assets.trusts"
const TRUST_FIELDS = [
  {
    name: "Trust name",
    revocable: "Revocable trust?",
    principal: "Current trust principal",
    admission: "Trust principal on admission date* $",
    trustees: "Trustees",
    grantors: "GrantorsDonors",
    beneficiaries: "Beneficiaries",
  },
  {
    name: "Trust name_2",
    revocable: "Revocable trust?_2",
    principal: "Current trust principal_2",
    admission: "Trust principal on admission date* $_2",
    trustees: "Trustees_2",
    grantors: "GrantorsDonors_2",
    beneficiaries: "Beneficiaries_2",
  },
]

const trustEntries: FieldEntry[] = [
  derived("10. Are you or your spouse the grantor/donor, trustee, or beneficiary of any trusts?", "assets.trusts.gate", YES_NO_NAMED),
  derived("11. Have you, your spousecontributed income owned by you or your spouse to a trust?", "assets.trusts.gate", YES_NO_NAMED),
  ...TRUST_FIELDS.slice(0, TRUST_LINES).flatMap((f, line) => [
    row(f.name, TRUST_PATH, line, "name", "text"),
    derived(f.revocable, `assets.trusts.${line}.revocable`, YES_NO_NAMED),
    row(f.principal, TRUST_PATH, line, "currentPrincipal", "money"),
    row(f.admission, TRUST_PATH, line, "principalOnAdmissionDate", "money"),
    row(f.trustees, TRUST_PATH, line, "trustees", "text"),
    row(f.grantors, TRUST_PATH, line, "grantors", "text"),
    row(f.beneficiaries, TRUST_PATH, line, "beneficiaries", "text"),
  ]),
]

/** Step 5 on form pages 12-15 (PDF indexes 13-16). */
export const ASSETS_ENTRIES: FieldEntry[] = [
  ...bankEntries,
  ...realEstateEntries,
  ...lifeEntries,
  ...securitiesEntries,
  ...annuityEntries,
  ...vehicleEntries,
  ...burialEntries,
  ...trustEntries,
]
