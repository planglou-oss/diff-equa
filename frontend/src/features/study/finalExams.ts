import type { Question } from "../../lib/api";

const englishMonths = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const thaiMonths = [
  "ไม่ระบุเดือน",
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
export function finalMonthFromDate(date: string): number {
  const words = date.toLowerCase().match(/[a-z]+/g) ?? [];
  const index = englishMonths.findIndex((month) =>
    words.some((word) => word === month || word === month.slice(0, 3)),
  );
  return index < 0 ? 0 : index + 1;
}
export const finalPaperKey = (year: number, month: number) =>
  year + ":" + month;
export const finalPeriodLabel = (year: number, month?: number) =>
  month === undefined ? year + " (รวมทั้งปี)" : thaiMonths[month] + " " + year;
export type FinalPaper = {
  key: string;
  year: number;
  month: number;
  questions: Question[];
  dates: string[];
  topics: { name: string; count: number }[];
};

// Archive numbers restart for each topic; assign session numbers in the UI.
export function groupFinalPapers(questions: Question[]): FinalPaper[] {
  const groups = new Map<
    string,
    { year: number; month: number; questions: Question[] }
  >();
  const seen = new Set<string>();
  for (const q of questions) {
    if (
      q.examType !== "Final" ||
      !Number.isInteger(q.year) ||
      q.year < 1 ||
      seen.has(q.id)
    )
      continue;
    seen.add(q.id);
    const month = finalMonthFromDate(q.dateLabel);
    const key = finalPaperKey(q.year, month);
    const group = groups.get(key) ?? { year: q.year, month, questions: [] };
    group.questions.push(q);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .sort(([, a], [, b]) => b.year - a.year || b.month - a.month)
    .map(([key, group]) => {
      const ordered = [...group.questions].sort(
        (a, b) =>
          a.topicId - b.topicId ||
          a.displayNumber - b.displayNumber ||
          a.id.localeCompare(b.id),
      );
      const topics = new Map<string, number>();
      for (const q of ordered)
        topics.set(q.topic, (topics.get(q.topic) ?? 0) + 1);
      return {
        key,
        year: group.year,
        month: group.month,
        questions: ordered,
        dates: [...new Set(ordered.map((q) => q.dateLabel))],
        topics: [...topics.entries()].map(([name, count]) => ({ name, count })),
      };
    });
}
