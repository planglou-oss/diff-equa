import type {
  Catalog,
  Question,
  QuestionContext,
  Solutions,
  SolutionGuide,
} from "./api";
import type {
  ChoiceSet,
  ChoiceResult,
  ChoiceScore,
} from "../features/study/choiceModel";

export type StaticData = {
  schemaVersion: number;
  catalog: Catalog;
  guides: SolutionGuide;
  questions: Question[];
  solutions: Record<string, Solutions>;
  contexts: Record<string, QuestionContext>;
  choices: Record<string, ChoiceSet>;
  grading: Record<string, Record<string, ChoiceResult>>;
  search: Record<string, string>;
};
export class StaticError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
function invalid(message: string): never {
  throw new StaticError("INVALID_REQUEST", message);
}
function integer(value: string | null, fallback: number, max = 100000) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return invalid("ตัวกรองหรือเลขหน้าไม่ถูกต้อง");
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max)
    return invalid("ตัวกรองหรือเลขหน้าไม่ถูกต้อง");
  return number;
}
function ids(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 500 ||
    value.some((v) => typeof v !== "string")
  )
    return invalid("รายการข้อสอบไม่ถูกต้อง");
  return value;
}
function body(options: RequestInit): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(String(options.body ?? "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return invalid("ข้อมูลคำขอไม่ถูกต้อง");
    return parsed as Record<string, unknown>;
  } catch {
    return invalid("ข้อมูลคำขอไม่ถูกต้อง");
  }
}

// Pure local operations shared by the web client and the regression tests.
export function dispatchStatic(
  data: StaticData,
  path: string,
  options: RequestInit = {},
  random = Math.random,
): unknown {
  const url = new URL(path, "https://study.invalid");
  const method = (options.method ?? "GET").toUpperCase();
  const params = url.searchParams;
  if (method === "GET" && url.pathname === "/catalog") return data.catalog;
  if (method === "GET" && url.pathname === "/guides") return data.guides;
  if (method === "GET" && url.pathname === "/questions") {
    const page = integer(params.get("page"), 1);
    const pageSize = integer(params.get("pageSize"), 20, 100);
    const topic = integer(params.get("topicId"), 0);
    const year = integer(params.get("year"), 0);
    const include = params.has("ids")
      ? new Set(ids(params.get("ids") ? params.get("ids")!.split(",") : []))
      : null;
    const exclude = new Set(
      ids(params.get("excludeIds") ? params.get("excludeIds")!.split(",") : []),
    );
    const query = (params.get("q") ?? "").trim().toLowerCase();
    if ([...query].length > 200) invalid("คำค้นยาวเกิน 200 ตัวอักษร");
    const sort = params.get("sort") || "default";
    if (!["default", "year_asc", "year_desc"].includes(sort))
      invalid("รูปแบบเรียงลำดับไม่ถูกต้อง");
    const items = data.questions.filter(
      (q) =>
        (!topic || q.topicId === topic) &&
        (!year || q.year === year) &&
        (!params.get("examType") || q.examType === params.get("examType")) &&
        (!include || include.has(q.id)) &&
        !exclude.has(q.id) &&
        (params.get("choiceOnly") !== "1" || data.choices[q.id]?.available) &&
        (!query || data.search[q.id].includes(query)),
    );
    items.sort(
      (a, b) =>
        (sort === "year_asc"
          ? a.year - b.year
          : sort === "year_desc"
            ? b.year - a.year
            : 0) ||
        a.topicId - b.topicId ||
        a.displayNumber - b.displayNumber ||
        a.id.localeCompare(b.id),
    );
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total: items.length,
      page,
      pageSize,
    };
  }
  const match = /^\/questions\/([^/]+)(?:\/(solutions|context|choices))?$/.exec(
    url.pathname,
  );
  if (method === "GET" && match) {
    const id = decodeURIComponent(match[1]);
    const question = data.questions.find((q) => q.id === id);
    if (!question)
      throw new StaticError("QUESTION_NOT_FOUND", "ไม่พบโจทย์ข้อนี้");
    switch (match[2]) {
      case "solutions":
        return data.solutions[id];
      case "context":
        return data.contexts[id];
      case "choices":
        return (
          data.choices[id] ?? {
            available: false,
            message:
              "ข้อนี้ยังไม่มีตัวเลือก 4 ข้อที่ตรวจเทียบเฉลยต้นฉบับแล้ว สามารถเปิดเฉลยเพื่อทบทวนได้",
          }
        );
      default:
        return question;
    }
  }
  if (method === "POST" && url.pathname === "/practice/sets") {
    const input = body(options);
    const count = Number(input.count),
      topic = Number(input.topicId ?? 0);
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 50 ||
      !Number.isInteger(topic) ||
      topic < 0 ||
      topic > 9
    )
      invalid("เลือกจำนวน 1–50 ข้อและหัวข้อที่มีในคลัง");
    if (
      input.mode !== undefined &&
      input.mode !== "" &&
      input.mode !== "choice"
    )
      invalid("รูปแบบชุดฝึกไม่ถูกต้อง");
    const include =
      input.includeIds == null ? null : new Set(ids(input.includeIds));
    const exclude = new Set(
      input.excludeIds == null ? [] : ids(input.excludeIds),
    );
    const available = data.questions.filter(
      (q) =>
        (!topic || q.topicId === topic) &&
        (!include || include.has(q.id)) &&
        !exclude.has(q.id) &&
        (input.mode !== "choice" || data.choices[q.id]?.available),
    );
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    return {
      items: available.slice(0, count),
      available: available.length,
      requestedCount: count,
    };
  }
  if (method === "POST" && url.pathname === "/choices/check") {
    const input = body(options);
    if (
      !Array.isArray(input.items) ||
      input.items.length < 1 ||
      input.items.length > 50
    )
      invalid("ส่งได้ 1–50 ข้อ");
    const result: ChoiceScore = {
      items: [],
      correct: 0,
      wrong: 0,
      unanswered: 0,
      ungraded: 0,
      total: input.items.length,
    };
    const seen = new Set<string>();
    for (const entry of input.items) {
      if (
        !entry ||
        typeof entry.questionId !== "string" ||
        typeof entry.answer !== "string"
      )
        invalid("คำตอบไม่ถูกต้อง");
      const { questionId, answer } = entry as {
        questionId: string;
        answer: string;
      };
      if (seen.has(questionId)) invalid("ส่งข้อซ้ำไม่ได้");
      seen.add(questionId);
      const key = data.choices[questionId];
      const parts = answer.split(":");
      let item: ChoiceResult;
      if (!key?.available) {
        item = { questionId, status: "unavailable" };
        result.ungraded++;
      } else if (!answer) {
        item = { questionId, status: "unanswered" };
        result.unanswered++;
      } else if (parts.length !== 3 || parts[0] !== "mcq") {
        item = { questionId, status: "legacy" };
        result.ungraded++;
      } else if (parts[1] !== key.version) {
        item = { questionId, status: "stale" };
        result.ungraded++;
      } else {
        const grade = data.grading[questionId]?.[parts[2]];
        if (!grade) invalid("ตัวเลือกไม่ตรงกับโจทย์");
        item = { ...grade };
        if (item.status === "correct") result.correct++;
        else result.wrong++;
      }
      result.items.push(item);
    }
    return result;
  }
  throw new StaticError(
    "UNAVAILABLE",
    "เวอร์ชันเว็บนี้ไม่รองรับบริการดังกล่าว",
  );
}

