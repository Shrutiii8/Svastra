# Svastra 🌡️

**A wearable-powered heat-exposure monitoring proof of concept for outdoor workers.**

Svastra combines wearable health readings, environmental weather data, individual baselines, and a transparent rule-based assessment engine to help identify unusual physiological patterns and support timely preventive action for people working outdoors.

> **Important disclaimer:** Svastra is a hackathon proof of concept, not a medical device. Its assessments are non-diagnostic, illustrative, and must not replace professional medical or occupational-health advice. Assessment thresholds are configurable and have not been medically validated.

---

## 1. Team and Institution Details

- **Team name:** `Svastra`
- **Team leader:** `Anupam Raj`
- **Team members:** `Anupam Raj, Shruti Sinha, Sanskar Agrawal`
- **College / institution:** Heritage Institute of Technology, Kolkata
- **Incubator (if applicable):** `N/A`

---

## 2. Project Title

**Svastra — Wearable-Powered Heat-Exposure Monitoring for Outdoor Workers**

---

## 3. Problem Statement and Healthcare Use Case

Construction workers, delivery riders, street vendors, and traffic police in India can work outdoors for extended periods and experience significant heat exposure. Weather measurements alone cannot show how an individual worker is responding physiologically.

Svastra brings together wearable biometrics, environmental conditions, and individual baselines to flag unusual physiological patterns. It is intended to support awareness and preventive action by workers or supervisors—not to diagnose heat illness or replace clinical judgement.

### Healthcare use case

- Collect health readings from a supported wearable through Android Health Connect, with the user's permission.
- Combine available readings with current environmental conditions such as temperature, humidity, and wind speed.
- Compare readings against available individual baselines using transparent, rule-based logic.
- Display worker status and alerts so unusual patterns or missing data can be reviewed.
- Provide a demo mode using clearly labelled synthetic worker data when a wearable or network is unavailable.

### Intended users

- Construction workers
- Delivery riders
- Street vendors
- Traffic police and other outdoor workers
- Supervisors responsible for worker safety

---

## 4. Technical Stack

| Component | Technology |
|---|---|
| Mobile application | React Native, Expo SDK 57, TypeScript, Expo Router |
| Wearable data | Android Health Connect; compatible readings may be synced from the Titan Smart app and other supported wearables |
| Health data integration | `react-native-health-connect` |
| Charts | `react-native-chart-kit`, `react-native-svg` |
| State and data fetching | Zustand, TanStack Query |
| Backend API | Python, FastAPI, Pydantic v2 |
| Database access | SQLAlchemy 2.x async, psycopg 3 |
| Database | PostgreSQL |
| Database migrations | Alembic |
| HTTP clients | Axios (mobile), HTTPX (backend) |
| Weather data | Open-Meteo API |
| Testing | pytest-asyncio |
| Deployment | Render (backend); managed PostgreSQL |

### AI/ML model or framework details

**Current implementation: rule-based assessment engine; no trained machine-learning model is included.**

The assessment engine applies transparent rules to available readings and individual baselines. It can flag patterns such as elevated heart rate, stale readings, disconnected workers, or insufficient data. The thresholds are illustrative and are not medically validated. The project does not claim ML-based prediction or model accuracy.

A future ML model would require a suitable labelled dataset, evaluation, clinical/occupational-health review, and careful validation before any real-world use.

---

## 5. System Architecture

```text
Titan Watch / Supported Wearable
              |
              v
       Titan Smart App
        (if applicable)
              |
              v
   Android Health Connect
              |
              v
    Svastra Mobile App
       (React Native / Expo)
              |
           HTTPS
              |
              v
       FastAPI Backend
              |
       +------+------+
       |             |
       v             v
 PostgreSQL     Open-Meteo API
                 (weather)
```

The mobile app requests permission before reading Health Connect data. The backend stores submitted readings and assessment information. Demo mode can use synthetic data and simulated weather fallback.

- **Architecture diagram:** `[Add link to architecture PDF/PPT, e.g. docs/architecture.pdf]`
- The repository also contains `docs/ARCHITECTURE.md`, if included in this submission.

---

## 6. Prototype Demonstration Video

**Minimum duration: 20 minutes**

- **Video link:** `[Add an accessible video link here]`
- The video may be an unlisted YouTube video or a recorded PowerPoint presentation.
- Ensure the evaluation team can open the link without requesting access.

Suggested demonstration outline:
1. Introduce the problem, target users, and healthcare use case.
2. Explain the system architecture and technology stack.
3. Demonstrate onboarding and consent.
4. Show the dashboard, worker list, individual worker view, and alerts.
5. Demonstrate Health Connect permissions and reading sync, where a compatible device is available.
6. Show demo mode and explain the synthetic scenarios.
7. Explain the rule-based assessment engine and its limitations.
8. Discuss privacy, known limitations, and future work.

---

## 7. Presentation

- **Presentation PDF/PPT:** `[Add link to the presentation file, or place it in the repository and link it here]`

The presentation should explain the problem, healthcare use case, solution, architecture, technology stack, prototype demonstration, outcomes, limitations, and future scope.

---

## 8. Open-Source License

This project is intended to be released under the **MIT License**.

