# FITAI

FITAI is a React Native app built with Expo. It includes the supplied screens for training, nutrition, progress, community, goals, sleep, notifications, and profile settings. Local device storage works without a Supabase project; Supabase can be enabled with environment variables.

## Start the app

Install Node.js 22.13 or newer, then run:

```powershell
npm install
npm run start
```

Press `a` in the Expo terminal to open an Android emulator, or scan the QR code with Expo Go on a device. The project uses Expo SDK 57 and React Navigation 7.

## Exercise Library API

The app reads the exercise list from a local HTTP endpoint and falls back to its bundled catalog when the API is unavailable.

Start the API in a separate terminal:

```powershell
npm run api
```

The endpoint is `http://localhost:8001/exercises`. Android emulators use `http://10.0.2.2:8001`. For a physical phone, copy `.env.example` to `.env` and set `EXPO_PUBLIC_EXERCISE_API_BASE_URL` to the development computer's LAN IP, for example `http://192.168.1.20:8001`.

## Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`, then `supabase/migrations/002_harden_security.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env`, then add the project URL and publishable key.
4. Restart Expo after changing environment variables.

The app keeps per-user data in AsyncStorage when Supabase is not configured or is temporarily unavailable. Local accounts are for development only and do not synchronize between devices. Use Supabase Auth for shared accounts; do not ship local-only authentication as a production account system. The Expo client must only contain Supabase publishable keys, never a service-role key.

## Analytics and crash log

Screen views and crash type/context are saved locally. When Supabase is configured, authenticated events are also written to `analytics_events`; raw exception messages and stack traces are not sent. The app does not record form values, email addresses, or camera frames.

## Security notes

- Apply both database migrations in order. Migration `002_harden_security.sql` restricts profile/workout writes, moves workout score updates into a bounded database function, and separates likes from post rows.
- Workout history is still self-reported. A signed-in user can submit up to 20 workout entries in 24 hours, so leaderboard points are not proof of verified exercise.
- Local-only accounts are for development and use a lightweight local password hash. Use Supabase Auth for real accounts.
- The Pose pairing code protects against casual LAN access, but the local `ws://` connection is not encrypted. Use a trusted private network and never port-forward the camera service.

## Pose AI service

The Camera AI screen connects to the local webcam service at `/stream` and reads supported exercises from `/exercises`. The service runs on your development computer and uses MediaPipe Pose Landmarker. It requires Python 3.10 or 3.11, a webcam, and a one-time model download.

In another PowerShell window:

```powershell
cd camera_server
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python download_model.py
python server.py
```

The service listens on `0.0.0.0:8000`; the Android emulator reaches the computer at `http://10.0.2.2:8000`. It prints a random pairing code at startup. Enter that code in the Camera AI screen before starting the stream; it changes when the server restarts. For a physical phone, set `EXPO_PUBLIC_POSE_API_BASE_URL` in `.env` to the computer's LAN IP, such as `http://192.168.1.20:8000`, then restart Expo. The camera feed is processed locally and is only sent to an authenticated app connection as a preview frame; the server does not store images. Use a trusted private Wi-Fi network, and do not forward port 8000 to the internet: local development uses unencrypted `ws://` traffic.

Squat and push-up rep counting and angle feedback are heuristic estimates from visible body landmarks. Use good lighting and position your full body in view; the feedback is not medical advice or a substitute for a coach.
