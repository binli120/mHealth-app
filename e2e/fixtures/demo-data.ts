/**
 * @author Bin Lee
 * @email binlee120@gmail.com
 */

/**
 * Demo data used across all E2E tests and investor demos.
 * The demo user is created once in global.setup.ts via the dev-register API.
 */

export const DEMO_USER = {
  firstName: "Maria",
  lastName: "Santos",
  email: "demo.e2e@masshealth-test.local",
  phone: "(617)555-0199",
  password: "Demo@2026!",
}

export const REVIEWER_USER = {
  firstName: "Staff",
  lastName: "Reviewer",
  email: "reviewer.e2e@masshealth-test.local",
  phone: "(617)555-0188",
  password: "Staff@2026!",
}

export const ADMIN_USER = {
  firstName: "Avery",
  lastName: "Admin",
  email: "admin.e2e@masshealth-test.local",
  phone: "(617)555-0187",
  password: "Admin@2026!",
  role: "admin",
}

export const SOCIAL_WORKER_USER = {
  firstName: "Sofia",
  lastName: "Rivera",
  email: "social.worker.e2e@masshealth-test.local",
  phone: "(617)555-0186",
  password: "Social@2026!",
  role: "social_worker",
  companyName: "Demo Community Health",
  companyNpi: "1234567890",
  companyAddress: "101 Main Street",
  companyCity: "Boston",
  companyState: "MA",
  companyZip: "02108",
  companyEmailDomain: "demo-health.local",
  licenseNumber: "SW-DEMO-2026",
  jobTitle: "Community Health Social Worker",
}

/** Household used for the Benefit Stack wizard */
export const DEMO_HOUSEHOLD = {
  household_size: 3,
  annual_income: 42000,
  monthly_income: 3500,
  state: "MA",
  has_children: true,
  children_ages: [4, 7],
  citizen: true,
  has_disability: false,
  has_medicare: false,
  has_employer_insurance: false,
  pregnant: false,
}

/** Prescreener quick-reply answers (all "happy path" = MA resident, eligible) */
export const PRESCREENER_ANSWERS = {
  state: "Massachusetts",
  age: "35",
  householdSize: "3",
  monthlyIncome: "3000",
  citizenship: "Yes, U.S. citizen",
  disability: "No",
  medicare: "No",
  employerInsurance: "No",
}

/** Appeal form inputs */
export const DEMO_APPEAL = {
  denial_reason: "income",
  member_name: "Maria Santos",
  denial_date: "2026-02-15",
  context: "My income was incorrectly calculated. My employer submitted incorrect W-2 information. I have documentation showing my actual income was $38,000, below the eligibility threshold.",
}

/** Application form data */
export const DEMO_APPLICATION = {
  applicant_name: "Maria Santos",
  dob: "1991-03-15",
  ssn_last4: "1234",
  address: "123 Main St",
  city: "Boston",
  state: "MA",
  zip: "02101",
  household_size: 3,
  annual_income: 42000,
  citizenship: "us_citizen",
  program_type: "masshealth",
}