let pending: Promise<StaticData> | undefined;
export async function staticApi(path: string, options: RequestInit = {}) {
  options.signal?.throwIfAborted();
  if (!pending)
    pending = fetch("/study/data.json", { cache: "no-cache" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("โหลดคลังข้อสอบไม่สำเร็จ กรุณาลองใหม่");
        const data: StaticData = await response.json();
        if (
          data.schemaVersion !== 1 ||
          !Array.isArray(data.questions) ||
          !data.questions.length
        )
          throw new Error("ข้อมูลคลังข้อสอบไม่ถูกต้อง");
        return data;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  const data = await pending;
  options.signal?.throwIfAborted();
  return dispatchStatic(data, path, options);
}

export const REPORTS_KEY = "eemath.local-reports.v1";
type Report = {
  id: string;
  questionId: string;
  kind: string;
  description: string;
  createdAt: string;
};
export function readLocalReports(storage: Pick<Storage, "getItem">): Report[] {
  const raw = storage.getItem(REPORTS_KEY);
  if (!raw) return [];
  const reports: unknown = JSON.parse(raw);
  if (
    !Array.isArray(reports) ||
    reports.some(
      (r) =>
        !r ||
        typeof r.id !== "string" ||
        typeof r.questionId !== "string" ||
        typeof r.description !== "string",
    )
  )
    throw new Error("อ่านบันทึกข้อผิดพลาดในเบราว์เซอร์ไม่สำเร็จ");
  return reports;
}
export function saveLocalReport(
  storage: Pick<Storage, "getItem" | "setItem">,
  questionId: string,
  kind: string,
  description: string,
) {
  description = description.trim();
  if (
    !["question", "original_solution", "ai_explanation", "guide"].includes(
      kind,
    ) ||
    [...description].length < 3 ||
    [...description].length > 2000
  )
    invalid("รายละเอียดต้องมี 3–2,000 ตัวอักษร");
  const reports = readLocalReports(storage);
  const report = {
    id: crypto.randomUUID(),
    questionId,
    kind,
    description,
    createdAt: new Date().toISOString(),
  };
  try {
    storage.setItem(
      REPORTS_KEY,
      JSON.stringify([...reports.slice(-99), report]),
    );
  } catch {
    throw new Error(
      "บันทึกไม่ได้ กรุณาตรวจพื้นที่จัดเก็บหรือสิทธิ์ของเบราว์เซอร์",
    );
  }
  return report;
}
