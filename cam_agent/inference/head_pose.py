import numpy as np


def estimate_yaw_angle(keypoints: np.ndarray) -> float:
    """
    Estimate horizontal head yaw angle from nose + ear keypoints.
    Positive = looking right, Negative = looking left.
    Distraction threshold: abs(yaw) > 30 degrees.
    """
    if keypoints is None or len(keypoints) < 5:
        return 0.0

    nose      = keypoints[0][:2]
    left_ear  = keypoints[3][:2]
    right_ear = keypoints[4][:2]

    face_center_x = (left_ear[0] + right_ear[0]) / 2.0
    face_width    = abs(right_ear[0] - left_ear[0])

    if face_width < 1e-6:
        return 0.0

    offset  = (nose[0] - face_center_x) / face_width
    yaw_deg = offset * 100.0

    return float(np.clip(yaw_deg, -90, 90))


def estimate_pitch_angle(keypoints: np.ndarray) -> float:
    """
    Estimate vertical head pitch from how far the nose sits below the eye midpoint.
    Uses pixel coordinates where y increases downward.

    Returned value (approximate degrees):
      ~20–40  → normal frontal posture   (EAR reliable)
      < 8     → head tilted too far up   (EAR unreliable — will produce false drowsy)
      > 60    → head tilted too far down (EAR unreliable)

    Formula: (nose_y - eye_midpoint_y) / inter_ear_width * 90
    """
    if keypoints is None or len(keypoints) < 5:
        return 25.0  # assume frontal

    nose      = keypoints[0][:2]
    left_eye  = keypoints[1][:2]
    right_eye = keypoints[2][:2]
    left_ear  = keypoints[3][:2]
    right_ear = keypoints[4][:2]

    eye_mid_y  = (left_eye[1] + right_eye[1]) / 2.0
    face_width = abs(right_ear[0] - left_ear[0]) + 1e-6

    # Positive when nose is below the eyes (normal), negative when above (looking up)
    pitch_raw = (nose[1] - eye_mid_y) / face_width
    pitch_deg = pitch_raw * 90.0

    return float(np.clip(pitch_deg, -90, 90))

