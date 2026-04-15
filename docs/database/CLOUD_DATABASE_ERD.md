# Cloud Database Entity Relationship Diagram

**Source:** Cloud Supabase `public` schema  
**Database:** `postgres`  
**Inspected at:** 2026-04-15 22:22:35 UTC  
**Scope:** Schema metadata only. No row data was read.  

The cloud database currently exposes **36 public base tables** and **1 public view**. Several newer collaboration and notification tables reference Supabase `auth.users` directly, while the core application schema uses the app-owned `public.users` table. The diagrams below show that boundary explicitly.

## Table Inventory

| Domain | Tables |
|---|---|
| Identity and access | `organizations`, `companies`, `users`, `roles`, `user_roles`, `applicants`, `user_profiles`, `invitations`, `social_worker_profiles` |
| Application case management | `applications`, `household_members`, `incomes`, `assets`, `documents`, `document_pages`, `document_extractions`, `eligibility_screenings`, `validation_results`, `review_actions`, `rfis`, `audit_logs` |
| AI, RAG, and benefits | `policy_documents`, `policy_chunks`, `user_agent_memory`, `family_profiles`, `benefit_stack_results` |
| Identity verification | `identity_verification_attempts`, `mobile_verify_sessions`; view: `identity_pending_review` |
| Social-worker collaboration | `patient_social_worker_access`, `sw_engagement_requests`, `sw_direct_messages`, `collaborative_sessions`, `session_messages` |
| Platform support | `notifications`, `feature_flags`, `feature_flag_env_overrides` |

## System-Level ERD

```mermaid
erDiagram
  AUTH_USERS {
    uuid id PK
  }

  organizations {
    uuid id PK
    text name
    timestamptz created_at
  }

  companies {
    uuid id PK
    uuid approved_by FK
    text name
    text status
    timestamptz created_at
  }

  users {
    uuid id PK
    uuid organization_id FK
    uuid company_id FK
    text email UK
    text password_hash
    boolean is_active
    text lifecycle_status
    timestamptz created_at
  }

  roles {
    int id PK
    text name UK
  }

  user_roles {
    uuid user_id PK
    int role_id PK
  }

  applicants {
    uuid id PK
    uuid user_id FK
    text first_name
    text last_name
    date dob
    text identity_status
    timestamptz created_at
  }

  applications {
    uuid id PK
    uuid organization_id FK
    uuid applicant_id FK
    application_status status
    text application_type
    jsonb draft_state
    timestamptz created_at
    timestamptz updated_at
  }

  documents {
    uuid id PK
    uuid application_id FK
    uuid uploaded_by FK
    text document_type
    text document_status
    text file_path
    timestamptz uploaded_at
  }

  family_profiles {
    uuid id PK
    uuid applicant_id FK
    jsonb profile_data
    timestamptz created_at
    timestamptz updated_at
  }

  benefit_stack_results {
    uuid id PK
    uuid family_profile_id FK
    jsonb stack_data
    timestamptz generated_at
  }

  policy_documents {
    uuid id PK
    text source_url UK
    text title
    text doc_type
    text language
    int chunk_count
  }

  policy_chunks {
    uuid id PK
    uuid document_id FK
    int chunk_index
    text content
    vector embedding
  }

  user_agent_memory {
    uuid id PK
    text user_id UK
    text session_id
    jsonb extracted_facts
    jsonb form_progress
    timestamptz updated_at
  }

  organizations ||--o{ users : "organization_id"
  organizations ||--o{ applications : "organization_id"
  companies ||--o{ users : "company_id"
  users ||--o| applicants : "user_id"
  users ||--o{ user_roles : "user_id"
  roles ||--o{ user_roles : "role_id"
  applicants ||--o{ applications : "applicant_id"
  applications ||--o{ documents : "application_id"
  users ||--o{ documents : "uploaded_by"
  applicants ||--o| family_profiles : "applicant_id"
  family_profiles ||--o{ benefit_stack_results : "family_profile_id"
  policy_documents ||--o{ policy_chunks : "document_id"
```

## Identity and Access ERD

