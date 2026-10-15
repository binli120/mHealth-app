/**
 * @author: Bin Lee
 * @email: blee@comura.ai
 */

import type {
  AnnuityRow,
  AssetCategory,
  BankAccountRow,
  BurialRow,
  FacilityDepositRow,
  LifeInsuranceRow,
  RealEstateRow,
  SecuritiesRow,
  TrustRow,
  VehicleRow,
} from "../types"
import { checkbox, date, money, opts, repeater, select, text, yesNo } from "./builders"
import type { Saca2Question, Saca2QuestionContext, Saca2Section, Saca2StepContent } from "./types"

const gateIs = (category: AssetCategory) => (ctx: Saca2QuestionContext) =>
  ctx.answers.assets.gates[category] === "yes"

const anyBankGate = (ctx: Saca2QuestionContext) =>
  (["bankAccounts", "retirementAccounts", "closedAccounts"] as const).some(
    (category) => ctx.answers.assets.gates[category] === "yes",
  )

/** Facility applicants must also report values on the date of admission (60-month look-back). */
const isFacilityApplicant = (ctx: Saca2QuestionContext) =>
  ctx.answers.intake.programs.longTermCare || ctx.answers.supplements.a.needsNursingFacility === "yes"

const gate = (category: AssetCategory, label: string): Saca2Question =>
  yesNo(`assets.gates.${category}`, label, { required: true })

const OWNER_OPTIONS = opts([
  ["you", "You"],
  ["spouse", "Your spouse"],
])

const PROPERTY_TYPES = opts([
  ["oneFamily", "One-family"],
  ["twoFamily", "Two-family"],
  ["threeFamily", "Three-family"],
  ["other", "Other"],
])

const ACCOUNT_TYPES = opts([
  ["checking", "Checking"],
  ["savings", "Savings"],
  ["certificateOfDeposit", "Certificate of deposit"],
  ["creditUnion", "Credit union"],
  ["now", "NOW account"],
  ["moneyMarket", "Money market"],
  ["pna", "Personal needs allowance (PNA) account"],
  ["other", "Other"],
])

function realEstateRepeater(path: string, label: string, itemTitle: string, addLabel: string, category: AssetCategory): Saca2Question {
  return repeater(
    path,
    label,
    {
      questions: [
        text("address", "Address", { required: true }),
        select("propertyType", "Type of property", PROPERTY_TYPES, { required: true }),
        money("currentValue", "Current value ($)", { required: true }),
      ],
      emptyItem: () => ({ address: "", propertyType: "", currentValue: null }) satisfies RealEstateRow,
      addLabel,
      itemTitle,
      maxItems: 6,
    },
    { required: true, visibleWhen: gateIs(category), help: "Send a copy of the deed, the current tax bill, and proof of the amount owed." },
  )
}

const BANK_SECTION: Saca2Section = {
  id: "bank",
  title: "Bank accounts",
  description: "If you are applying for long-term care, also tell us about every account you or your spouse owned in the past 60 months.",
  questions: [
    gate("bankAccounts", "Do you or your spouse have any bank accounts or certificates of deposit, including checking, savings, credit union, NOW, money-market, and personal needs allowance (PNA) accounts?"),
    gate("retirementAccounts", "Do you or your spouse have any retirement accounts, including individual retirement accounts (IRAs), Keogh, or pension funds?"),
    gate("closedAccounts", "Have you or your spouse or a joint owner closed any accounts in the past 60 months, including any accounts you owned jointly with anyone else?"),
    repeater(
      "assets.bankAccounts",
      "Accounts",
      {
        questions: [
          text("ownerName", "Name on account", { required: true }),
          select("accountType", "Account type", ACCOUNT_TYPES, { required: true }),
          text("institution", "Name of bank or institution", { required: true }),
          text("accountNumber", "Account number"),
          money("currentBalance", "Current balance ($)", { required: true }),
          money("balanceOnAdmissionDate", "Balance on the date of admission to the facility ($)", { visibleWhen: isFacilityApplicant }),
          checkbox("open", "This account is open"),
          date("closedOn", "Date account closed", { required: true, visibleWhen: (ctx) => ctx.item?.open === false }),
          money("balanceWhenClosed", "Amount on the date the account was closed ($)", {
            required: true,
            visibleWhen: (ctx) => ctx.item?.open === false,
          }),
        ],
        emptyItem: () =>
          ({
            ownerName: "",
            accountType: "",
            institution: "",
            accountNumber: "",
            currentBalance: null,
            balanceOnAdmissionDate: null,
            open: true,
            closedOn: null,
            balanceWhenClosed: null,
          }) satisfies BankAccountRow,
        addLabel: "Add an account",
        itemTitle: "Account",
        maxItems: 10,
      },
      { required: true, visibleWhen: anyBankGate, help: "Send a copy of your updated passbooks or current account statements (the past 60 months for nursing-facility coverage)." },
    ),
  ],
}

