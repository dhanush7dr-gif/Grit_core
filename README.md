# Grit_core
built this as a project using AI only and some personal styling 
How and Why ? 
WHY?
1. I built this I built this cause i am learning to use  'AI'  in programming and how far extent can it and how extreme can it give       the effective and efficient out put compared to manual coding where this  will have time consuming and error's to handle.
2. This is the era where manual intervention is being automated faster than industrialization and this specific field in computer         science is spreading so fast it has taken major small simple jobs , eg: data entry , data analysing etc. White-collar, knowledge-based, and routine administrative roles are the jobs most heavily affected by AI. Rather than eliminating entire professions overnight,Almost no entire profession has been 100% wiped out yet, but specific entry-level positions, repetitive back-office roles, and routine freelance jobs are actively being eliminated as companies replace headcount with AI tools.
3. [I am not AI i am a HUMAN learner and can do mistakes if any issue found from my side let me know]

HOW?
# GRITCORE — Fitness Tracker

GRITCORE is a responsive, browser-based fitness tracker for bodyweight workouts and outdoor walking or running. It uses a warm desert-inspired interface and keeps workout history and profile details in the browser.

## Features

- **Activity dashboard:** Today, week, and month summaries for workouts, reps, minutes, and goals.
- **Workout logging:** Record exercises, sets, reps, duration, and optional notes; add custom activities.
- **Camera rep counter:** On-device pose tracking for supported push-up variations and sit-ups, with pose feedback and a rep count.
- **Walk/run tracker:** Choose walking or running, time an activity, estimate steps from device motion, and record distance from GPS when available.
- **History and profile:** Review or remove saved sessions, set a weekly goal, and store optional profile details.
- **Responsive interface:** Desktop navigation and mobile bottom navigation adapt to screen size.
- **Installable app shell:** A web manifest and service worker support installation and offline access to cached app files.

> Sensor readings are estimates, not medical measurements. Camera pose feedback supports a limited set of exercises and should not be treated as a substitute for coaching. Walking/running step tracking requires compatible motion sensors; GPS requires location permission. Browser sensor APIs generally require HTTPS or localhost.

## Project structure

```text
fitness-app/
├── index.html             # App markup, dashboard, workout, history, and profile views
├── style.css              # Desert theme, layout, responsive rules, and component styles
├── app.js                 # Navigation, storage, workout logging, camera pose tracking,
│                          # and walk/run activity tracking
├── service-worker.js      # Caches the static app shell for offline use
├── manifest.webmanifest   # Installable PWA metadata and icon declarations
├── icon.svg               # Vector favicon
├── icon-192.png           # PWA icon (192 × 192)
├── icon-512.png           # PWA icon (512 × 512)
└── README.md              # Project overview and setup instructions
```

## How it is built

This is a static, single-page web app. It uses:

- **HTML** for the app views and forms.
- **CSS** for the responsive desert-inspired interface.
- **Vanilla JavaScript** for app state, navigation, persistence, and sensor features.
- **Browser APIs** including `localStorage`, `getUserMedia`, `DeviceMotionEvent`, and `Geolocation`.
- **MediaPipe Tasks Vision** loaded dynamically from jsDelivr for camera-based pose landmarks. Its pose model is loaded from Google-hosted assets.

There is no backend, package manager, or build step. Workout and profile data are stored locally in the current browser using the `gritcore-workouts-v1` and `gritcore-profile-v1` local-storage keys. Camera video is processed in the browser and is not saved by the app.

### Main code areas

- **`index.html`** defines four app views: dashboard, workout, history, and profile. It also declares desktop/mobile navigation and the activity controls.
- **`style.css`** defines shared colors and components, then adds responsive breakpoints for tablet and mobile layouts.
- **`app.js`** initializes the UI and contains the core behavior:
  - Local storage, workout summaries, and history rendering.
  - View navigation and profile editing.
  - Motion-based step estimation, GPS distance, activity timing, and save/pause controls.
  - Camera permission handling, MediaPipe initialization, pose drawing, posture messages, and rep counting.
- **`service-worker.js`** precaches the static app files and serves cached same-origin requests when available.
- **`manifest.webmanifest`** supplies the app name, display mode, theme colors, and icons for installation.

## Run locally

Use a local web server rather than opening `index.html` directly. This enables browser APIs that require a secure context.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in a modern browser. For camera pose tracking, allow camera access and keep an internet connection available for the initial MediaPipe/model download. For outdoor tracking, allow location access and use a device with GPS and motion sensors.

## Deploy to GitHub Pages

1. Push the project files to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select the branch and root folder, then save.
4. Open the published HTTPS URL. HTTPS is required by browsers for camera, motion, and location features on deployed sites.

The app does not connect to Samsung Health or synchronize with a health platform; its activity features use browser/device sensors directly.
