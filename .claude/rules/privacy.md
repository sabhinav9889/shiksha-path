# Privacy

Many students are minors. India's DPDP Act applies. Spec §7.4.

## Collect only

Name, Google email (or backup code), cohort, lab, language preference, learning progress, speaking
recordings, doubts. Nothing else: no location, contacts, device IDs or activity outside the app.

## Never

- Log personal data. Logs carry IDs only (`learnerId`), never names, emails or doubt text.
- Send names, emails or phone numbers to AI providers. Mask anything that looks like a phone number
  or email in doubt text before sending.
- Put personal data in URLs, analytics events or error messages.

## Retention

| Data                        | Kept for                    |
| --------------------------- | --------------------------- |
| Account and progress        | Until deletion is requested |
| Speaking recordings         | 30 days after mentor review |
| Server logs                 | 90 days                     |
| AI call log (no doubt text) | 13 months, for cost reports |

## Rights

- **Export:** a student's data can be exported on request.
- **Delete:** deletion removes the student's rows and recordings everywhere (cascade). Audit log
  entries are kept but anonymised (`learnerId: DELETED`).
- Consent from guardians is collected by the NGO at enrolment.

## Review checklist

No new field without a reason · nothing personal in logs · retention defined · deletion cascades ·
export includes the new data.
