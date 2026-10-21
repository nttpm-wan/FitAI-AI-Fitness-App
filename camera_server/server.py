"""Local webcam Pose Landmarker service for FITAI's Camera AI screen."""

import asyncio
import base64
import hmac
import math
import os
import secrets
import threading
import time
from pathlib import Path

import cv2
import mediapipe as mp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


ROOT = Path(__file__).parent
MODEL_PATH = Path(os.getenv("FITAI_POSE_MODEL", ROOT / "pose_landmarker_lite.task"))
CAMERA_INDEX = int(os.getenv("FITAI_CAMERA_INDEX", "0"))
PORT = int(os.getenv("FITAI_POSE_PORT", "8000"))
EXERCISES = ["Squat", "Push-up"]
LANDMARKS = mp.tasks.vision.PoseLandmark
PAIRING_TOKEN = os.getenv("FITAI_POSE_TOKEN") or secrets.token_urlsafe(18)

app = FastAPI(title="FITAI Pose Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)
camera_lock = threading.Lock()


@app.get("/health")
def health():
    return {"ok": True, "service": "fitai-pose-service", "model_ready": MODEL_PATH.exists()}


@app.get("/exercises")
def exercises():
    return {"exercises": EXERCISES}


def angle(a, b, c):
    """Return the angle ABC in degrees from normalized x/y landmarks."""
    ba = (a.x - b.x, a.y - b.y)
    bc = (c.x - b.x, c.y - b.y)
    denominator = math.hypot(*ba) * math.hypot(*bc)
    if denominator < 1e-6:
        return None
    cosine = max(-1.0, min(1.0, (ba[0] * bc[0] + ba[1] * bc[1]) / denominator))
    return math.degrees(math.acos(cosine))


def visible_side(landmarks, triplets):
    candidates = []
    for indices, label in triplets:
        points = [landmarks[index] for index in indices]
        visibility = min(float(getattr(point, "visibility", 1.0) or 0.0) for point in points)
        value = angle(*points)
        if value is not None:
            candidates.append((visibility, value, label, points))
    return max(candidates, default=None, key=lambda item: item[0])


def draw_pose(frame, landmarks):
    height, width = frame.shape[:2]
    connections = mp.tasks.vision.PoseLandmarksConnections.POSE_LANDMARKS
    for connection in connections:
        first, second = int(connection.start), int(connection.end)
        a, b = landmarks[first], landmarks[second]
        if min(float(getattr(a, "visibility", 1.0) or 0.0), float(getattr(b, "visibility", 1.0) or 0.0)) < 0.35:
            continue
        p1 = (int(a.x * width), int(a.y * height))
        p2 = (int(b.x * width), int(b.y * height))
        cv2.line(frame, p1, p2, (40, 210, 110), 3, cv2.LINE_AA)
    for point in landmarks:
        if float(getattr(point, "visibility", 1.0) or 0.0) < 0.35:
            continue
        cv2.circle(frame, (int(point.x * width), int(point.y * height)), 4, (255, 135, 45), -1, cv2.LINE_AA)


def evaluate_pose(landmarks, exercise, rep_state):
    joints = {}
    phase = "-"
    rep_count = rep_state["count"]
    if exercise == "Squat":
        knee = visible_side(landmarks, [
            ((LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE), "Left knee"),
            ((LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE), "Right knee"),
        ])
        if knee:
            visibility, current, label, _ = knee
            status = "ok" if 75 <= current <= 115 or current >= 155 else "warning"
            joints["knee"] = {"label": label, "status": status, "diff": round(min(abs(current - 95), abs(current - 170)), 1), "current": round(current, 1), "ref": 95 if current < 130 else 170}
            if current < 105:
                phase = "down"
                rep_state["low"] = True
            elif current > 155:
                phase = "up"
                if rep_state["low"]:
                    rep_count += 1
                    rep_state["low"] = False
    elif exercise == "Push-up":
        elbow = visible_side(landmarks, [
            ((LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST), "Left elbow"),
            ((LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST), "Right elbow"),
        ])
        if elbow:
            _, current, label, _ = elbow
            status = "ok" if current <= 100 or current >= 155 else "warning"
            joints["elbow"] = {"label": label, "status": status, "diff": round(min(abs(current - 90), abs(current - 170)), 1), "current": round(current, 1), "ref": 90 if current < 125 else 170}
            if current < 100:
                phase = "down"
                rep_state["low"] = True
            elif current > 155:
                phase = "up"
                if rep_state["low"]:
                    rep_count += 1
                    rep_state["low"] = False

        # A visible shoulder-hip-ankle line gives simple plank alignment feedback.
        for side in ("LEFT", "RIGHT"):
            shoulder = landmarks[getattr(LANDMARKS, f"{side}_SHOULDER")]
            hip = landmarks[getattr(LANDMARKS, f"{side}_HIP")]
            ankle = landmarks[getattr(LANDMARKS, f"{side}_ANKLE")]
            visibility = min(float(getattr(point, "visibility", 1.0) or 0.0) for point in (shoulder, hip, ankle))
            body_angle = angle(shoulder, hip, ankle)
            if body_angle is not None and visibility >= 0.35:
                deviation = abs(180 - body_angle)
                status = "ok" if deviation <= 20 else "warning"
                joints["body_line"] = {"label": "Body line", "status": status, "diff": round(deviation, 1), "current": round(body_angle, 1), "ref": 180}
                break
    rep_state["count"] = rep_count
    return rep_count, phase, joints


def encode_frame(frame):
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 62])
    return base64.b64encode(buffer).decode("ascii") if ok else ""


