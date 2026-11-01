export type ChoiceSet = {
  available: boolean;
  message?: string;
  version?: string;
  prompt?: string;
  sourceLabel?: string;
  options?: { id: string; latex: string }[];
};
export type ChoiceResult = {
  questionId: string;
  status:
    "correct" | "wrong" | "unanswered" | "unavailable" | "legacy" | "stale";
  correctOptionId?: string;
  correctLatex?: string;
  explanation?: string;
  feedback?: string;
  sourceUrl?: string;
};
export type ChoiceScore = {
  items: ChoiceResult[];
  correct: number;
  wrong: number;
  unanswered: number;
  ungraded: number;
  total: number;
};
export function choiceToken(version: string, id: string) {
  return `mcq:${version}:${id}`;
}
export function selectedChoice(set: ChoiceSet, answer: string) {
  return set.options?.find(
    (o) => choiceToken(set.version ?? "", o.id) === answer,
  )?.id;
}
export const choiceStatus = {
  correct: "ตอบถูก ✓",
  wrong: "ตอบผิด",
  unanswered: "ยังไม่ได้เลือกคำตอบ",
  unavailable: "ข้อนี้ยังไม่มีเฉลยสำหรับตรวจแบบเลือกตอบ",
  legacy: "คำตอบจากรุ่นเดิมเป็นข้อความ จึงยังไม่ตรวจเป็นคะแนน",
  stale: "เฉลยหรือตัวเลือกได้รับการปรับปรุง คำตอบชุดเก่าจึงยังไม่ตรวจเป็นคะแนน",
};