```mermaid
erDiagram
  organizations {
    uuid id PK
    text name
    timestamptz created_at
  }

  companies {
    uuid id PK
    uuid approved_by FK
    text name
    text npi
    text email_domain
    text status
    timestamptz approved_at
    timestamptz created_at
  }

  users {
    uuid id PK
    uuid organization_id FK
    uuid company_id FK
    text email UK
    text password_hash
    boolean is_active
    text lifecycle_status
    timestamptz created_at
  }

  roles {
    int id PK
    text name UK
  }

  user_roles {
    uuid user_id PK
    int role_id PK
  }

  applicants {
    uuid id PK
    uuid user_id FK
    text first_name
    text last_name
    date dob
    text ssn_encrypted
    text citizenship_status
    text identity_status
    smallint identity_score
  }

  user_profiles {
    uuid id PK
    uuid applicant_id FK
    jsonb profile_data
    jsonb bank_data
    text avatar_url
    timestamptz updated_at
  }

  social_worker_profiles {
    uuid id PK
    uuid user_id FK
    uuid company_id FK
    uuid approved_by FK
    text first_name
    text last_name
    text status
    text license_number
    timestamptz approved_at
  }

  invitations {
    uuid id PK
    uuid company_id FK
    uuid invited_by FK
    text email
    text role
    text token UK
    timestamptz expires_at
    timestamptz accepted_at
  }

  organizations ||--o{ users : "organization_id"
  companies ||--o{ users : "company_id"
  users ||--o| applicants : "user_id"
  applicants ||--o| user_profiles : "applicant_id"
  users ||--o{ user_roles : "user_id"
  roles ||--o{ user_roles : "role_id"
  companies ||--o{ social_worker_profiles : "company_id"
  users ||--o| social_worker_profiles : "user_id"
  users ||--o{ social_worker_profiles : "approved_by"
  companies ||--o{ invitations : "company_id"
  users ||--o{ invitations : "invited_by"
  users ||--o{ companies : "approved_by"
```

## Application Case Management ERD

```mermaid
erDiagram
  applicants {
    uuid id PK
    uuid user_id FK
  }

  organizations {
    uuid id PK
  }

  users {
    uuid id PK
  }

  applications {
    uuid id PK
    uuid organization_id FK
    uuid applicant_id FK
    application_status status
    int household_size
    numeric total_monthly_income
    numeric confidence_score
    text application_type
    jsonb draft_state
    int draft_step
    timestamptz submitted_at
    timestamptz decided_at
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

  documents {
    uuid id PK
    uuid application_id FK
    uuid uploaded_by FK
    text document_type
    text file_url
    text mime_type
    text document_status
    text file_name
    text file_path
    bigint file_size_bytes
  }

  document_pages {
    uuid id PK
    uuid document_id FK
    int page_number UK
    text ocr_text
  }

  document_extractions {
    uuid id PK
    uuid document_id FK
    text model_name
    jsonb raw_output
    jsonb structured_output
    numeric confidence_score
  }

  eligibility_screenings {
    uuid id PK
    uuid application_id FK
    text estimated_program
    numeric fpl_percentage
    text screening_result
  }

  validation_results {
    uuid id PK
    uuid application_id FK
    text rule_name
    text severity
    text message
    boolean resolved
  }

  review_actions {
    uuid id PK
    uuid application_id FK
    uuid reviewer_id FK
    text action_type
    text notes
  }

  rfis {
    uuid id PK
    uuid application_id FK
    uuid requested_by FK
    text message
    date due_date
    boolean resolved
  }

  audit_logs {
    uuid id PK
    uuid user_id FK
    uuid application_id FK
    text action
    jsonb old_data
    jsonb new_data
    text ip_address
  }

  applicants ||--o{ applications : "applicant_id"
  organizations ||--o{ applications : "organization_id"
  applications ||--o{ household_members : "application_id"
  applications ||--o{ incomes : "application_id"
  household_members ||--o{ incomes : "member_id"
  applications ||--o{ assets : "application_id"
  applications ||--o{ documents : "application_id"
  users ||--o{ documents : "uploaded_by"
  documents ||--o{ document_pages : "document_id"
  documents ||--o{ document_extractions : "document_id"
  applications ||--o{ eligibility_screenings : "application_id"
  applications ||--o{ validation_results : "application_id"
  applications ||--o{ review_actions : "application_id"
  users ||--o{ review_actions : "reviewer_id"
  applications ||--o{ rfis : "application_id"
  users ||--o{ rfis : "requested_by"
  applications ||--o{ audit_logs : "application_id"
  users ||--o{ audit_logs : "user_id"
```

## AI, RAG, and Benefit ERD

