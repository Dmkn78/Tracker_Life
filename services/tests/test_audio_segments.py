from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from audio_segments import SAMPLE_RATE, SEGMENT_SECONDS, OVERLAP_SECONDS, append_segment, segment_ranges


class AudioSegmentTests(unittest.TestCase):
    def test_thirty_minutes_stay_bounded_and_cover_every_sample(self):
        total = 30 * 60 * SAMPLE_RATE
        segments = list(segment_ranges(total))
        self.assertEqual(segments[0][0], 0)
        self.assertEqual(segments[-1][1], total)
        for start, end in segments:
            self.assertGreater(end, start)
            self.assertLessEqual(end - start, SEGMENT_SECONDS * SAMPLE_RATE)
        for previous, current in zip(segments, segments[1:]):
            self.assertEqual(previous[1] - current[0], OVERLAP_SECONDS * SAMPLE_RATE)

    def test_short_and_exact_boundary_audio_have_no_spurious_last_chunk(self):
        self.assertEqual(list(segment_ranges(0)), [])
        self.assertEqual(list(segment_ranges(100)), [(0, 100)])
        limit = SEGMENT_SECONDS * SAMPLE_RATE
        self.assertEqual(list(segment_ranges(limit)), [(0, limit)])
        self.assertEqual(len(list(segment_ranges(limit + 1))), 2)

    def test_overlap_removes_repeated_words_across_punctuation_and_case(self):
        self.assertEqual(append_segment("Bonjour le monde.", "Le monde est grand."), "Bonjour le monde est grand.")
        self.assertEqual(append_segment("J’ai fini aujourd’hui.", "Aujourd’hui. Demain je continue."), "J’ai fini aujourd’hui. Demain je continue.")

    def test_nonoverlapping_and_empty_speech_are_preserved(self):
        self.assertEqual(append_segment("", " Bonjour. "), "Bonjour.")
        self.assertEqual(append_segment("Bonjour.", ""), "Bonjour.")
        self.assertEqual(append_segment("Oui oui.", "Non."), "Oui oui. Non.")