@app.websocket("/stream")
async def stream(websocket: WebSocket):
    await websocket.accept()
    try:
        auth_message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
    except asyncio.TimeoutError:
        await websocket.close(code=1008, reason="Pairing code required")
        return
    except (WebSocketDisconnect, ValueError):
        return

    supplied_token = auth_message.get("token", "") if isinstance(auth_message, dict) else ""
    token_matches = (
        isinstance(supplied_token, str)
        and hmac.compare_digest(supplied_token.encode("utf-8"), PAIRING_TOKEN.encode("utf-8"))
    )
    if not token_matches:
        await websocket.send_json({"error": "Pairing code is incorrect. Copy the current code from the Pose server terminal."})
        await websocket.close(code=1008, reason="Invalid pairing code")
        return
    await websocket.send_json({"type": "authenticated"})

    if not camera_lock.acquire(blocking=False):
        await websocket.send_json({"error": "Camera is already in use by another FITAI client."})
        await websocket.close(code=1013)
        return

    capture = None
    landmarker = None
    receive_task = None
    try:
        if not MODEL_PATH.is_file():
            await websocket.send_json({"error": f"Pose model not found. Run: python download_model.py (expected {MODEL_PATH})"})
            await websocket.close(code=1011)
            return
        capture = cv2.VideoCapture(CAMERA_INDEX)
        if not capture.isOpened():
            await websocket.send_json({"error": f"Could not open webcam index {CAMERA_INDEX}. Set FITAI_CAMERA_INDEX if needed."})
            await websocket.close(code=1011)
            return

        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(options)
        exercise = "Squat"
        rep_state = {"count": 0, "low": False}
        last_sent = 0.0
        receive_task = asyncio.create_task(websocket.receive_json())
        while True:
            while websocket.client_state.name == "CONNECTED" and websocket.application_state.name == "CONNECTED":
                if receive_task.done():
                    message = receive_task.result()
                    if isinstance(message, dict):
                        selection = message.get("exercise")
                        next_exercise = selection if selection in EXERCISES else None
                        if next_exercise != exercise:
                            rep_state = {"count": 0, "low": False}
                        exercise = next_exercise
                    receive_task = asyncio.create_task(websocket.receive_json())

                ok, frame = await asyncio.to_thread(capture.read)
                if not ok:
                    await asyncio.sleep(0.1)
                    continue
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = await asyncio.to_thread(landmarker.detect, image)
                detected = bool(result.pose_landmarks)
                rep_count, phase, joints = (rep_state["count"], "-", {})
                if detected:
                    landmarks = result.pose_landmarks[0]
                    draw_pose(frame, landmarks)
                    if exercise:
                        rep_count, phase, joints = evaluate_pose(landmarks, exercise, rep_state)
                if exercise:
                    cv2.putText(frame, f"{exercise}  Reps: {rep_count}  {phase}", (16, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (245, 245, 245), 2, cv2.LINE_AA)
                now = time.monotonic()
                if now - last_sent >= 1 / 6:
                    statuses = [item["status"] for item in joints.values()]
                    payload = {
                        "frame": encode_frame(frame),
                        "pose_detected": detected,
                        "rep_count": rep_count,
                        "phase": phase,
                        "joints": joints,
                        "ok": statuses.count("ok"),
                        "warning": statuses.count("warning"),
                        "error": statuses.count("error"),
                    }
                    await websocket.send_json(payload)
                    last_sent = now
                await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    finally:
        if receive_task is not None and not receive_task.done():
            receive_task.cancel()
        if landmarker is not None:
            landmarker.close()
        if capture is not None:
            capture.release()
        camera_lock.release()


if __name__ == "__main__":
    import uvicorn

    if os.getenv("FITAI_POSE_TOKEN"):
        print("FITAI Pose service pairing is enabled with FITAI_POSE_TOKEN.")
    else:
        print(f"FITAI Pose service pairing code: {PAIRING_TOKEN}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=False)