```mermaid
erDiagram
  applicants {
    uuid id PK
  }

  family_profiles {
    uuid id PK
    uuid applicant_id FK
    jsonb profile_data
    timestamptz created_at
    timestamptz updated_at
  }

  benefit_stack_results {
    uuid id PK
    uuid family_profile_id FK
    jsonb stack_data
    timestamptz generated_at
  }

  policy_documents {
    uuid id PK
    text title
    text source_url UK
    text doc_type
    text language
    timestamptz ingested_at
    int chunk_count
  }

  policy_chunks {
    uuid id PK
    uuid document_id FK
    int chunk_index
    text content
    vector embedding
    timestamptz created_at
  }

  user_agent_memory {
    uuid id PK
    text user_id UK
    text session_id
    jsonb extracted_facts
    jsonb form_progress
    timestamptz created_at
    timestamptz updated_at
  }

  applicants ||--o| family_profiles : "applicant_id"
  family_profiles ||--o{ benefit_stack_results : "family_profile_id"
  policy_documents ||--o{ policy_chunks : "document_id"
```

**Note:** `user_agent_memory.user_id` is `text` and unique, but the cloud schema does not define a foreign key to `public.users` or `auth.users`.

## Identity Verification ERD

```mermaid
erDiagram
  users {
    uuid id PK
  }

  applicants {
    uuid id PK
    uuid user_id FK
    text identity_status
    smallint identity_score
    text dl_number_hash
    date dl_expiration_date
    text dl_issuing_state
  }

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

  identity_pending_review {
    uuid applicant_id
    text first_name
    text last_name
    text identity_status
    smallint identity_score
    timestamptz last_attempt_at
    jsonb breakdown
  }

  users ||--o| applicants : "user_id"
  applicants ||--o{ identity_verification_attempts : "applicant_id"
  users ||--o{ identity_verification_attempts : "user_id"
  applicants ||--o{ mobile_verify_sessions : "applicant_id"
  users ||--o{ mobile_verify_sessions : "user_id"
  applicants ||--o{ identity_pending_review : "view source"
```

## Social-Worker Collaboration ERD

```mermaid
erDiagram
  AUTH_USERS {
    uuid id PK
  }

  users {
    uuid id PK
  }

  patient_social_worker_access {
    uuid id PK
    uuid patient_user_id FK
    uuid social_worker_user_id FK
    timestamptz granted_at
    timestamptz revoked_at
    boolean is_active
  }

  sw_engagement_requests {
    uuid id PK
    uuid patient_user_id FK
    uuid sw_user_id FK
    text status
    text patient_message
    text rejection_note
    timestamptz created_at
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
    text transcription
    varchar transcription_lang
    timestamptz read_at
    timestamptz created_at
  }

  collaborative_sessions {
    uuid id PK
    uuid sw_user_id FK
    uuid patient_user_id FK
    uuid ended_by FK
    text status
    timestamptz scheduled_at
    timestamptz started_at
    timestamptz ended_at
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

  users ||--o{ patient_social_worker_access : "patient_user_id"
  users ||--o{ patient_social_worker_access : "social_worker_user_id"
  AUTH_USERS ||--o{ sw_engagement_requests : "patient_user_id"
  AUTH_USERS ||--o{ sw_engagement_requests : "sw_user_id"
  AUTH_USERS ||--o{ sw_direct_messages : "sw_user_id"
  AUTH_USERS ||--o{ sw_direct_messages : "patient_user_id"
  AUTH_USERS ||--o{ sw_direct_messages : "sender_id"
  AUTH_USERS ||--o{ collaborative_sessions : "sw_user_id"
  AUTH_USERS ||--o{ collaborative_sessions : "patient_user_id"
  AUTH_USERS ||--o{ collaborative_sessions : "ended_by"
  collaborative_sessions ||--o{ session_messages : "session_id"
  AUTH_USERS ||--o{ session_messages : "sender_id"
```

## Platform Support ERD

```mermaid
erDiagram
  AUTH_USERS {
    uuid id PK
  }

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

  feature_flags {
    uuid id PK
    text key UK
    text label
    text description
    boolean enabled
    text category
    jsonb metadata
    timestamptz created_at
    timestamptz updated_at
  }

  feature_flag_env_overrides {
    uuid id PK
    uuid flag_id FK
    text environment UK
    boolean enabled
    timestamptz created_at
    timestamptz updated_at
  }

  AUTH_USERS ||--o{ notifications : "user_id"
  feature_flags ||--o{ feature_flag_env_overrides : "flag_id"
```

## Foreign Key Relationship Catalog

