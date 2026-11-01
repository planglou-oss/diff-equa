export type Image = { url: string; width: number; height: number };
export type Question = {
  id: string;
  topicId: number;
  topic: string;
  displayNumber: number;
  examType: string;
  examTypeRaw: string;
  dateLabel: string;
  year: number;
  sourceLabel: string;
  questionImage: Image;
  hasOriginalSolution: boolean;
  hasAIExplanation: boolean;
  tags?: string[];
};
export type AskTutor = (question: Question, prompt?: string) => void;
export type Guide = {
  topicId: number;
  title: string;
  tags: string[];
  formulas: { title: string; latex: string; note: string }[];
  hints: string[];
  checks: string[];
  mistakes: string[];
  source: string;
};
export type SolutionGuide = {
  items: Guide[];
  questionHints: Record<string, string[]>;
};
export type Catalog = {
  topics: { id: number; name: string; totalCount: number }[];
  years: number[];
  examTypes: string[];
  aiAvailable: boolean;
};
export type Solutions = {
  original: Image;
  aiExplanation: null | {
    bodyHtml: string;
    reviewStatus: string;
    origin: string;
  };
};
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: string;
};
export type QuestionContext = {
  questionId: string;
  text: string;
  source: string;
  reviewStatus: string;
};
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch("/api/v1" + path, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new APIError(
      res.status,
      data?.error?.code ?? "REQUEST_FAILED",
      data?.error?.message ?? "ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ",
    );
  }
  return res.json();
}
export async function streamMessage(
  id: string,
  message: string,
  questionText: string,
  signal: AbortSignal,
  onEvent: (event: string, data: Record<string, string>) => void,
) {
  const res = await fetch(`/api/v1/conversations/${id}/messages`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      questionText,
      clientRequestId: crypto.randomUUID(),
    }),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new APIError(
      res.status,
      data?.error?.code ?? "AI_REQUEST_FAILED",
      data?.error?.message ?? "AI ตอบไม่สำเร็จ",
    );
  }
  if (!res.body) throw new Error("ไม่สามารถอ่านคำตอบได้");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "",
    finished = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n");
      let index;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        let event = "message";
        const lines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) lines.push(line.slice(5).trimStart());
        }
        if (!lines.length) continue;
        const data = JSON.parse(lines.join("\n"));
        onEvent(event, data);
        if (event === "error")
          throw new APIError(
            200,
            data.code ?? "AI_GENERATION_FAILED",
            data.message ?? "AI ตอบไม่สำเร็จ",
          );
        if (event === "done") finished = true;
      }
      if (done) break;
    }
    if (!finished) throw new Error("การเชื่อมต่อขาดก่อนตอบเสร็จ กรุณาลองใหม่");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
