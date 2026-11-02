import { IS_STATIC } from "../../lib/mode";
import { saveLocalReport, readLocalReports } from "../../lib/staticClient";
import { ChoiceAnswer } from "./ChoiceAnswer";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type {
  AskTutor,
  Question,
  QuestionContext,
  SolutionGuide,
} from "../../lib/api";
import { ErrorNotice, MathHTML, safeStudyHTML } from "../../components/Content";
import { defaultRecord, statusLabels } from "./model";
import type { StudyStatus } from "./model";
import { study, useStudy } from "./store";

export function StudyRuntime() {
  const s = useStudy();
  const p = s.practice;
  useEffect(() => {
    study.finishIfExpired();
    if (!p || p.finishedAt !== null) return;
    const timer = setInterval(() => study.finishIfExpired(), 1000);
    return () => clearInterval(timer);
  }, [p?.id, p?.startedAt, p?.durationSeconds, p?.finishedAt]);
  return s.storageError ? (
    <div className="notice error" role="alert">
      {s.storageError}
    </div>
  ) : null;
}
export function StudyControls({ question: q }: { question: Question }) {
  const s = useStudy();
  const r = s.records[q.id] ?? defaultRecord();
  return (
    <div className="study-controls">
      <label>
        สถานะ{" "}
        <select
          aria-label={`สถานะข้อ ${q.displayNumber}`}
          value={r.status}
          onChange={(e) =>
            study.record(q.id, { status: e.target.value as StudyStatus })
          }
        >
          {Object.entries(statusLabels).map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <button
        className={`chip ${r.favorite ? "on" : ""}`}
        aria-pressed={r.favorite}
        onClick={() => study.record(q.id, { favorite: !r.favorite })}
      >
        {r.favorite ? "★ บันทึกแล้ว" : "☆ เก็บไว้ทบทวน"}
      </button>
      <details className="personal-note">
        <summary>โน้ตส่วนตัว{r.note ? " · มีโน้ต" : ""}</summary>
        <label htmlFor={"note-" + q.id}>วิธีคิด / ข้อสงสัย</label>
        <textarea
          id={"note-" + q.id}
          rows={3}
          maxLength={4000}
          value={r.note}
          onChange={(e) => study.record(q.id, { note: e.target.value })}
        />
        <small>บันทึกอัตโนมัติในเบราว์เซอร์นี้</small>
      </details>
    </div>
  );
}

export function ResumeBanner() {
  const s = useStudy();
  return (
    <div className="resume-banner">
      {s.practice?.finishedAt === null && (
        <Link to="/practice">⏱ ชุดฝึกกำลังจับเวลา · กลับทำต่อ</Link>
      )}
      {s.resumeQuestion && (
        <Link to={"/questions/" + s.resumeQuestion.id}>
          อ่านต่อ: {s.resumeQuestion.title}
        </Link>
      )}
    </div>
  );
}

function ReportForm({ question: q }: { question: Question }) {
  const [kind, setKind] = useState("original_solution");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState("");
  return (
    <details className="report-panel">
      <summary>
        {IS_STATIC ? "บันทึกข้อผิดพลาดส่วนตัว" : "แจ้งข้อผิดพลาด"}
      </summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          setSaved("");
          try {
            if (IS_STATIC) {
              saveLocalReport(localStorage, q.id, kind, description);
              setSaved("บันทึกในเบราว์เซอร์นี้แล้ว · ยังไม่ได้ส่งให้ผู้ดูแล");
              setDescription("");
              return;
            }
            await api("/session", { method: "POST" });
            const result = await api<{ id: string }>(
              `/questions/${q.id}/reports`,
              { method: "POST", body: JSON.stringify({ kind, description }) },
            );
            setSaved("บันทึกรายงานแล้ว · " + result.id.slice(0, 8));
            setDescription("");
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        {IS_STATIC && (
          <p className="info">
            บันทึกเฉพาะในเบราว์เซอร์นี้ ไม่ส่งให้ผู้ดูแล เก็บ 100 รายการล่าสุด
            ดาวน์โหลดเพื่อนำไปแจ้งได้
          </p>
        )}
        <label>
          ส่วนที่พบปัญหา
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="question">โจทย์</option>
            <option value="original_solution">เฉลยต้นฉบับ</option>
            <option value="ai_explanation">คำอธิบาย AI</option>
            <option value="guide">สูตร / คำใบ้</option>
          </select>
        </label>
        <label>
          รายละเอียด
          <textarea
            minLength={3}
            maxLength={2000}
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button className="chip" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึกแจ้งข้อผิดพลาด"}
        </button>
        {IS_STATIC && (
          <button
            type="button"
            className="chip"
            onClick={() => {
              try {
                const url = URL.createObjectURL(
                  new Blob(
                    [JSON.stringify(readLocalReports(localStorage), null, 2)],
                    { type: "application/json" },
                  ),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "ee-math-reports.json";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setError(e);
              }
            }}
          >
            ดาวน์โหลดบันทึกข้อผิดพลาด
          </button>
        )}
        {saved && <p role="status">{saved}</p>}
        {error !== null && <ErrorNotice error={error} />}
      </form>
    </details>
  );
}

export function QuestionText({ question: q }: { question: Question }) {
  const [open, setOpen] = useState(false);
  const result = useQuery({
    queryKey: ["question-context", q.id],
    queryFn: ({ signal }) =>
      api<QuestionContext>(`/questions/${q.id}/context`, { signal }),
    enabled: open,
  });
  return (
    <details
      className="question-text"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>อ่านข้อความโจทย์</summary>
      {result.isPending ? (
        <p role="status">กำลังโหลดข้อความ…</p>
      ) : result.error ? (
        <ErrorNotice error={result.error} />
      ) : (
        result.data && (
          <>
            <p className="text-question-content">{result.data.text}</p>
            <small>
              {result.data.reviewStatus === "reviewed"
                ? "ข้อความตรวจจากภาพแล้ว"
                : "ข้อความ OCR อาจคลาดเคลื่อน โปรดเทียบกับภาพโจทย์"}
            </small>
          </>
        )
      )}
    </details>
  );
}

export function QuestionHelp({
  question: q,
  onAsk,
  showAnswer = true,
}: {
  question: Question;
  onAsk?: AskTutor;
  showAnswer?: boolean;
}) {
  const s = useStudy();
  const [open, setOpen] = useState(() => s.views[q.id]?.help ?? false);
  const [hints, setHints] = useState(() => s.views[q.id]?.hints ?? 0);
  const r = s.records[q.id] ?? defaultRecord();
  const result = useQuery({
    queryKey: ["guides"],
    queryFn: ({ signal }) => api<SolutionGuide>("/guides", { signal }),
    enabled: open,
  });
  const g = result.data?.items.find((g) => g.topicId === q.topicId);
  const specific = result.data?.questionHints[q.id];
  const list = specific ?? g?.hints ?? [];
  return (
    <div className="question-help">
      <button
        className="btn guide"
        aria-expanded={open}
        aria-controls={"help-" + q.id}
        onClick={() => {
          setOpen((v) => !v);
          study.view(q.id, { help: !open });
        }}
      >
        ✿ สูตร คำใบ้ และตรวจคำตอบ {open ? "▴" : "▾"}
      </button>
      {open && (
        <div id={"help-" + q.id} className="help-body">
          {result.isPending ? (
            <p role="status">กำลังโหลดแนวทาง…</p>
          ) : result.error ? (
            <ErrorNotice error={result.error} retry={() => result.refetch()} />
          ) : (
            g && (
              <>
                <h3>
                  คำใบ้ทีละระดับ{" "}
                  <small>{specific ? "สำหรับข้อนี้" : "แนวทางตามหัวข้อ"}</small>
                </h3>
                {list.slice(0, hints).map((text, i) => (
                  <p className="hint" key={i}>
                    <b>คำใบ้ {i + 1}</b> {text}
                  </p>
                ))}
                <button
                  className="chip"
                  disabled={hints >= list.length}
                  onClick={() => {
                    setHints((v) => v + 1);
                    study.view(q.id, { hints: hints + 1 });
                  }}
                >
                  {hints >= list.length ? "แสดงคำใบ้ครบแล้ว" : "เปิดคำใบ้ถัดไป"}
                </button>
                <details>
                  <summary>สูตรที่เกี่ยวข้อง</summary>
                  {g.formulas.map((f) => (
                    <div key={f.title}>
                      <b>{f.title}</b>
                      <MathHTML html={`<p>$$${f.latex}$$</p>`} />
                      <small>{f.note}</small>
                    </div>
                  ))}
                </details>
                <h3>จุดที่มักพลาด</h3>
                <ul>
                  {g.mistakes.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <h3>ตรวจคำตอบด้วยตัวเอง</h3>
                <p className="info">ทำเครื่องหมายเมื่อคุณตรวจแต่ละข้อแล้ว</p>
                {g.checks.map((text, i) => {
                  const id = `${g.topicId}:${i}`;
                  return (
                    <label key={id} className="check-row">
                      <input
                        type="checkbox"
                        checked={r.checks.includes(id)}
                        onChange={(e) =>
                          study.record(q.id, {
                            checks: e.target.checked
                              ? [...r.checks, id]
                              : r.checks.filter((v) => v !== id),
                          })
                        }
                      />
                      {text}
                    </label>
                  );
                })}
                {showAnswer && (
                  <ChoiceAnswer
                    questionId={q.id}
                    answer={r.answer}
                    onChange={(answer) => study.record(q.id, { answer })}
                  />
                )}
                {onAsk && (
                  <div className="tool-actions">
                    <button
                      className="chip"
                      onClick={() =>
                        onAsk(
                          q,
                          "ช่วยอธิบายวิธีทำข้อนี้ทีละขั้น เริ่มจากขั้นแรกก่อนและรอให้ฉันถามต่อ",
                        )
                      }
                    >
                      ถาม AI อธิบายทีละขั้น
                    </button>
                  </div>
                )}
                <small>AI อาจผิดพลาด ควรตรวจการแทนกลับด้วยตัวเอง</small>
                <p>
                  <Link to={"/formulas?topicId=" + q.topicId}>
                    เปิดสารบัญสูตรหัวข้อนี้ →
                  </Link>
                </p>
              </>
            )
          )}
          <ReportForm question={q} />
        </div>
      )}
    </div>
  );
}

export function StepExplanation({
  html,
  questionId,
}: {
  html: string;
  questionId: string;
}) {
  const s = useStudy();
  const [visible, setVisible] = useState(() => s.views[questionId]?.step ?? 1);
  const steps = useMemo(() => {
    const doc = new DOMParser().parseFromString(
      safeStudyHTML(html),
      "text/html",
    );
    const parts: string[] = [];
    let part = "";
    for (const node of doc.body.children) {
      if (node.tagName === "H4" && part) {
        parts.push(part);
        part = "";
      }
      part += node.outerHTML;
    }
    if (part) parts.push(part);
    if (!parts.length) parts.push(safeStudyHTML(html));
    return parts;
  }, [html]);
  return (
    <div className="step-explanation">
      <p className="step-counter">
        แสดงขั้น {Math.min(visible, steps.length)} / {steps.length}
      </p>
      {steps.slice(0, visible).map((text, i) => (
        <div className="solution-step" key={i}>
          <MathHTML html={text} />
        </div>
      ))}
      <div className="tool-actions">
        <button
          className="chip"
          disabled={visible >= steps.length}
          onClick={() => {
            setVisible((v) => v + 1);
            study.view(questionId, { step: visible + 1 });
          }}
        >
          ขั้นถัดไป
        </button>
        {visible < steps.length && (
          <button
            className="chip"
            onClick={() => {
              setVisible(steps.length);
              study.view(questionId, { step: steps.length });
            }}
          >
            เปิดทุกขั้น
          </button>
        )}
      </div>
    </div>
  );
}
