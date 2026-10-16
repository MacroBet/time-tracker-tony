"""Synthetic rows only; no private workbook, provider or database required."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "asset_preflight", Path(__file__).resolve().parents[1] / "scripts/preflight-assets-xlsx.py"
)
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)
HEADERS = [*preflight.CORE, "Optional", "Comments"]


def row(name="Pump A", **changes):
    values = [name, "M", "Plant", "Water", 0, "FR1", "Pump", False, None]
    for header, value in changes.items():
        values[HEADERS.index(header)] = value
    return values


class AssetPreflightTests(unittest.TestCase):
    def test_preserves_provenance_all_rows_and_ambiguous_names(self):
        rows = [(2, row(), []), (3, row(" Pump A ", **{"FR Zone": "FR2"}), []),
                (4, row("pump a"), [])]
        report = preflight.classify_rows(HEADERS, rows)
        self.assertEqual(report["summary"]["candidateRows"], 3)
        self.assertEqual(report["summary"]["duplicateNameGroups"], 1)
        self.assertEqual(report["summary"]["excessRowsByName"], 1)
        self.assertEqual(report["duplicateNames"][0]["sourceRows"], [2, 3])
        self.assertEqual(report["candidateRows"][1]["sourceValues"]["Commissionable Asset"], " Pump A ")
        self.assertEqual(report["summary"]["exactDuplicateGroups"], 0)
        self.assertNotIn("assets", report)
        self.assertNotIn("id", report["candidateRows"][0])

    def test_notes_and_padding_never_become_assets(self):
        report = preflight.classify_rows(HEADERS, [
            (705, ["Template instruction"] + [None] * 8, []),
            (706, [None] * 9, []), (25466, [""] * 9, []),
            (707, [None] * 8 + ["Keep this note"], []),
        ])
        self.assertEqual(report["summary"]["candidateRows"], 0)
        self.assertEqual(report["summary"]["blankRows"], 2)
        self.assertEqual([item["sourceRow"] for item in report["excludedRows"]], [705, 707])
        self.assertEqual(report["excludedRows"][0]["sourceValues"]["Commissionable Asset"], "Template instruction")

    def test_false_and_zero_are_values_not_missing_inputs(self):
        report = preflight.classify_rows(HEADERS, [(2, row(), [])])
        entry = report["candidateRows"][0]
        self.assertEqual(entry["missingCoreFields"], [])
        self.assertNotIn("Optional", entry["missingSourceFields"])
        self.assertIs(entry["sourceValues"]["Optional"], False)
        self.assertEqual(entry["sourceValues"]["Design phase"], 0)

    def test_partial_records_are_retained_with_missing_fields(self):
        report = preflight.classify_rows(HEADERS, [(21, row("", **{"Discipline": None}), [])])
        self.assertEqual(report["summary"]["candidateRows"], 1)
        self.assertEqual(report["summary"]["rowsWithMissingCoreFields"], 1)
        self.assertEqual(report["candidateRows"][0]["missingCoreFields"], ["Commissionable Asset", "Discipline"])
        self.assertTrue(report["candidateRows"][0]["requiresReview"])

    def test_formula_cache_is_unverified_and_never_evaluated(self):
        formula = {"cell": "F2", "formula": '=HYPERLINK("https://example.invalid", "FR2")',
                   "cachedValue": None, "cacheVerified": False}
        report = preflight.classify_rows(HEADERS, [(2, row(**{"FR Zone": None}), [formula])])
        self.assertEqual(report["summary"]["formulaCellsWithoutCachedValue"], 1)
        self.assertIsNone(report["candidateRows"][0]["sourceValues"]["FR Zone"])
        self.assertEqual(report["candidateRows"][0]["formulas"], [formula])
        self.assertTrue(report["candidateRows"][0]["requiresReview"])

    def test_exact_duplicates_are_reported_without_dropping_rows(self):
        report = preflight.classify_rows(HEADERS, [(2, row(), []), (9, row(), [])])
        self.assertEqual(report["exactDuplicateSourceRows"], [[2, 9]])
        self.assertEqual(report["summary"]["candidateRows"], 2)

    def test_unknown_or_ambiguous_layout_fails_closed(self):
        for headers in [HEADERS[1:], HEADERS + [HEADERS[0]], HEADERS + [""]]:
            with self.assertRaises(ValueError):
                preflight.classify_rows(headers, [])
        with self.assertRaises(ValueError):
            preflight.classify_rows(HEADERS, [(2, ["short row"], [])])


if __name__ == "__main__":
    unittest.main()
