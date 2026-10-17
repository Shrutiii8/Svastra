# HeatGuard Twin — Privacy Approach

> **Scope:** This document describes the privacy protections implemented in the HeatGuard Twin hackathon proof of concept. It does NOT constitute a legal Privacy Impact Assessment or compliance certification. Professional legal and compliance review is required before any production or clinical deployment.

---

## 1. What Data Is Collected

### From the User's Device (via Health Connect)
- Heart rate readings (beats per minute + timestamps)
- Step counts (counts + timestamps)
- Distance records (optional, if available)
- Oxygen saturation (optional, if available)

Data is only collected after:
1. The user reads and accepts the onboarding consent screen
2. The user explicitly grants Android Health Connect permissions

### Environmental Data
- Weather conditions (temperature, humidity, wind speed) fetched from Open-Meteo for a configured demonstration location in New Delhi, India
- **The user's precise GPS location is NOT collected**

### Demo Data
- Entirely synthetic worker profiles and simulated readings
- No real personal data; no real employee identifiers
- Clearly labelled throughout the app as "SYNTHETIC" or "DEMO"

---

## 2. How Data Is Used

Health readings are sent to the HeatGuard Twin backend server where they are:
- Stored in a PostgreSQL database associated with a worker ID
- Used to generate a rule-based monitoring assessment
- Displayed back to the user in the mobile app

Readings are never:
- Sold or shared with third parties
- Used to make clinical medical diagnoses
- Used for advertising or profiling

---

## 3. Data Minimization

- Only record types relevant to the assessment are requested (heart rate, steps)
- Only the last 24 hours of readings are synced per sync operation
- Worker display names in the default demo are fictional ("Rajesh K. (Demo)")
- Age and baseline HR are optional profile fields
- Precise location is not requested; a fixed demonstration location is used for weather

---

## 4. Storage and Retention

- Data is stored in a PostgreSQL database (locally in development)
- No automatic expiry is implemented in this proof of concept
- In production, a documented data retention policy should be implemented

---

## 5. User Control

Users can:
- Revoke Health Connect permissions at any time via Android Settings > Health Connect
- Clear stored consent from the Profile screen (triggers re-onboarding)
- Prevent data transmission by denying Health Connect permissions
- Use Demo Mode (default) without connecting any personal health data

---

## 6. Security Measures

| Measure | Status |
|---------|--------|
| Health Connect permissions required | ✅ Implemented |
| Explicit user consent before data transmission | ✅ Implemented |
| No secrets committed to Git | ✅ `.env` excluded via `.gitignore` |
| HTTPS in production | ⚠️ Manual: configure SSL termination on Render |
| API authentication | ⚠️ Not implemented — required for multi-user production |
| Database encryption at rest | ⚠️ Depends on PostgreSQL provider |
| Audit logging | ⚠️ Not implemented |

---

## 7. Consent Records

Consent is stored locally on the device using `expo-secure-store` (encrypted storage).
An optional `ConsentRecord` model exists in the database schema for server-side consent tracking.

---

## 8. Multi-User / Production Requirements

Before deploying HeatGuard Twin with multiple real users:

1. **Implement API authentication** (JWT or OAuth 2.0) to prevent unauthorized access to health readings
2. **Restrict CORS origins** to production domains only
3. **Configure HTTPS** on the backend (Render provides automatic TLS)
4. **Implement data retention policies** with automatic expiry
5. **Conduct a formal Data Protection Impact Assessment (DPIA)** for health data processing
6. **Review compliance** with DPDP Act 2023 (India), GDPR (EU), or applicable jurisdiction's health data regulations
7. **Appoint a Data Protection Officer** if required by applicable law
8. **Implement audit logging** for data access

---

## 9. Limitations

- This proof of concept has not been reviewed by legal or compliance professionals
- No formal penetration testing has been conducted
- The consent flow is illustrative; it may not satisfy all legal requirements
- Health data is sensitive; treat it accordingly in any production context

---

## 10. Contact

For questions about this prototype's data handling, contact the project authors directly. This is a hackathon submission; it is not operated as a production service.