| From table | Column | To table | Delete behavior |
|---|---|---|---|
| `applicants` | `user_id` | `users.id` | default |
| `applications` | `applicant_id` | `applicants.id` | default |
| `applications` | `organization_id` | `organizations.id` | default |
| `assets` | `application_id` | `applications.id` | cascade |
| `audit_logs` | `application_id` | `applications.id` | set null |
| `audit_logs` | `user_id` | `users.id` | default |
| `benefit_stack_results` | `family_profile_id` | `family_profiles.id` | cascade |
| `companies` | `approved_by` | `users.id` | default |
| `documents` | `application_id` | `applications.id` | cascade |
| `documents` | `uploaded_by` | `users.id` | default |
| `document_pages` | `document_id` | `documents.id` | cascade |
| `document_extractions` | `document_id` | `documents.id` | cascade |
| `eligibility_screenings` | `application_id` | `applications.id` | cascade |
| `family_profiles` | `applicant_id` | `applicants.id` | cascade |
| `feature_flag_env_overrides` | `flag_id` | `feature_flags.id` | cascade |
| `household_members` | `application_id` | `applications.id` | cascade |
| `identity_verification_attempts` | `applicant_id` | `applicants.id` | cascade |
| `identity_verification_attempts` | `user_id` | `users.id` | cascade |
| `incomes` | `application_id` | `applications.id` | cascade |
| `incomes` | `member_id` | `household_members.id` | default |
| `incomes` | `(member_id, application_id)` | `household_members(id, application_id)` | cascade |
| `invitations` | `company_id` | `companies.id` | set null |
| `invitations` | `invited_by` | `users.id` | set null |
| `mobile_verify_sessions` | `applicant_id` | `applicants.id` | cascade |
| `mobile_verify_sessions` | `user_id` | `users.id` | cascade |
| `patient_social_worker_access` | `patient_user_id` | `users.id` | cascade |
| `patient_social_worker_access` | `social_worker_user_id` | `users.id` | cascade |
| `policy_chunks` | `document_id` | `policy_documents.id` | cascade |
| `review_actions` | `application_id` | `applications.id` | default |
| `review_actions` | `reviewer_id` | `users.id` | default |
| `rfis` | `application_id` | `applications.id` | default |
| `rfis` | `requested_by` | `users.id` | default |
| `social_worker_profiles` | `approved_by` | `users.id` | default |
| `social_worker_profiles` | `company_id` | `companies.id` | default |
| `social_worker_profiles` | `user_id` | `users.id` | cascade |
| `user_profiles` | `applicant_id` | `applicants.id` | cascade |
| `user_roles` | `role_id` | `roles.id` | cascade |
| `user_roles` | `user_id` | `users.id` | cascade |
| `users` | `company_id` | `companies.id` | set null |
| `users` | `organization_id` | `organizations.id` | default |
| `validation_results` | `application_id` | `applications.id` | cascade |
| `collaborative_sessions` | `sw_user_id`, `patient_user_id`, `ended_by` | `auth.users.id` | cascade for participants; default for `ended_by` |
| `session_messages` | `session_id` | `collaborative_sessions.id` | cascade |
| `session_messages` | `sender_id` | `auth.users.id` | cascade |
| `notifications` | `user_id` | `auth.users.id` | cascade |
| `sw_direct_messages` | `sw_user_id`, `patient_user_id`, `sender_id` | `auth.users.id` | cascade |
| `sw_engagement_requests` | `patient_user_id`, `sw_user_id` | `auth.users.id` | cascade |

## Index and Constraint Highlights

- `policy_chunks.embedding` has an `ivfflat` vector cosine index for RAG retrieval.
- `applications.draft_state`, `benefit_stack_results.stack_data`, `document_extractions.structured_output`, and `user_profiles.profile_data` have GIN indexes.
- `applications` has trigram indexes over `application_type`, `id::text`, and applicant name extracted from `draft_state`.
- `document_pages` enforces unique `(document_id, page_number)`.
- `incomes` has both a simple `member_id` FK and a composite `(member_id, application_id)` FK to `household_members(id, application_id)`.
- `audit_logs` has two foreign key constraints on `application_id` pointing to `applications(id)` with `ON DELETE SET NULL`; this appears redundant in the cloud schema.
- `user_agent_memory.user_id` is unique and indexed but is not enforced as a FK.
- Collaboration tables are split across app-owned `public.users` references and Supabase-native `auth.users` references. This is workable, but it should be documented as an intentional boundary or normalized in a future migration.

## Public View

| View | Purpose inferred from schema |
|---|---|
| `identity_pending_review` | Joins applicant identity fields with latest verification attempt data for applicants needing manual identity review. |

## Diagram Maintenance

Regenerate this document after any migration that changes:

- table ownership or auth boundaries,
- FK constraints,
- RAG policy document/chunk schema,
- application draft/document/reviewer workflows,
- agent memory schema,
- identity verification tables,
- social-worker messaging/session tables.
