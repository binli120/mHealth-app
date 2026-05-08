# mHealth Database ER Diagram

Generated from Supabase migrations. Last updated: 2026-05-08.

```mermaid
erDiagram

    %% ── Core Identity & Auth ──────────────────────────────────────────────────

    organizations {
        uuid id PK
        text name
        timestamptz created_at
    }

    users {
        uuid id PK
        uuid organization_id FK
        uuid company_id FK
        text email
        text password_hash
        boolean is_active
        timestamptz last_active_at
        timestamptz created_at
    }

    roles {
        serial id PK
        text name UK
        text description
        text color
        boolean is_system
    }

    user_roles {
        uuid user_id PK_FK
        int role_id PK_FK
    }

    role_permissions {
        uuid id PK
        text role_name FK
        text permission
    }

    companies {
        uuid id PK
        text name
        text npi
        text email_domain
        text status
        uuid approved_by FK
        timestamptz created_at
    }

    invitations {
        uuid id PK
        text email
        uuid company_id FK
        text role
        text token UK
        uuid invited_by FK
        timestamptz accepted_at
        timestamptz expires_at
    }

    admin_passkey_credentials {
        uuid id PK
        uuid user_id FK
        text credential_id UK
        text public_key
        bigint counter
        timestamptz last_used_at
    }

    revoked_sessions {
        uuid id PK
        uuid user_id FK
        text session_id
        text token_hash
        text reason
        uuid revoked_by FK
        timestamptz revoked_at
        timestamptz expires_at
    }

    login_events {
        uuid id PK
        uuid user_id FK
        text event_type
        inet ip_address
        text user_agent
        timestamptz created_at
    }

    admin_settings {
        text key PK
        text value
        timestamptz updated_at
    }

    %% ── Applicant & Application Domain ───────────────────────────────────────

    applicants {
        uuid id PK
        uuid user_id FK
        text first_name
        text last_name
        date dob
        text ssn_encrypted
        text phone
        text city
        text state
        text zip
        text identity_status
        smallint identity_score
        text dl_issuing_state
        timestamptz identity_verified_at
        timestamptz created_at
    }

    applications {
        uuid id PK
        uuid organization_id FK
        uuid applicant_id FK
        text status
        int household_size
        numeric total_monthly_income
        numeric confidence_score
        timestamptz submitted_at
        timestamptz decided_at
        timestamptz created_at
    }

    household_members {
        uuid id PK
        uuid application_id FK
        text first_name
        text last_name
        date dob
        text relationship
        boolean pregnant
        boolean disabled
        boolean over_65
    }

    incomes {
        uuid id PK
        uuid application_id FK
        uuid member_id FK
        text income_type
        text employer_name
        numeric monthly_amount
        boolean verified
    }

    assets {
        uuid id PK
        uuid application_id FK
        text asset_type
        numeric value
    }

    user_profiles {
        uuid id PK
        uuid applicant_id FK_UK
        jsonb profile_data
        jsonb bank_data
        text avatar_url
        timestamptz updated_at
    }

    family_profiles {
        uuid id PK
        uuid applicant_id FK_UK
        jsonb profile_data
        timestamptz updated_at
    }

    benefit_stack_results {
        uuid id PK
        uuid family_profile_id FK
        jsonb stack_data
        timestamptz generated_at
    }

    %% ── Documents ────────────────────────────────────────────────────────────

    documents {
        uuid id PK
        uuid application_id FK
        uuid uploaded_by FK
        text document_type
        text file_url
        text file_name
        text file_path
        bigint file_size_bytes
        text document_status
        text required_document_label
        text validation_status
        jsonb validation_summary
        jsonb validation_certificate
        text thumbnail_path
        text pdf_path
        timestamptz analyzed_at
        timestamptz uploaded_at
    }

    document_pages {
        uuid id PK
        uuid document_id FK
        int page_number
        text ocr_text
    }

    document_extractions {
        uuid id PK
        uuid document_id FK
        text model_name
        jsonb raw_output
        jsonb structured_output
        numeric confidence_score
        timestamptz extracted_at
    }

    mobile_upload_sessions {
        uuid id PK
        text token UK
        uuid user_id FK
        uuid application_id
        text document_type
        text required_document_label
        text status
        uuid document_id
        timestamptz expires_at
        timestamptz completed_at
    }

    %% ── Identity Verification ────────────────────────────────────────────────

    identity_verification_attempts {
        uuid id PK
        uuid applicant_id FK
        uuid user_id FK
        text status
        smallint score
        jsonb breakdown
        text dl_number_hash
        date dl_expiration_date
        text dl_issuing_state
        boolean is_expired
        text ip_address
        timestamptz attempted_at
    }

    mobile_verify_sessions {
        uuid id PK
        text token UK
        uuid user_id FK
        uuid applicant_id FK
        text status
        text verify_status
        smallint verify_score
        jsonb verify_breakdown
        jsonb extracted_data
        timestamptz expires_at
        timestamptz completed_at
    }

    %% ── Income Verification ──────────────────────────────────────────────────

    income_verification_cases {
        uuid application_id PK_FK
        text status
        int required_source_count
        int verified_source_count
        text decision_reason
        boolean income_verified
        timestamptz updated_at
    }

    income_evidence_requirements {
        uuid id PK
        uuid application_id FK
        uuid member_id
        text member_name
        text income_source_type
        text[] accepted_doc_types
        boolean is_required
        text verification_status
        timestamptz updated_at
    }

    income_documents {
        uuid id PK
        uuid application_id FK
        uuid member_id
        text doc_type_claimed
        text storage_key
        text mime_type
        text file_name
        bigint file_size_bytes
        text extraction_status
        uuid job_id
        uuid uploaded_by FK
        timestamptz uploaded_at
    }

    income_document_extractions {
        uuid id PK_FK
        text doc_type
        text issuer
        text person_name
        text employer_name
        date date_range_start
        date date_range_end
        numeric gross_amount
        numeric net_amount
        text frequency
        text income_source_type
        numeric confidence
        boolean needs_manual_review
        text[] reasons
        text model_version
        jsonb raw_model_output
        timestamptz extracted_at
    }

    income_verification_decisions {
        uuid id PK
        uuid application_id FK
        uuid member_id
        text source_type
        text status
        numeric matched_amount
        text matched_frequency
        uuid reviewer_id FK
        text reason_code
        timestamptz decided_at
    }

    income_rfi_events {
        uuid id PK
        uuid application_id FK
        text reason_code
        text[] requested_docs
        uuid created_by FK
        timestamptz sent_at
        timestamptz resolved_at
    }

    %% ── Application Review ───────────────────────────────────────────────────

    validation_results {
        uuid id PK
        uuid application_id FK
        text rule_name
        text severity
        text message
        boolean resolved
        timestamptz created_at
    }

    eligibility_screenings {
        uuid id PK
        uuid application_id FK
        text estimated_program
        numeric fpl_percentage
        text screening_result
        timestamptz created_at
    }

    review_actions {
        uuid id PK
        uuid application_id FK
        uuid reviewer_id FK
        text action_type
        text notes
        timestamptz created_at
    }

    rfis {
        uuid id PK
        uuid application_id FK
        uuid requested_by FK
        text message
        date due_date
        boolean resolved
        timestamptz created_at
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        uuid application_id FK
        text action
        jsonb old_data
        jsonb new_data
        text ip_address
        timestamptz created_at
    }

    %% ── Social Worker & Collaboration ────────────────────────────────────────

    social_worker_profiles {
        uuid id PK
        uuid user_id FK_UK
        uuid company_id FK
        text first_name
        text last_name
        text phone
        text license_number
        text job_title
        text status
        text rejection_note
        uuid approved_by FK
        timestamptz approved_at
    }

    patient_social_worker_access {
        uuid id PK
        uuid patient_user_id FK
        uuid social_worker_user_id FK
        boolean is_active
        timestamptz granted_at
        timestamptz revoked_at
    }

    collaborative_sessions {
        uuid id PK
        uuid sw_user_id FK
        uuid patient_user_id FK
        text status
        timestamptz scheduled_at
        timestamptz started_at
        timestamptz ended_at
        uuid ended_by FK
        text invite_message
    }

    session_messages {
        uuid id PK
        uuid session_id FK
        uuid sender_id FK
        text type
        text content
        text storage_path
        int duration_sec
        timestamptz created_at
    }

    sw_engagement_requests {
        uuid id PK
        uuid patient_user_id FK
        uuid sw_user_id FK
        text status
        text patient_message
        text rejection_note
        timestamptz updated_at
    }

    sw_direct_messages {
        uuid id PK
        uuid sw_user_id FK
        uuid patient_user_id FK
        uuid sender_id FK
        text message_type
        text content
        text storage_path
        int duration_sec
        timestamptz read_at
        timestamptz created_at
    }

    %% ── Notifications ────────────────────────────────────────────────────────

    notifications {
        uuid id PK
        uuid user_id FK
        text type
        text title
        text body
        jsonb metadata
        timestamptz read_at
        timestamptz email_sent_at
        timestamptz created_at
    }

    %% ── RAG / Policy Store ───────────────────────────────────────────────────

    policy_documents {
        uuid id PK
        text title
        text source_url UK
        text doc_type
        text language
        int chunk_count
        timestamptz ingested_at
    }

    policy_chunks {
        uuid id PK
        uuid document_id FK
        int chunk_index
        text content
        vector_768 embedding
        timestamptz created_at
    }

    %% ── Growth ───────────────────────────────────────────────────────────────

    growth_referrals {
        uuid id PK
        text referral_code
        text landing_path
        text referrer
        jsonb campaign
        text user_agent
        text ip_hash
        timestamptz created_at
    }

    mailing_list_signups {
        uuid id PK
        text email UK
        text source
        text referral_code
        jsonb campaign
        timestamptz unsubscribed_at
        timestamptz created_at
    }

    %% ── Relationships ────────────────────────────────────────────────────────

    organizations ||--o{ users : "employs"
    organizations ||--o{ applications : "manages"
    companies ||--o{ users : "company_id"
    companies ||--o{ social_worker_profiles : "hosts"
    companies ||--o{ invitations : "invites via"
    companies }o--o| users : "approved_by"

    users ||--o{ user_roles : "assigned"
    roles ||--o{ user_roles : "assigned via"
    roles ||--o{ role_permissions : "grants"

    users ||--o{ applicants : "owns"
    users ||--o{ admin_passkey_credentials : "registers"
    users ||--o{ login_events : "triggers"
    users ||--o{ revoked_sessions : "revoked"
    users ||--o{ invitations : "invited_by"
    users ||--o{ audit_logs : "generates"
    users ||--o{ review_actions : "reviewer"
    users ||--o{ rfis : "requested_by"
    users ||--o{ social_worker_profiles : "has"
    users ||--o{ notifications : "receives"
    users ||--o{ income_documents : "uploaded_by"
    users ||--o{ income_verification_decisions : "reviewer_id"
    users ||--o{ income_rfi_events : "created_by"

    applicants ||--o{ applications : "submits"
    applicants ||--|| user_profiles : "has"
    applicants ||--|| family_profiles : "has"
    applicants ||--o{ identity_verification_attempts : "undergoes"
    applicants ||--o{ mobile_verify_sessions : "uses"

    applications ||--o{ household_members : "lists"
    applications ||--o{ incomes : "reports"
    applications ||--o{ assets : "declares"
    applications ||--o{ documents : "attaches"
    applications ||--o{ validation_results : "receives"
    applications ||--o{ eligibility_screenings : "receives"
    applications ||--o{ review_actions : "has"
    applications ||--o{ rfis : "has"
    applications ||--o{ audit_logs : "tracked by"
    applications ||--|| income_verification_cases : "has"
    applications ||--o{ income_evidence_requirements : "requires"
    applications ||--o{ income_documents : "uploads"
    applications ||--o{ income_verification_decisions : "has"
    applications ||--o{ income_rfi_events : "sends"

    household_members ||--o{ incomes : "earns"

    family_profiles ||--o{ benefit_stack_results : "generates"

    documents ||--o{ document_pages : "has"
    documents ||--o{ document_extractions : "produces"

    income_documents ||--|| income_document_extractions : "produces"

    social_worker_profiles }o--o| users : "approved_by"
    patient_social_worker_access }o--|| users : "patient"
    patient_social_worker_access }o--|| users : "social_worker"

    collaborative_sessions }o--|| users : "sw_user"
    collaborative_sessions }o--|| users : "patient_user"
    collaborative_sessions ||--o{ session_messages : "contains"

    sw_engagement_requests }o--|| users : "patient"
    sw_engagement_requests }o--|| users : "sw"

    sw_direct_messages }o--|| users : "sw"
    sw_direct_messages }o--|| users : "patient"
    sw_direct_messages }o--|| users : "sender"

    policy_documents ||--o{ policy_chunks : "chunked into"
```
