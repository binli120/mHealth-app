# mHealth Database ER Diagram

Generated from the live Postgres database. Last updated: 2026-06-06.

```mermaid
erDiagram

    admin_passkey_credentials {
        uuid id PK
        uuid user_id FK_NN
        text credential_id NN_UK
        text public_key NN
        bigint counter NN
        text transports NN
        text device_type NN
        boolean backed_up NN
        text name
        timestamptz created_at NN
        timestamptz last_used_at
    }

    admin_settings {
        text key PK
        text value NN
        timestamptz updated_at NN
    }

    appeal_analyses {
        uuid id PK
        uuid user_id NN_UK
        text denial_reason_id NN_UK
        text input_hash NN_UK
        text explanation NN
        text appeal_letter NN
        jsonb evidence_checklist NN
        timestamptz created_at NN
    }

    applicants {
        uuid id PK
        uuid user_id FK_UK
        text ssn_encrypted
        timestamptz created_at NN
        text identity_status NN
        timestamptz identity_verified_at
        text identity_provider
        smallint identity_score
        text dl_number_hash
        date dl_expiration_date
        text dl_issuing_state
        text first_name_encrypted
        text last_name_encrypted
        text dob_encrypted
        text phone_encrypted
        text address_line1_encrypted
        text address_line2_encrypted
        text city_encrypted
        text state_encrypted
        text zip_encrypted
    }

    applications {
        uuid id PK
        uuid organization_id FK
        uuid applicant_id FK
        application_status status NN
        int household_size
        numeric total_monthly_income
        numeric confidence_score
        timestamptz submitted_at
        timestamptz decided_at
        timestamptz created_at NN
        text application_type
        jsonb draft_state
        int draft_step
        timestamptz last_saved_at
        timestamptz updated_at NN
        uuid phi_draft_resume_id
        text phi_draft_key_enc
    }

    assets {
        uuid id PK
        uuid application_id FK_NN
        text asset_type
        numeric value
    }

    audit_logs {
        uuid id PK
        uuid user_id FK
        uuid application_id FK
        text action
        jsonb old_data
        jsonb new_data
        text ip_address
        timestamptz created_at NN
    }

    benefit_stack_results {
        uuid id PK
        uuid family_profile_id FK_NN
        jsonb stack_data NN
        timestamptz generated_at NN
    }

    collaborative_sessions {
        uuid id PK
        uuid sw_user_id FK_NN
        uuid patient_user_id FK_NN
        text status NN
        timestamptz scheduled_at
        timestamptz started_at
        timestamptz ended_at
        uuid ended_by FK
        text invite_message
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    companies {
        uuid id PK
        text name NN
        text npi
        text address
        text city
        text state
        text zip
        text phone
        text email_domain
        text status NN
        timestamptz created_at NN
        timestamptz approved_at
        uuid approved_by FK
    }

    document_extractions {
        uuid id PK
        uuid document_id FK_NN
        text model_name
        jsonb raw_output
        jsonb structured_output
        numeric confidence_score
        timestamptz extracted_at NN
    }

    document_pages {
        uuid id PK
        uuid document_id FK_NN_UK
        int page_number UK
        text ocr_text
    }

    documents {
        uuid id PK
        uuid application_id FK_NN
        uuid uploaded_by FK
        text document_type
        text file_url
        text mime_type
        timestamptz uploaded_at NN
        text document_status NN
        text file_name
        text file_path
        bigint file_size_bytes
        text required_document_label
        text thumbnail_path
        text pdf_path
        text analysis_document_type
        text validation_status NN
        text validation_error
        jsonb validation_summary
        jsonb validation_certificate
        timestamptz analyzed_at
    }

    eligibility_screenings {
        uuid id PK
        uuid application_id FK_NN
        text estimated_program
        numeric fpl_percentage
        text screening_result
        timestamptz created_at NN
    }

    family_profiles {
        uuid id PK
        uuid applicant_id FK_NN_UK
        jsonb profile_data NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    feature_flag_env_overrides {
        uuid id PK
        uuid flag_id FK_NN_UK
        text environment NN_UK
        boolean enabled NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    feature_flags {
        uuid id PK
        text key NN_UK
        text label NN
        text description
        boolean enabled NN
        text category NN
        jsonb metadata
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    glossary_terms {
        uuid id PK
        text slug NN_UK
        text term_en NN
        text definition_en NN
        text definition_es
        text definition_zh_cn
        text definition_ht
        text definition_pt_br
        text definition_vi
        text category NN
        text aliases NN
        text related_slugs NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    growth_referrals {
        uuid id PK
        text referral_code NN
        text landing_path NN
        text referrer
        jsonb campaign NN
        text user_agent
        text ip_hash
        timestamptz created_at NN
    }

    household_members {
        uuid id PK
        uuid application_id FK_NN_UK
        text first_name
        text last_name
        date dob
        text relationship
        boolean pregnant NN
        boolean disabled NN
        boolean over_65 NN
    }

    identity_verification_attempts {
        uuid id PK
        uuid applicant_id FK_NN
        uuid user_id FK_NN
        text status NN
        smallint score NN
        jsonb breakdown NN
        text dl_number_hash
        date dl_expiration_date
        text dl_issuing_state
        boolean is_expired NN
        timestamptz attempted_at NN
        text ip_address
        text user_agent
    }

    income_document_extractions {
        uuid id PK
        uuid document_id FK_NN_UK
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
        numeric confidence NN
        boolean needs_manual_review NN
        text reasons NN
        text model_version NN
        jsonb raw_model_output
        timestamptz extracted_at NN
    }

    income_documents {
        uuid id PK
        uuid application_id FK_NN
        uuid member_id NN
        text doc_type_claimed NN
        text storage_key NN
        text mime_type NN
        text file_name
        bigint file_size_bytes
        text extraction_status NN
        uuid job_id NN
        uuid uploaded_by FK
        timestamptz uploaded_at NN
    }

    income_evidence_requirements {
        uuid id PK
        uuid application_id FK_NN_UK
        uuid member_id NN_UK
        text member_name NN
        text income_source_type NN_UK
        text accepted_doc_types NN
        boolean is_required NN
        text verification_status NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    income_rfi_events {
        uuid id PK
        uuid application_id FK_NN
        text reason_code NN
        text requested_docs NN
        timestamptz sent_at NN
        timestamptz resolved_at
        uuid created_by FK
    }

    income_verification_cases {
        uuid application_id PK_FK
        text status NN
        int required_source_count NN
        int verified_source_count NN
        text decision_reason
        boolean income_verified NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    income_verification_decisions {
        uuid id PK
        uuid application_id FK_NN_UK
        uuid member_id NN_UK
        text source_type NN_UK
        text status NN
        numeric matched_amount
        text matched_frequency
        uuid reviewer_id FK
        text reason_code NN
        timestamptz decided_at NN
    }

    incomes {
        uuid id PK
        uuid application_id FK_NN
        uuid member_id FK
        text income_type
        text employer_name
        numeric monthly_amount
        boolean verified NN
    }

    insurance_coverage_records {
        uuid id PK
        uuid user_id FK_NN_UK
        int coverage_year NN_UK
        text plan_name NN_UK
        text program_code
        numeric premium_monthly
        int household_size
        numeric annual_income
        numeric fpl_percent
        text source NN
        uuid application_id FK
        uuid document_id FK
        text notes
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    insurance_explanations {
        uuid id PK
        uuid coverage_record_id FK_NN_UK
        uuid prior_record_id FK
        jsonb change_factors NN
        text explanation_text NN
        text generated_by NN
        timestamptz generated_at NN
    }

    invitations {
        uuid id PK
        text email NN
        uuid company_id FK
        text role NN
        text token NN_UK
        uuid invited_by FK
        timestamptz accepted_at
        timestamptz expires_at NN
        timestamptz created_at NN
    }

    login_events {
        uuid id PK
        uuid user_id FK
        text event_type NN
        inet ip_address
        text user_agent
        timestamptz created_at NN
    }

    mailing_list_signups {
        uuid id PK
        text email NN_UK
        text source NN
        text referral_code
        jsonb campaign NN
        text user_agent
        text ip_hash
        timestamptz created_at NN
        timestamptz updated_at NN
        timestamptz unsubscribed_at
    }

    mh_appeal_source_chunks {
        uuid id PK
        uuid source_document_id FK_NN_UK
        int chunk_index NN_UK
        text content NN
        int token_count
        vector embedding
        jsonb metadata NN
        timestamptz created_at NN
    }

    mh_appeal_source_documents {
        uuid id PK
        text source_key NN_UK
        text title NN
        text source_url NN
        text source_type NN
        text trust_tier NN
        jsonb issue_categories NN
        jsonb program_tags NN
        text summary NN
        text raw_text NN
        jsonb metadata NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    mh_denial_patterns {
        uuid id PK
        text category_code NN_UK
        text label NN
        text description NN
        text denial_category NN
        jsonb notice_keywords NN
        jsonb evidence_needed NN
        jsonb argument_themes NN
        jsonb missing_info_questions NN
        jsonb regulatory_citations NN
        jsonb metadata NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    mobile_upload_sessions {
        uuid id PK
        text token NN_UK
        uuid user_id FK_NN
        uuid application_id NN
        text document_type
        text required_document_label
        text status NN
        uuid document_id
        timestamptz created_at NN
        timestamptz expires_at NN
        timestamptz completed_at
        text allowed_ip
    }

    mobile_verify_sessions {
        uuid id PK
        text token NN_UK
        uuid user_id FK_NN
        uuid applicant_id FK_NN
        text status NN
        text verify_status
        smallint verify_score
        jsonb verify_breakdown
        timestamptz created_at NN
        timestamptz expires_at NN
        timestamptz completed_at
        jsonb extracted_data
    }

    notifications {
        uuid id PK
        uuid user_id FK_NN
        text type NN
        text title NN
        text body NN
        jsonb metadata NN
        timestamptz read_at
        timestamptz email_sent_at
        timestamptz created_at NN
    }

    organizations {
        uuid id PK
        text name NN
        timestamptz created_at NN
    }

    patient_social_worker_access {
        uuid id PK
        uuid patient_user_id FK_NN_UK
        uuid social_worker_user_id FK_NN_UK
        timestamptz granted_at NN
        timestamptz revoked_at
        boolean is_active NN
    }

    policy_chunks {
        uuid id PK
        uuid document_id FK_NN
        int chunk_index NN
        text content NN
        vector embedding
        timestamptz created_at NN
    }

    policy_documents {
        uuid id PK
        text title NN
        text source_url NN_UK
        text doc_type NN
        text language NN
        timestamptz ingested_at NN
        int chunk_count NN
    }

    rate_limit_counters {
        text key PK
        timestamptz window_start PK
        int count NN
    }

    review_actions {
        uuid id PK
        uuid application_id FK
        uuid reviewer_id FK
        text action_type
        text notes
        timestamptz created_at NN
    }

    revoked_sessions {
        uuid id PK
        uuid user_id FK
        text session_id
        text token_hash
        text reason NN
        uuid revoked_by FK
        timestamptz revoked_at NN
        timestamptz expires_at
        jsonb metadata NN
    }

    rfis {
        uuid id PK
        uuid application_id FK
        uuid requested_by FK
        text message
        date due_date
        boolean resolved NN
        timestamptz created_at NN
    }

    role_permissions {
        uuid id PK
        text role_name FK_NN_UK
        text permission NN_UK
    }

    roles {
        int id PK
        text name NN_UK
        text description
        text color NN
        boolean is_system NN
    }

    session_messages {
        uuid id PK
        uuid session_id FK_NN
        uuid sender_id FK_NN
        text type NN
        text content
        text storage_path
        int duration_sec
        timestamptz created_at NN
    }

    social_worker_profiles {
        uuid id PK
        uuid user_id FK_NN_UK
        uuid company_id FK_NN
        text first_name
        text last_name
        text phone
        text bio
        text avatar_url
        text license_number
        text job_title
        text status NN
        text rejection_note
        timestamptz created_at NN
        timestamptz approved_at
        uuid approved_by FK
        boolean accepting_patients NN
    }

    sw_direct_messages {
        uuid id PK
        uuid sw_user_id FK_NN
        uuid patient_user_id FK_NN
        uuid sender_id FK_NN
        text message_type NN
        text content
        text storage_path
        int duration_sec
        timestamptz read_at
        timestamptz created_at NN
        text transcription
        varchar transcription_lang
    }

    sw_engagement_requests {
        uuid id PK
        uuid patient_user_id FK_NN
        uuid sw_user_id FK_NN
        text status NN
        text patient_message
        text rejection_note
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    user_agent_memory {
        uuid id PK
        text user_id NN_UK
        text session_id
        jsonb extracted_facts NN
        jsonb form_progress NN
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    user_passkey_credentials {
        uuid id PK
        uuid user_id FK_NN
        text credential_id NN_UK
        text public_key NN
        bigint counter NN
        text transports NN
        text device_type NN
        boolean backed_up NN
        text name
        timestamptz created_at NN
        timestamptz last_used_at
    }

    user_profiles {
        uuid id PK
        uuid applicant_id FK_NN_UK
        jsonb profile_data NN
        jsonb bank_data NN
        text avatar_url
        timestamptz created_at NN
        timestamptz updated_at NN
    }

    user_roles {
        uuid user_id PK_FK
        int role_id PK_FK
    }

    users {
        uuid id PK
        uuid organization_id FK
        text email NN_UK
        text password_hash NN
        boolean is_active NN
        timestamptz created_at NN
        uuid company_id FK
        text lifecycle_status NN
        timestamptz last_active_at
    }

    validation_results {
        uuid id PK
        uuid application_id FK_NN
        text rule_name
        text severity
        text message
        boolean resolved NN
        timestamptz created_at NN
    }

    applicants ||--o{ applications : "applicant_id -> id"
    applicants ||--o{ family_profiles : "applicant_id -> id"
    applicants ||--o{ identity_verification_attempts : "applicant_id -> id"
    applicants ||--o{ mobile_verify_sessions : "applicant_id -> id"
    applicants ||--o{ user_profiles : "applicant_id -> id"
    applications ||--o{ assets : "application_id -> id"
    applications ||--o{ audit_logs : "application_id -> id"
    applications ||--o{ documents : "application_id -> id"
    applications ||--o{ eligibility_screenings : "application_id -> id"
    applications ||--o{ household_members : "application_id -> id"
    applications ||--o{ income_documents : "application_id -> id"
    applications ||--o{ income_evidence_requirements : "application_id -> id"
    applications ||--o{ income_rfi_events : "application_id -> id"
    applications ||--o{ income_verification_cases : "application_id -> id"
    applications ||--o{ income_verification_decisions : "application_id -> id"
    applications ||--o{ incomes : "application_id -> id"
    applications ||--o{ insurance_coverage_records : "application_id -> id"
    applications ||--o{ review_actions : "application_id -> id"
    applications ||--o{ rfis : "application_id -> id"
    applications ||--o{ validation_results : "application_id -> id"
    collaborative_sessions ||--o{ session_messages : "session_id -> id"
    companies ||--o{ invitations : "company_id -> id"
    companies ||--o{ social_worker_profiles : "company_id -> id"
    companies ||--o{ users : "company_id -> id"
    documents ||--o{ document_extractions : "document_id -> id"
    documents ||--o{ document_pages : "document_id -> id"
    documents ||--o{ insurance_coverage_records : "document_id -> id"
    family_profiles ||--o{ benefit_stack_results : "family_profile_id -> id"
    feature_flags ||--o{ feature_flag_env_overrides : "flag_id -> id"
    household_members ||--o{ incomes : "member_id -> id"
    household_members ||--o{ incomes : "member_id, application_id -> id, application_id"
    income_documents ||--o{ income_document_extractions : "document_id -> id"
    insurance_coverage_records ||--o{ insurance_explanations : "coverage_record_id -> id"
    insurance_coverage_records ||--o{ insurance_explanations : "prior_record_id -> id"
    mh_appeal_source_documents ||--o{ mh_appeal_source_chunks : "source_document_id -> id"
    organizations ||--o{ applications : "organization_id -> id"
    organizations ||--o{ users : "organization_id -> id"
    policy_documents ||--o{ policy_chunks : "document_id -> id"
    roles ||--o{ role_permissions : "role_name -> name"
    roles ||--o{ user_roles : "role_id -> id"
    users ||--o{ admin_passkey_credentials : "user_id -> id"
    users ||--o{ applicants : "user_id -> id"
    users ||--o{ audit_logs : "user_id -> id"
    users ||--o{ collaborative_sessions : "ended_by -> id"
    users ||--o{ collaborative_sessions : "patient_user_id -> id"
    users ||--o{ collaborative_sessions : "sw_user_id -> id"
    users ||--o{ companies : "approved_by -> id"
    users ||--o{ documents : "uploaded_by -> id"
    users ||--o{ identity_verification_attempts : "user_id -> id"
    users ||--o{ income_documents : "uploaded_by -> id"
    users ||--o{ income_rfi_events : "created_by -> id"
    users ||--o{ income_verification_decisions : "reviewer_id -> id"
    users ||--o{ insurance_coverage_records : "user_id -> id"
    users ||--o{ invitations : "invited_by -> id"
    users ||--o{ login_events : "user_id -> id"
    users ||--o{ mobile_upload_sessions : "user_id -> id"
    users ||--o{ mobile_verify_sessions : "user_id -> id"
    users ||--o{ notifications : "user_id -> id"
    users ||--o{ patient_social_worker_access : "patient_user_id -> id"
    users ||--o{ patient_social_worker_access : "social_worker_user_id -> id"
    users ||--o{ review_actions : "reviewer_id -> id"
    users ||--o{ revoked_sessions : "revoked_by -> id"
    users ||--o{ revoked_sessions : "user_id -> id"
    users ||--o{ rfis : "requested_by -> id"
    users ||--o{ session_messages : "sender_id -> id"
    users ||--o{ social_worker_profiles : "approved_by -> id"
    users ||--o{ social_worker_profiles : "user_id -> id"
    users ||--o{ sw_direct_messages : "patient_user_id -> id"
    users ||--o{ sw_direct_messages : "sender_id -> id"
    users ||--o{ sw_direct_messages : "sw_user_id -> id"
    users ||--o{ sw_engagement_requests : "patient_user_id -> id"
    users ||--o{ sw_engagement_requests : "sw_user_id -> id"
    users ||--o{ user_passkey_credentials : "user_id -> id"
    users ||--o{ user_roles : "user_id -> id"
```
