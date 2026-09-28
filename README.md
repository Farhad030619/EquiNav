# EquiNav 🐴🚗💨
> **Smart GPS Navigation & Safety Assistant for Horse Transports**

[![Live Demo](https://img.shields.io/badge/Demo-Live%20on%20Vercel-success?style=for-the-badge&logo=vercel)](https://equinav.vercel.app)
[![Tech](https://img.shields.io/badge/Platform-PWA%20%7C%20Vanilla%20JS-blue?style=for-the-badge)](https://equinav.vercel.app)
[![Database](https://img.shields.io/badge/Database-Supabase%20(PostgreSQL)-green?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Security](https://img.shields.io/badge/Security-RLS%20%2B%20Rate%20Limited-orange?style=for-the-badge)](https://github.com/Farhad030619/EquiNav)

EquiNav is a specialized navigation and towing safety application built for horse owners and equine transport drivers in Sweden. Towing horses requires careful weight calculations according to Swedish transport regulations (B, B96, and BE driver's license classes), gentle driving routes, and immediate access to equine emergency clinics.

---

## 🌟 Key Features

### ⚖️ 1. Smart Towing & Driver's License Calculator
- **Automated Reg-Number Lookup**: Fetches curb weight, gross vehicle weight (totalvikt), and max tow capacity directly from vehicle databases.
- **License Eligibility Check**: Instantly verifies whether a combination is legal on a standard **B-license**, extended **B96**, or heavy **BE-license**.
- **Real-Time Margin Warning**: Visual indicators when approaching or exceeding critical weight thresholds.

### 🗺️ 2. Horse-Safe Turn-by-Turn GPS Navigation
- **Gentle Routing Engine**: Powered by OpenStreetMap (OSRM) with Leaflet.js, designed to avoid sharp maneuvers and rough terrain.
- **Offline Mode (PWA)**: Stables and competition grounds often have poor cellular connectivity. EquiNav caches routes and map tiles locally via a dedicated Service Worker.

### ⚠️ 3. Real-Time Hazard Reporting & Traffic Alerts
- **Community Hazard Crowdsourcing**: Drivers can report and view obstacles, slippery patches, or accidents on the map.
- **Trafikverket API Integration**: Connects to the Swedish Transport Administration's official traffic camera and incident feed via serverless endpoints.

### 🏥 4. Emergency Equine Vet Finder
- One-click navigation and direct calling to the nearest accredited equine hospitals and veterinary clinics across Sweden.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 | Ultra-fast load times, zero bundle overhead, native browser performance. |
| **Maps & Routing** | [Leaflet.js](https://leafletjs.com/), OpenStreetMap, OSRM API | Interactive vector mapping and custom routing. |
| **Backend & Database** | [Supabase](https://supabase.com) (PostgreSQL) | Managed database for vehicle registry, community hazard reports, and real-time data sync. |
| **Serverless API** | Node.js (Vercel Serverless Functions) | Secure proxy for external APIs, CORS isolation, and rate-limiting. |
| **Offline & PWA** | Web App Manifest & Service Worker | Offline route persistence and installable mobile app experience. |

---

## 🛡️ Security & Hardening

EquiNav is built with production security best practices:

- **Row Level Security (RLS)**: Enforced directly on PostgreSQL tables (`vehicles`, `hazards`) to prevent unauthorized data manipulation or deletion via public API keys.
- **API Rate Limiting**: In-memory rate limiting (max 10 req/min per IP) on serverless proxies to prevent DDoS attacks and API key abuse.
- **Strict CORS Policy**: Microservices are restricted to verified domain whitelists, preventing unauthorized cross-origin requests.
- **XSS Sanitization**: Dynamic user input and database values are escaped before DOM insertion.
- **Cache Poisoning Prevention**: Service Worker message payloads are strictly validated against OSRM route schemas and capped at 2 MB before caching.

---

## 🚀 Getting Started Locally

### Prerequisites
- A modern web browser
- [Node.js](https://nodejs.org/) (optional, for local server or Vercel CLI)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Farhad030619/EquiNav.git
   cd EquiNav
   ```

2. **Run locally:**
   You can serve the static files with any local HTTP server:
   ```bash
   npx serve .
   # or with Python:
   python3 -m http.server 3000
   ```

3. **Deploy to Vercel:**
   ```bash
   npm i -g vercel
   vercel
   ```

---

## 📄 License
This project is open-source and licensed under the [MIT License](LICENSE).