const REAL_ESTATE_SECTION: Saca2Section = {
  id: "realEstate",
  title: "Real estate",
  questions: [
    gate("primaryResidence", "Do you or your spouse own or have a legal interest in your primary residence?"),
    realEstateRepeater("assets.primaryResidence", "Primary residence", "Primary residence", "Add a property", "primaryResidence"),
    gate("otherRealEstate", "Do you or your spouse own or have a legal interest in any real estate other than your primary residence?"),
    realEstateRepeater("assets.otherRealEstate", "Other real estate", "Property", "Add a property", "otherRealEstate"),
  ],
}

const LIFE_INSURANCE_SECTION: Saca2Section = {
  id: "lifeInsurance",
  title: "Life insurance",
  questions: [
    gate("lifeInsurance", "Do you or your spouse own any life insurance?"),
    repeater(
      "assets.lifeInsurance",
      "Policies",
      {
        questions: [
          text("owners", "Name(s) of owner(s)"),
          text("company", "Insurance company", { required: true }),
          text("policyNumber", "Policy number", { required: true }),
          money("faceValue", "Face value ($)", { required: true }),
          text("insuranceType", "Insurance type", { required: true }),
          money("cashSurrenderValue", "Current cash-surrender value ($)"),
        ],
        emptyItem: () =>
          ({ owners: "", company: "", policyNumber: "", faceValue: null, insuranceType: "", cashSurrenderValue: null }) satisfies LifeInsuranceRow,
        addLabel: "Add a policy",
        itemTitle: "Policy",
        maxItems: 8,
      },
      {
        required: true,
        visibleWhen: gateIs("lifeInsurance"),
        help: "Send a copy of the first page of each policy. If total face value is more than $1,500 per person, also send a letter from the insurer showing the current cash-surrender value (not needed for term policies).",
      },
    ),
  ],
}

const SECURITIES_SECTION: Saca2Section = {
  id: "securities",
  title: "Securities and brokerage accounts",
  questions: [
    gate("securities", "Do you or your spouse own any stocks, bonds, savings bonds, mutual funds, securities, assets held in safe-deposit boxes, cash not in the bank, options, or future contracts?"),
    repeater(
      "assets.securities",
      "Holdings",
      {
        questions: [
          select(
            "kind",
            "Type",
            opts([
              ["cash", "Cash"],
              ["stocks", "Stocks"],
              ["bonds", "Bonds"],
              ["savingsBonds", "Savings bonds"],
              ["mutualFunds", "Mutual funds"],
              ["options", "Options"],
              ["futures", "Future contracts"],
              ["other", "Other"],
            ]),
            { required: true },
          ),
          text("owners", "Owner name(s)"),
          text("company", "Company name"),
          text("accountNumber", "Account number"),
          money("currentValue", "Current value ($)", { required: true }),
          money("valueOnAdmissionDate", "Value on the date of admission to the facility ($)", { visibleWhen: isFacilityApplicant }),
          checkbox("joint", "This is a joint asset"),
        ],
        emptyItem: () =>
          ({ kind: "cash", owners: "", company: "", accountNumber: "", currentValue: null, valueOnAdmissionDate: null, joint: false }) satisfies SecuritiesRow,
        addLabel: "Add a holding",
        itemTitle: "Holding",
        maxItems: 10,
      },
      { required: true, visibleWhen: gateIs("securities"), help: "Send proof of the current value (except cash)." },
    ),
  ],
}

const ANNUITIES_SECTION: Saca2Section = {
  id: "annuities",
  title: "Annuities",
  questions: [
    gate("annuities", "Did you or your spouse or someone on your or your spouse's behalf purchase or in any way change an annuity?"),
    repeater(
      "assets.annuities",
      "Annuities",
      {
        questions: [
          text("owners", "Name(s) of owner(s)"),
          text("institution", "Name of the institution issuing the annuity", { required: true }),
          text("contractNumber", "Contract number", { required: true }),
          date("purchasedOn", "Date purchased", { required: true }),
        ],
        emptyItem: () => ({ owners: "", institution: "", contractNumber: "", purchasedOn: null }) satisfies AnnuityRow,
        addLabel: "Add an annuity",
        itemTitle: "Annuity",
        maxItems: 6,
      },
      {
        required: true,
        visibleWhen: gateIs("annuities"),
        help: "To be eligible you may be required to name the Commonwealth as a remainder beneficiary. Send a copy of the contract and proof of its full value less any penalties and fees.",
      },
    ),
  ],
}

