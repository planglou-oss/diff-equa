import { useEffect, useRef, useState } from "react";
import { api, APIError, streamMessage } from "../../lib/api";
import type { Message, Question, QuestionContext } from "../../lib/api";
import { ErrorNotice, Mascot } from "../../components/Content";
import { MathMarkdown } from "../../components/MathMarkdown";

function ThinkingIndicator() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="ai-thinking" role="status">
      <span>กำลังคิด</span>
      <span className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {seconds >= 10 && <small aria-hidden="true">{seconds} วินาที</small>}
    </div>
  );
}

export function Tutor({
  question,
  available,
  onClose,
  initialPrompt = "",
  requestId = 0,
}: {
  question: Question | null;
  available: boolean;
  onClose: () => void;
  initialPrompt?: string;
  requestId?: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [questionText, setQuestionText] = useState("");
  const [contextReviewed, setContextReviewed] = useState(false);
  const usedQuestionText = useRef<string | null>(null);
  const cid = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const feed = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const qid = question?.id;
  useEffect(() => {
    if (initialPrompt) setDraft(initialPrompt);
  }, [initialPrompt, requestId]);
  useEffect(() => {
    let alive = true;
    cid.current = null;
    if (!qid || !available) return;
    setLoading(true);
    setError("");
    const load = async () => {
      const context = await api<QuestionContext>(`/questions/${qid}/context`);
      if (!alive) return;
      const edited = sessionStorage.getItem("question-text:" + qid);
      setQuestionText(edited ?? context.text);
      setContextReviewed(
        edited === null && context.reviewStatus === "reviewed",
      );
      usedQuestionText.current = sessionStorage.getItem(
        "chat-text-used:" + qid,
      );
      await api("/session", { method: "POST" });
      const existing = sessionStorage.getItem("chat:text:" + qid);
      if (existing) {
        try {
          const data = await api<{ items: Message[] }>(
            `/conversations/${existing}/messages`,
          );
          if (alive) {
            cid.current = existing;
            setMessages(data.items);
          }
        } catch (e) {
          if (!(e instanceof APIError) || e.status !== 404) throw e;
          sessionStorage.removeItem("chat:text:" + qid);
        }
      }
    };
    load()
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [qid, available, retry]);
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [messages, busy]);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const send = async () => {
    const text = draft.trim();
    if (
      !text ||
      !question ||
      !questionText.trim() ||
      busy ||
      loading ||
      !available
    )
      return;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    abort.current = controller;
    const aid = crypto.randomUUID();
    let started = false;
    try {
      if (cid.current && usedQuestionText.current !== questionText.trim()) {
        cid.current = null;
        setMessages([]);
        sessionStorage.removeItem("chat:text:" + question.id);
      }
      if (!cid.current) {
        await api("/session", { method: "POST", signal: controller.signal });
        const c = await api<{ id: string }>("/conversations", {
          method: "POST",
          body: JSON.stringify({ questionId: question.id }),
          signal: controller.signal,
        });
        cid.current = c.id;
        sessionStorage.setItem("chat:text:" + question.id, c.id);
        usedQuestionText.current = questionText.trim();
        sessionStorage.setItem(
          "chat-text-used:" + question.id,
          questionText.trim(),
        );
      }
      setDraft("");
      setMessages((v) => [
        ...v,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          status: "completed",
        },
        { id: aid, role: "assistant", content: "", status: "streaming" },
      ]);
      started = true;
      await streamMessage(
        cid.current,
        text,
        questionText.trim(),
        controller.signal,
        (event, data) => {
          if (event === "delta")
            setMessages((v) =>
              v.map((m) =>
                m.id === aid ? { ...m, content: m.content + data.text } : m,
              ),
            );
          if (event === "done")
            setMessages((v) =>
              v.map((m) => (m.id === aid ? { ...m, status: "completed" } : m)),
            );
        },
      );
    } catch (e) {
      const canceled = controller.signal.aborted;
      setError(
        canceled
          ? "หยุดการตอบแล้ว"
          : e instanceof Error
            ? e.message
            : "ส่งข้อความไม่สำเร็จ",
      );
      if (started)
        setMessages((v) =>
          v.map((m) => (m.id === aid ? { ...m, status: "interrupted" } : m)),
        );
      setDraft(text);
    } finally {
      setBusy(false);
      abort.current = null;
      input.current?.focus();
    }
  };
  return (
    <section id="chat" role="dialog" aria-label="Yotsuba AI ผู้ช่วยติว">
      <div className="ch-h">
        <strong>
          <Mascot /> Yotsuba AI
        </strong>
        <button aria-label="ปิดแชต" onClick={onClose}>
          ✕
        </button>
      </div>
      {question ? (
        <div className="chat-context">
          📎 ข้อ {question.displayNumber} · {question.examTypeRaw}{" "}
          {question.dateLabel}
          <small>{question.topic}</small>
        </div>
      ) : (
        <div className="chat-context">
          เลือก “ถาม AI เรื่องข้อนี้” ใต้โจทย์เพื่อเริ่มต้น
        </div>
      )}
      {!available && (
        <div className="notice">
          AI chat ยังไม่เปิดใช้งาน
          <br />
          ผู้ดูแลต้องตั้งค่า Gemini บนเซิร์ฟเวอร์ก่อน
        </div>
      )}
      {question && available && (
        <details className="chat-question-text">
          <summary>ข้อความโจทย์ที่ส่ง AI (แก้ไขได้)</summary>
          <label className="sr-only" htmlFor="question-context-text">
            ข้อความโจทย์ของข้อที่เลือก
          </label>
          <textarea
            id="question-context-text"
            rows={4}
            maxLength={6000}
            value={questionText}
            disabled={loading || busy}
            onChange={(e) => {
              setQuestionText(e.target.value);
              setContextReviewed(false);
              sessionStorage.setItem(
                "question-text:" + question.id,
                e.target.value,
              );
            }}
          />
          <p>
            {contextReviewed
              ? "ข้อความโจทย์ตรวจจากภาพแล้ว"
              : "ข้อความ OCR อาจคลาดเคลื่อนหรือมีเฉลยปน กรุณาตรวจสูตรและเติมข้อมูลกราฟ"}{" "}
            · แก้ข้อความแล้วจะเริ่มบทสนทนาใหม่เมื่อส่ง
          </p>
        </details>
      )}
      <div id="msgs" ref={feed} role="log" aria-label="บทสนทนา">
        {loading ? (
          <div className="info">กำลังโหลดประวัติ…</div>
        ) : (
          messages.length === 0 &&
          question && (
            <div className="chat-welcome">
              <Mascot className="welcome-avatar" />
              <p>ติดตรงไหน ถามได้เลย ✿</p>
              <small>
                ลองถาม “ขอคำใบ้ขั้นแรก” หรือ
                <br />
                “ทำไมถึงเลือกวิธีนี้?”
              </small>
            </div>
          )
        )}
        {messages.map((m) => (
          <div key={m.id} className={`m ${m.role === "user" ? "u" : "b"}`}>
            {m.status === "streaming" ? (
              m.content ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              ) : (
                <ThinkingIndicator />
              )
            ) : (
              <MathMarkdown text={m.content || "ไม่มีคำตอบ"} />
            )}
            {m.status === "interrupted" && (
              <small className="interrupted">คำตอบยังไม่สมบูรณ์</small>
            )}
          </div>
        ))}
      </div>
      {error && (
        <div className="chat-error">
          <ErrorNotice
            error={new Error(error)}
            retry={
              !busy && messages.length === 0
                ? () => setRetry((v) => v + 1)
                : undefined
            }
          />
        </div>
      )}
      <form
        className="ch-f"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="chat-input">
          คำถามถึง AI
        </label>
        <textarea
          ref={input}
          id="chat-input"
          rows={2}
          maxLength={4000}
          disabled={!question || !available || loading}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ถามเกี่ยวกับโจทย์ข้อนี้…"
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()}>
            หยุด
          </button>
        ) : (
          <button
            type="submit"
            disabled={
              !draft.trim() ||
              !questionText.trim() ||
              !question ||
              !available ||
              loading
            }
          >
            ส่ง
          </button>
        )}
      </form>
      <div className="chat-footnote">
        คำตอบจาก AI อาจผิดพลาด ควรตรวจวิธีคิดและคำตอบเสมอ
      </div>
    </section>
  );
}
