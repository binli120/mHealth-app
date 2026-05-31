/**
 * @author: Bin Lee
 * @email: blee@healthcompass.cloud
 */

import { describe, expect, it } from "vitest"

import { mapWizardToAnalysisWorkflowData } from "@/components/application/aca3/wizard-mappings"
import { createInitialData } from "@/components/application/aca3/wizard-reducer"

describe("wizard mappings", () => {
  it("maps internal wizard data to the ACA-3 analysis workflow contract", () => {
    const data = createInitialData()
    data.attestation = true
    data.preApp.snap_opt_in = true
    data.contact.p1_name = "Jane Doe"
    data.contact.p1_dob = "01/15/1985"
    data.contact.p1_home_street = "123 Main St"
    data.contact.p1_num_people = "1"
    data.persons[0].ssn.has_ssn = "Yes"
    data.persons[0].ssn.ssn = "123-45-6789"
    data.persons[0].coverage.applying_for_coverage = "Yes"
    data.persons[0].coverage.us_citizen = "Yes"
    data.persons[0].income.employment_jobs = [
      {
        employer_name_address: "Acme Health",
        wages_amount: "1200",
        wages_frequency: "Monthly",
      },
    ]

    const workflow = mapWizardToAnalysisWorkflowData(data)

    expect(workflow).toMatchObject({
      form_id: "ACA-3",
      form_version: "03/25",
      attestation: true,
      pre_application: {
        snap_opt_in: true,
      },
      step1_contact: {
        p1_name: "Jane Doe",
        p1_dob: "01/15/1985",
        p1_home_street: "123 Main St",
      },
      persons: [
        {
          personNumber: 1,
          ss_identity: {
            name: "Jane Doe",
            dob: "01/15/1985",
          },
          ss_ssn: {
            has_ssn: "Yes",
            ssn: "123-45-6789",
          },
          ss_coverage: {
            applying_for_coverage: "Yes",
            us_citizen: "Yes",
          },
          ss_income: {
            employment_jobs: [
              {
                employer_name_address: "Acme Health",
                wages_amount: "1200",
                wages_frequency: "Monthly",
              },
            ],
          },
        },
      ],
    })
    expect(workflow.persons[0]).not.toHaveProperty("identity")
    expect(workflow).not.toHaveProperty("contact")
  })
})
