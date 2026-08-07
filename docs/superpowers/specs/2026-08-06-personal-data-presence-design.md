# Personal Data Presence Design

## Objective

Show the destructive personal-data reset action only when an authenticated customer has meaningful user-entered personal content. An account with no such content displays an empty-state message instead of a delete button.

This extends the existing personal-data reset design. It does not change the deletion boundary or preserved login account.

## Presence Boundary

`hasPersonalData` is true when the customer has at least one of the following:

- a non-empty user profile or family profile field;
- an applicant or application record, regardless of application status;
- a customer-authored message or help question; or
- an uploaded or referenced customer file.

Automatically generated operational records do not count. Login events, analytics, notifications, rate-limit counters, and similar system activity must not make the delete action reappear after a reset.

An applicant or application row counts even if its editable fields are empty because its existence represents a user-started application. For profile records, an empty placeholder row does not count; at least one meaningful editable field must contain a value.

## Architecture

### Database query

A server-only repository function, `hasCustomerPersonalData(userId)`, performs one bounded query composed of `EXISTS` checks. It reads authoritative tables and returns a boolean. It must not fetch personal values into application memory.

The query reuses the personal-data ownership rules established by the reset feature. The counted table set is explicit and tested so that future user-entered data sources require a deliberate presence disposition.

### API

`GET /api/account/personal-data` authenticates the current user, applies the same customer authorization rule as the delete operation, calls `hasCustomerPersonalData`, and returns:

```json
{ "hasPersonalData": true }
```

The endpoint never accepts a user ID and returns no personal values or record counts. Authentication and authorization failures use the existing `401` and `403` behavior. Query failures return a generic `500` response and are logged without personal content.

`DELETE /api/account/personal-data` remains unchanged.

### Dashboard card

The existing client card requests the presence state when it mounts.

- While loading, it renders a stable neutral loading state without a destructive action.
- When `hasPersonalData` is true, it renders the existing warning copy and delete button.
- When false, it renders: **No personal data has been entered.** The delete button and confirmation dialog are absent.
- If the check fails, it renders a generic error and a retry control. It must never interpret an error as an empty account.

After a successful reset, the component changes immediately to the empty state without waiting for navigation. Saving profile data or starting an application makes the action reappear the next time the dashboard card loads. Cross-tab live synchronization is outside the initial scope.

## Data Flow

1. The customer dashboard mounts the card.
2. The card calls authenticated `GET /api/account/personal-data`.
3. The route derives the user ID from the session and queries authoritative tables.
4. The card renders the destructive or empty state from the returned boolean.
5. After successful deletion, the card sets its local presence state to false and clears the existing customer browser state.

## Performance and Reliability

The presence query uses short-circuiting `EXISTS` clauses and indexed ownership keys. It does not count rows or join full datasets. The endpoint is dynamic and must not share cached results between users. Normal dashboard refresh is sufficient to observe newly entered data.

The UI retains four explicit states: loading, present, empty, and error. This prevents destructive controls from flashing before authorization completes and prevents false empty-state claims during database or network failures.

## Testing

Repository tests cover:

- a completely empty customer account;
- a non-empty profile and an empty placeholder profile;
- an application-only account;
- message-only and file-only accounts; and
- accounts containing only ignored system records.

Route tests cover authentication, customer authorization, true and false responses, safe failures, and session-derived identity.

Component tests cover loading, present, empty, and error states; retry behavior; and the immediate transition to empty after successful deletion.

## Out of Scope

- A denormalized `has_personal_data` database flag.
- Live cross-tab updates.
- Treating system-generated activity as user-entered personal content.
- Changing which records the reset operation deletes.