- **License file:** [`LICENSE`](LICENSE)

Ensure the repository contains the complete MIT `LICENSE` file before submission. Review third-party library, SDK, and data-source terms separately.

---

## 9. Features

- React Native / Expo mobile app with onboarding, dashboard, worker list, alerts, and individual worker views.
- Android Health Connect integration for supported readings such as heart rate, steps, distance, and oxygen saturation, subject to device and data-source availability.
- Open-Meteo weather integration for temperature, humidity, and wind speed, with a simulated fallback.
- Synthetic demo workers covering multiple illustrative scenarios.
- Transparent, rule-based, non-diagnostic assessments.
- FastAPI REST API with PostgreSQL persistence.
- Explicit user consent before health data is collected or transmitted.
- Demo mode for demonstrations when a wearable or network is unavailable.

---

## 10. Repository Structure

```text
svastra/
├── mobile/                  # React Native / Expo application
├── backend/                 # FastAPI backend
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_SOURCES.md
│   ├── PRIVACY.md
│   └── BUILD_STATUS.md
├── .env.example
├── LICENSE
└── README.md
```

The exact contents may vary by repository version. Keep this section in sync with the files actually committed.

---

## 11. Setup and Running Locally

### Prerequisites

- Node.js and npm
- Python 3.10+
- PostgreSQL
- Android device or emulator for mobile testing
- Android Health Connect support for wearable-data integration
- An Expo development build for native Health Connect modules; Expo Go does not support these native modules

### Backend

1. Clone the public repository and enter its directory:

   ```bash
   git clone <PUBLIC_GITHUB_REPOSITORY_URL>
   cd svastra
   ```

2. Configure environment variables using the provided example file. Set a valid PostgreSQL connection string in `backend/.env`.

   ```bash
   cp .env.example backend/.env
   ```

3. Install dependencies and start the API:

   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```

4. Open the API documentation at `http://localhost:8000/docs`. The health endpoint is available at `http://localhost:8000/health`.

### Mobile application

In a second terminal:

```bash
cd mobile
npm install
```

Set `EXPO_PUBLIC_API_BASE_URL` in `mobile/.env` to the backend address accessible from your device. For example:

```bash
# Android emulator
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000

# Physical Android device: replace with your laptop's LAN IP
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
```

Then start Expo:

```bash
npm start
```

For Health Connect, build and install an Android development build rather than relying on Expo Go. See the project documentation for device-specific setup.

---

## 12. Demo Mode and Limitations

Demo mode uses fictional workers and synthetic readings. Synthetic data must remain clearly labelled and must not be presented as real patient or worker measurements.

Current limitations include:
- The assessment logic is rule-based and not a clinically validated ML model.
- Assessment thresholds are illustrative and not medically validated.
- Wearable data availability and sync frequency depend on the device, companion app, Health Connect permissions, and the data exposed by the source.
- Missing readings are not proof of a health problem; stale or missing data should be treated as insufficient information.
- API authentication and production-grade controls may be incomplete in this proof of concept.
- Demo weather settings may use a fixed location or simulated fallback.

---

## 13. Privacy and Data Sources

- User permission is required before accessing health readings through Android Health Connect.
- The app should request only the permissions needed for its supported features.
- No GPS location is required for the fixed-location demo weather configuration.
- Demo worker data is synthetic and should be clearly identified.
- Do not expose real health data through a publicly accessible deployment without appropriate authentication, access controls, consent, and data-protection review.

Relevant project documents:
- [`docs/PRIVACY.md`](docs/PRIVACY.md)
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)

### Data source notes

- **Android Health Connect:** permission-gated health data; subject to Android SDK and platform terms.
- **Open-Meteo:** weather data; review the applicable attribution and licence requirements, including CC BY 4.0 where applicable.
- **Demo data:** synthetic data created for this project.

---

## 14. Submission Checklist

Before submitting, verify every item below.

- [ ] Repository is **public** and accessible to evaluators.
- [ ] Repository/folder naming follows the event requirement: `Team Name_College Name`.
- [ ] Team name, team leader, team members, mentor (if applicable), and college/incubator details are filled in.
- [ ] Project title, problem statement, and healthcare use case are documented.
- [ ] Technical stack and AI/ML model or framework details are documented accurately.
- [ ] A video of **at least 20 minutes** is linked and accessible.
- [ ] Open-source `LICENSE` file is committed.
- [ ] Architecture diagram is included in PDF/PPT format and linked above.
- [ ] Presentation is included in PDF/PPT format and linked above.
- [ ] All referenced documents and links can be opened without special access.
- [ ] Submission platform contains only the team leader's name, phone number, email ID, and public GitHub repository link, as instructed.

---

## 15. Future Work

- Add authentication and role-based access control.
- Add reliable background sync where supported.
- Improve environmental heat-exposure estimation with documented methods and limitations.
- Explore supervisor notifications and a dedicated dashboard.
- Define retention and deletion policies for health data.
- Evaluate whether a suitable labelled occupational-heat dataset exists before developing an ML model.
- Complete privacy, security, and occupational-health review before production use.

---

**Svastra is a hackathon proof of concept for demonstration purposes only. It is not intended to diagnose, treat, or prevent any medical condition.**
