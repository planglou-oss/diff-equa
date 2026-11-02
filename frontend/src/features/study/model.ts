import type { Question } from "../../lib/api";

export type StudyStatus = "unseen" | "reviewing" | "understood";
export const statusLabels: Record<StudyStatus, string> = {
  unseen: "ยังไม่ทำ",
  reviewing: "กำลังทบทวน",
  understood: "เข้าใจแล้ว",
};
export type RecordState = {
  status: StudyStatus;
  favorite: boolean;
  note: string;
  answer: string;
  checks: string[];
  updatedAt: number;
};
export type Practice = {
  id: string;
  questions: Question[];
  answers: Record<string, string>;
  index: number;
  startedAt: number;
  durationSeconds: number;
  finishedAt: number | null;
};
export type StudyData = {
  version: 1;
  records: Record<string, RecordState>;
  views: Record<
    string,
    {
      original: boolean;
      explanation: boolean;
      help: boolean;
      hints: number;
      step: number;
    }
  >;
  practice: Practice | null;
  history: Practice[];
  lastList: { url: string; y: number };
  resumeQuestion: { id: string; title: string } | null;
};
export const defaultRecord = (): RecordState => ({
  status: "unseen",
  favorite: false,
  note: "",
  answer: "",
  checks: [],
  updatedAt: 0,
});
export const emptyStudy = (): StudyData => ({
  version: 1,
  records: {},
  views: {},
  practice: null,
  history: [],
  lastList: { url: "/questions", y: 0 },
  resumeQuestion: null,
});
export const validID = (v: unknown): v is string =>
  typeof v === "string" && /^ee201-t\d{2}-q\d{3}$/.test(v);
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function safeListURL(v: unknown) {
  return typeof v === "string" &&
    (v === "/questions" || v.startsWith("/questions?"))
    ? v
    : "/questions";
}

function readPractice(v: unknown): Practice | null {
  if (
    !object(v) ||
    typeof v.id !== "string" ||
    !Array.isArray(v.questions) ||
    v.questions.length < 1 ||
    v.questions.length > 50 ||
    !finite(v.startedAt) ||
    v.startedAt <= 0 ||
    !finite(v.durationSeconds) ||
    v.durationSeconds < 60 ||
    v.durationSeconds > 10800 ||
    !(
      v.finishedAt === null ||
      (finite(v.finishedAt) && v.finishedAt >= v.startedAt)
    )
  )
    return null;
  const questions = v.questions.filter(
    (q: unknown) =>
      object(q) &&
      validID(q.id) &&
      finite(q.topicId) &&
      q.topicId >= 1 &&
      q.topicId <= 9 &&
      typeof q.topic === "string" &&
      typeof q.examTypeRaw === "string" &&
      typeof q.dateLabel === "string" &&
      finite(q.displayNumber) &&
      object(q.questionImage) &&
      typeof q.questionImage.url === "string" &&
      /^\/(?:study\/)?media\/[a-f0-9]{64}\.png$/.test(q.questionImage.url) &&
      finite(q.questionImage.width) &&
      finite(q.questionImage.height),
  ) as Question[];
  if (
    questions.length !== v.questions.length ||
    new Set(questions.map((q) => q.id)).size !== questions.length
  )
    return null;
  const answers: Record<string, string> = {};
  if (object(v.answers))
    for (const q of questions) {
      const a = v.answers[q.id];
      if (typeof a === "string") answers[q.id] = a.slice(0, 3000);
    }
  return {
    id: v.id,
    questions,
    answers,
    index: finite(v.index)
      ? Math.min(questions.length - 1, Math.max(0, Math.floor(v.index)))
      : 0,
    startedAt: v.startedAt,
    durationSeconds: v.durationSeconds,
    finishedAt: v.finishedAt as number | null,
  };
}
export function parseStudy(raw: string | null): StudyData {
  const out = emptyStudy();
  if (!raw) return out;
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!object(input) || input.version !== 1) return out;
  if (object(input.records))
    for (const [id, value] of Object.entries(input.records)) {
      if (!validID(id) || !object(value)) continue;
      out.records[id] = {
        status:
          value.status === "reviewing" || value.status === "understood"
            ? value.status
            : "unseen",
        favorite: value.favorite === true,
        note: typeof value.note === "string" ? value.note.slice(0, 4000) : "",
        answer:
          typeof value.answer === "string" ? value.answer.slice(0, 3000) : "",
        checks: Array.isArray(value.checks)
          ? value.checks
              .filter((s): s is string => typeof s === "string")
              .slice(0, 32)
          : [],
        updatedAt: finite(value.updatedAt) ? value.updatedAt : 0,
      };
    }
  if (object(input.views))
    for (const [id, v] of Object.entries(input.views)) {
      if (validID(id) && object(v))
        out.views[id] = {
          original: v.original === true,
          explanation: v.explanation === true,
          help: v.help === true,
          hints: finite(v.hints)
            ? Math.max(0, Math.min(3, Math.floor(v.hints)))
            : 0,
          step: finite(v.step)
            ? Math.max(1, Math.min(50, Math.floor(v.step)))
            : 1,
        };
    }
  out.practice = readPractice(input.practice);
  if (Array.isArray(input.history))
    out.history = input.history
      .map(readPractice)
      .filter((p): p is Practice => p !== null && p.finishedAt !== null)
      .slice(0, 10);
  if (object(input.lastList))
    out.lastList = {
      url: safeListURL(input.lastList.url),
      y: finite(input.lastList.y)
        ? Math.min(1e7, Math.max(0, input.lastList.y))
        : 0,
    };
  if (
    object(input.resumeQuestion) &&
    validID(input.resumeQuestion.id) &&
    typeof input.resumeQuestion.title === "string"
  )
    out.resumeQuestion = {
      id: input.resumeQuestion.id,
      title: input.resumeQuestion.title.slice(0, 200),
    };
  return out;
}
export function remainingSeconds(p: Practice, now = Date.now()) {
  return Math.max(
    0,
    Math.min(
      p.durationSeconds,
      Math.ceil((p.startedAt + p.durationSeconds * 1000 - now) / 1000),
    ),
  );
}
export function finishPractice(data: StudyData, now = Date.now()): StudyData {
  if (!data.practice || data.practice.finishedAt !== null) return data;
  const done = {
    ...data.practice,
    finishedAt: Math.max(
      data.practice.startedAt,
      Math.min(
        now,
        data.practice.startedAt + data.practice.durationSeconds * 1000,
      ),
    ),
  };
  return {
    ...data,
    practice: done,
    history: [done, ...data.history.filter((p) => p.id !== done.id)].slice(
      0,
      10,
    ),
  };
}
export function studyIDs(
  records: StudyData["records"],
  status: string,
  favorites: boolean,
) {
  const entries = Object.entries(records);
  if (favorites || status === "reviewing" || status === "understood")
    return {
      ids: entries
        .filter(
          ([, r]) =>
            (!favorites || r.favorite) && (!status || r.status === status),
        )
        .map(([id]) => id),
    };
  if (status === "unseen")
    return {
      excludeIds: entries
        .filter(([, r]) => r.status !== "unseen")
        .map(([id]) => id),
    };
  return {};
}
