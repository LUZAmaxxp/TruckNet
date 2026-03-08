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
