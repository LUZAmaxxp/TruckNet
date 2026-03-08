import numpy as np

# YOLOv8-pose COCO keypoint indices
# 0=nose, 1=left_eye, 2=right_eye, 3=left_ear, 4=right_ear
LEFT_EYE_IDX  = 1
RIGHT_EYE_IDX = 2
LEFT_EAR_IDX  = 3
RIGHT_EAR_IDX = 4


def eye_aspect_ratio(keypoints: np.ndarray) -> float:
    """
    Compute Eye Aspect Ratio (EAR) from YOLOv8-pose keypoints.
    EAR approximated from eye-to-ear distance and eye-to-nose height.
    Standard drowsiness threshold: EAR < 0.25
    Returns 1.0 (eyes open) when detection is unavailable.
    """
    if keypoints is None or len(keypoints) < 5:
        return 1.0

    left_eye  = keypoints[LEFT_EYE_IDX][:2]
    right_eye = keypoints[RIGHT_EYE_IDX][:2]
    left_ear  = keypoints[LEFT_EAR_IDX][:2]
    right_ear = keypoints[RIGHT_EAR_IDX][:2]
    nose      = keypoints[0][:2]

    left_width  = np.linalg.norm(left_eye  - left_ear)  + 1e-6
    right_width = np.linalg.norm(right_eye - right_ear) + 1e-6

    left_height  = abs(left_eye[1]  - nose[1]) * 0.3
    right_height = abs(right_eye[1] - nose[1]) * 0.3

    ear_left  = left_height  / left_width
    ear_right = right_height / right_width

    return float((ear_left + ear_right) / 2.0)


def classify_eye_state(
    ear: float,
    drowsy_thresh:    float = 0.25,
    microsleep_thresh: float = 0.20
) -> str:
    if ear < microsleep_thresh:
        return "microsleep"
    elif ear < drowsy_thresh:
        return "drowsy"
    return "alert"
