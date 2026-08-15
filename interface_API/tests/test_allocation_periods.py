from datetime import date
from types import SimpleNamespace
import unittest

from app.core.allocation_periods import (
    allocation_period_range,
    default_budget_minutes,
    require_canonical_anchor,
)
from app.core.time_allocation import aggregate_actual_minutes, build_effective_plans


class AllocationPeriodTests(unittest.TestCase):
    def test_iso_week_is_monday_through_sunday(self) -> None:
        period_range = allocation_period_range("week", date(2026, 8, 13))
        self.assertEqual(period_range.anchor.isoformat(), "2026-08-10")
        self.assertEqual(period_range.end.isoformat(), "2026-08-16")
        self.assertEqual(period_range.end_exclusive.isoformat(), "2026-08-17")
        self.assertEqual(default_budget_minutes(period_range), 5_040)

    def test_civil_month_uses_its_real_day_count(self) -> None:
        period_range = allocation_period_range("month", date(2028, 2, 18))
        self.assertEqual(period_range.anchor.isoformat(), "2028-02-01")
        self.assertEqual(period_range.end.isoformat(), "2028-02-29")
        self.assertEqual(period_range.maximum_budget_minutes, 29 * 1_440)

    def test_noncanonical_period_anchor_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "canonical week anchor"):
            require_canonical_anchor("week", date(2026, 8, 13))

    def test_daily_actuals_are_aggregated_once_by_category(self) -> None:
        totals, grand_total = aggregate_actual_minutes([
            SimpleNamespace(categoryId="deep", actualMinutes=90),
            SimpleNamespace(categoryId="deep", actualMinutes=30),
            SimpleNamespace(categoryId="sport", actualMinutes=45),
        ])
        self.assertEqual(totals, {"deep": 120, "sport": 45})
        self.assertEqual(grand_total, 165)

    def test_archived_actuals_do_not_change_the_visible_total(self) -> None:
        totals, grand_total = aggregate_actual_minutes([
            SimpleNamespace(categoryId="active", actualMinutes=90),
            SimpleNamespace(categoryId="archived", actualMinutes=600),
        ], {"active"})
        self.assertEqual(totals, {"active": 90})
        self.assertEqual(grand_total, sum(totals.values()))

    def test_effective_auto_plan_reacts_to_budget_and_weight_changes(self) -> None:
        categories = [
            SimpleNamespace(id="deep", targetWeight=25),
            SimpleNamespace(id="sport", targetWeight=75),
        ]
        stale_auto_row = SimpleNamespace(
            categoryId="deep", plannedMinutes=999, plannedMinutesManual=False
        )
        initial = build_effective_plans(categories, [stale_auto_row], 400)
        self.assertEqual([plan["plannedMinutes"] for plan in initial], [100, 300])

        categories[0].targetWeight = 50
        categories[1].targetWeight = 50
        changed = build_effective_plans(categories, [stale_auto_row], 800)
        self.assertEqual([plan["plannedMinutes"] for plan in changed], [400, 400])

    def test_effective_plan_includes_category_without_persisted_row(self) -> None:
        categories = [
            SimpleNamespace(id="deep", targetWeight=50),
            SimpleNamespace(id="new-category", targetWeight=50),
        ]
        manual_row = SimpleNamespace(
            categoryId="deep", plannedMinutes=120, plannedMinutesManual=True
        )
        plans = build_effective_plans(categories, [manual_row], 600)
        self.assertEqual(len(plans), 2)
        self.assertEqual(plans[0]["plannedMinutes"], 120)
        self.assertEqual(plans[1]["plannedMinutes"], 300)


if __name__ == "__main__":
    unittest.main()
