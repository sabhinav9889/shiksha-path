import type { PlacementSection } from '@shiksha/content/schema';
import type { QuizSummary } from './quiz.js';

export interface SectionResult {
  track: string;
  score: number;
  startLesson: string;
  englishOnlySuggested: boolean;
}

/** Guards against 0.8 failing as 0.7999999 after a division. */
const PASS_TOLERANCE = 1e-9;

/** The rule with the highest min_score at or below the score; failing that, the lowest rule. */
function pickStartLesson(section: PlacementSection, score: number): string {
  const rules = [...section.start_rules].sort((a, b) => b.min_score - a.min_score);
  const match = rules.find((r) => r.min_score <= score) ?? rules[rules.length - 1];
  return match?.start_lesson ?? '';
}

export function evaluatePlacementSection(
  section: PlacementSection,
  summary: QuizSummary,
): SectionResult {
  const { score } = summary;
  const threshold = section.suggest_english_only_at;
  return {
    track: section.track,
    score,
    startLesson: pickStartLesson(section, score),
    englishOnlySuggested: threshold !== undefined && score >= threshold,
  };
}

export function evaluateTestOut(
  passMark: number,
  summary: QuizSummary,
): { score: number; passed: boolean } {
  return { score: summary.score, passed: summary.score + PASS_TOLERANCE >= passMark };
}
