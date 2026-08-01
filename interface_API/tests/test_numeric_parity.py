from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.core.metrics import compute_state_score
from app.core.numbers import javascript_round


class NumericParityTests(unittest.TestCase):
    def test_javascript_round_uses_positive_infinity_for_ties(self) -> None:
        self.assertEqual(javascript_round(52.5), 53)
        self.assertEqual(javascript_round(-1.5), -1)

    def test_daily_log_state_score_matches_legacy_math_round(self) -> None:
        log = SimpleNamespace(
            energy=50,
            productivity=60,
            startFriction=50,
            focusQuality=50,
            mentalFatigue=50,
        )

        self.assertEqual(compute_state_score(log), 53)


if __name__ == "__main__":
    unittest.main()