const DEPOSITS_SECTION: Saca2Section = {
  id: "deposits",
  title: "Assisted living and similar deposits",
  questions: [
    gate("assistedLivingDeposit", "Have you, your spouse, or someone acting on your behalf given a deposit to any health-care or residential facility, like an assisted-living facility, a continuing-care retirement community, or a life-care community?"),
    repeater(
      "assets.assistedLivingDeposits",
      "Deposits",
      {
        questions: [
          text("facilityName", "Name of facility", { required: true }),
          text("facilityAddress", "Address of facility"),
          money("amount", "Amount of deposit ($)", { required: true }),
          date("depositedOn", "Date the deposit was given"),
        ],
        emptyItem: () => ({ facilityName: "", facilityAddress: "", amount: null, depositedOn: null }) satisfies FacilityDepositRow,
        addLabel: "Add a deposit",
        itemTitle: "Deposit",
        maxItems: 4,
      },
      { required: true, visibleWhen: gateIs("assistedLivingDeposit"), help: "Send a copy of the contract you signed with the facility and any documents about this deposit." },
    ),
  ],
}

const VEHICLES_SECTION: Saca2Section = {
  id: "vehicles",
  title: "Vehicles and mobile homes",
  questions: [
    gate("vehicles", "Do you or your spouse own any vehicles, like cars, vans, trucks, recreational vehicles, mobile homes, or boats?"),
    repeater(
      "assets.vehicles",
      "Vehicles",
      {
        questions: [
          select("owner", "Owner", OWNER_OPTIONS, { required: true }),
          text("vehicleType", "Type of vehicle", { required: true }),
          text("yearMakeModel", "Year, make, and model (or mobile home address)"),
          money("fairMarketValue", "Fair-market value ($)", { required: true }),
          money("amountOwed", "Amount owed ($)"),
        ],
        emptyItem: () => ({ owner: "you", vehicleType: "", yearMakeModel: "", fairMarketValue: null, amountOwed: null }) satisfies VehicleRow,
        addLabel: "Add a vehicle",
        itemTitle: "Vehicle",
        maxItems: 8,
      },
      {
        required: true,
        visibleWhen: gateIs("vehicles"),
        help: "Send a copy of the registration for each vehicle and proof of the outstanding loan balance (for mobile homes, the bill of sale).",
      },
    ),
  ],
}

const BURIAL_SECTION: Saca2Section = {
  id: "burial",
  title: "Prepaid burial plans",
  questions: [
    gate("burial", "Do you or your spouse have any prepaid burial contracts or trusts, life insurance set up for funeral and burial expenses, or bank accounts set aside for funeral expenses?"),
    repeater(
      "assets.burial",
      "Burial arrangements",
      {
        questions: [
          select("owner", "Owner", OWNER_OPTIONS, { required: true }),
          select(
            "kind",
            "Type",
            opts([
              ["contract", "Burial contract"],
              ["trust", "Burial trust"],
              ["lifeInsurance", "Life insurance for burial"],
              ["burialOnlyAccount", "Burial-only account"],
              ["plot", "Burial plot"],
            ]),
            { required: true },
          ),
          money("amount", "Amount ($)"),
        ],
        emptyItem: () => ({ owner: "you", kind: "contract", amount: null }) satisfies BurialRow,
        addLabel: "Add a burial arrangement",
        itemTitle: "Burial arrangement",
        maxItems: 8,
      },
      { required: true, visibleWhen: gateIs("burial"), help: "Send a copy of the trust contract, trust instrument, insurance policy, or burial-only account." },
    ),
  ],
}

const TRUSTS_SECTION: Saca2Section = {
  id: "trusts",
  title: "Trusts",
  questions: [
    gate("trusts", "Are you or your spouse the grantor/donor, trustee, or beneficiary of any trusts, or have you, your spouse, or someone else on your behalf (including a court or administrative body) contributed income or assets owned by you or your spouse to a trust?"),
    repeater(
      "assets.trusts",
      "Trusts",
      {
        questions: [
          text("name", "Trust name", { required: true }),
          checkbox("revocable", "This trust is revocable"),
          money("currentPrincipal", "Current trust principal ($)", { required: true }),
          money("principalOnAdmissionDate", "Trust principal on the date of admission to the facility ($)", { visibleWhen: isFacilityApplicant }),
          text("trustees", "Trustee(s)"),
          text("grantors", "Grantor(s)/donor(s)"),
          text("beneficiaries", "Beneficiaries"),
        ],
        emptyItem: () =>
          ({
            name: "",
            revocable: false,
            currentPrincipal: null,
            principalOnAdmissionDate: null,
            trustees: "",
            grantors: "",
            beneficiaries: "",
          }) satisfies TrustRow,
        addLabel: "Add a trust",
        itemTitle: "Trust",
        maxItems: 4,
      },
      {
        required: true,
        visibleWhen: gateIs("trusts"),
        help: "Send a copy of the trust documents, any amendments, documents showing financial activity, and the schedule of beneficiaries.",
      },
    ),
  ],
}

export const ASSETS_STEP_CONTENT: Saca2StepContent = {
  scope: "root",
  sections: [
    BANK_SECTION,
    REAL_ESTATE_SECTION,
    LIFE_INSURANCE_SECTION,
    SECURITIES_SECTION,
    ANNUITIES_SECTION,
    DEPOSITS_SECTION,
    VEHICLES_SECTION,
    BURIAL_SECTION,
    TRUSTS_SECTION,
  ],
}
