import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EventState:
    """
    State machine that prevents duplicate events.
    An event only fires after the condition persists for min_duration_seconds.
    After firing, it cannot fire again for cooldown_seconds.
    """
    min_duration_seconds: float
    cooldown_seconds:     float = 30.0

    _condition_start:    Optional[float] = field(default=None, repr=False)
    _last_fired_at:      Optional[float] = field(default=None, repr=False)

    def update(self, condition_met: bool) -> bool:
        """Call every frame. Returns True exactly once when event should fire."""
        now = time.monotonic()

        if not condition_met:
            self._condition_start = None
            return False

        if self._condition_start is None:
            self._condition_start = now
            return False

        duration = now - self._condition_start
        if duration < self.min_duration_seconds:
            return False

        if self._last_fired_at and (now - self._last_fired_at) < self.cooldown_seconds:
            return False

        self._last_fired_at   = now
        self._condition_start = None
        return True

    def reset(self):
        self._condition_start = None
        self._last_fired_at   = None
