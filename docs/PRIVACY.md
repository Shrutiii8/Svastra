# Svastra — Privacy Approach

> **Scope:** This document describes the intended and reported privacy protections in the Svastra hackathon proof of concept. It is not a legal Privacy Impact Assessment, Data Protection Impact Assessment (DPIA), or compliance certification. Implementation details should be verified against the current code before relying on them. Professional legal and compliance review is required before production or clinical deployment.

---

## 1. What Data Is Collected

### From the user's device (via Android Health Connect)

Depending on device support, available source data, granted permissions, and the app's implementation, Svastra may access:
- Heart-rate readings (beats per minute and timestamps)
- Step counts (counts and timestamps)
- Distance records (if available and enabled)
- Oxygen-saturation readings (if available and enabled)

Health data should only be accessed after:
1. The user has reviewed and accepted the onboarding consent screen.
2. The user has explicitly granted the relevant Android Health Connect permissions.

Actual behavior depends on the permissions and sync logic present in the current app build. Do not assume that every listed data type is available on every device.

### Environmental data

- Weather conditions such as temperature, humidity, and wind speed may be fetched from Open-Meteo for a configured demonstration location in New Delhi, India.
- The prototype is designed to use a configured location for weather and does not require the user's precise GPS location for that purpose.

### Demo data

- Demo mode may use synthetic worker profiles and simulated readings.
- Synthetic data should not contain real personal or employee identifiers and should be clearly labelled as **DEMO** or **SYNTHETIC** in the app.
- Demo data must not be represented as real worker or patient measurements.

---

## 2. How Data Is Used

Where implemented, health readings submitted to the Svastra backend may be:
- Stored in a PostgreSQL database and associated with a worker identifier.
- Used by the rule-based assessment engine to generate illustrative monitoring assessments.
- Displayed in the mobile app.

Svastra is a hackathon proof of concept. Its assessments are non-diagnostic and must not be used as a substitute for professional medical or occupational-health advice.

Do not claim that data is never shared with third parties unless the deployed system, hosting providers, logs, and integrations have been reviewed. The prototype is not intended to use health readings for advertising or to sell personal health data.

---

## 3. Data Minimization

The project aims to:
- Request only health-data permissions needed for implemented features.
- Limit each sync operation to the readings and time range supported by the current implementation. The original project description specifies the last 24 hours per sync; verify this against the current code before relying on it.
- Use fictional display names for default demo workers.
- Treat age and baseline heart rate as optional profile fields where supported.
- Avoid requesting precise GPS location for the fixed-location demo weather configuration.

---

## 4. Storage and Retention

- The backend is designed to store submitted readings in PostgreSQL. In development, the database may run locally; a deployed environment may use a managed PostgreSQL provider.
- Automatic expiry or deletion of stored readings is not implemented in the described proof of concept.
- Users should not assume that uninstalling the mobile app or revoking Health Connect permission deletes readings already sent to the backend.
- Before production use, define and implement a documented retention and deletion policy.

---

## 5. User Control

Depending on the current app build, users may be able to:
- Revoke Health Connect permissions through Android Settings → Health Connect.
- Clear locally stored consent through the Profile screen, if that control is implemented.
- Prevent new Health Connect reads by denying or revoking the relevant permissions.
- Use demo mode without connecting personal health data.

Revoking permissions or clearing local consent does not necessarily delete health data already transmitted to the backend. Verify the app's behavior before making stronger deletion or withdrawal claims.

---

## 6. Security Measures and Status

The following reflects the project description and must be checked against the current implementation and deployment configuration.

| Measure | Status / qualification |
|---|---|
| Health Connect permissions | Intended to be required for reading protected health data; verify the current permission configuration |
| Explicit consent before data transmission | Described as implemented; verify the consent flow and every transmission path |
| Secrets excluded from Git | `.env` is reported as excluded via `.gitignore`; verify the repository history and tracked files |
| HTTPS in deployment | Configure and verify HTTPS for the deployed API; Render supports TLS for public web services |
| API authentication | Reported as not implemented; required before multi-user production use |
| Database encryption at rest | Depends on the selected PostgreSQL provider and its configuration |
| Audit logging | Reported as not implemented |
| Formal security testing | No formal penetration test is claimed for this proof of concept |

Do not commit real credentials, database passwords, API keys, or production secrets to the repository. If a secret has already been committed, remove it from active use and rotate it; deleting it from the latest commit alone may not remove it from Git history.

---

## 7. Consent Records

The project description states that consent is stored locally using `expo-secure-store` and that an optional `ConsentRecord` model exists in the database schema.

These details should be verified against the current code. The existence of a database model does not prove that server-side consent records are written. Local consent storage also does not, by itself, prove that consent withdrawal is propagated to the backend or that previously transmitted readings are deleted.

---

## 8. Requirements Before Multi-User or Production Use

Before using Svastra with multiple real users or real health data:

1. Implement authentication and authorization (for example, a properly designed JWT or OAuth 2.0 flow) to prevent unauthorized access to health readings.
2. Restrict CORS origins to the required production origins.
3. Configure and verify HTTPS for the API and secure database connections.
4. Implement documented data retention, deletion, and consent-withdrawal behavior.
5. Conduct a formal DPIA or other appropriate privacy assessment.
6. Review applicable requirements, including India's Digital Personal Data Protection Act, 2023, and other relevant laws based on deployment and users.
7. Determine whether a Data Protection Officer or other designated role is legally required; do not assume one is always mandatory.
8. Implement appropriate audit logging and access monitoring.
9. Review data access, hosting, backups, error logs, and third-party service arrangements.
10. Obtain suitable security, privacy, and occupational-health review before real-world deployment.

---

## 9. Limitations

- This proof of concept has not been reviewed by legal or compliance professionals.
- No formal penetration testing is claimed.
- The consent flow may not satisfy all legal requirements.
- Health-data availability depends on the device, companion app, Health Connect permissions, and source application.
- The assessment engine is rule-based and uses illustrative, non-medically validated thresholds.
- Automatic data expiry is not implemented in the described version.
- API authentication and audit logging are reported as not implemented.
- Health data is sensitive and must be handled accordingly.

---

## 10. Contact

For questions about the prototype's data handling, contact the Svastra project team through the contact details provided in the project repository or submission materials.

Svastra is a hackathon proof of concept, not a production service. Do not submit real health data to a public deployment unless suitable authorization, access controls, security measures, consent, and privacy review are in place.
