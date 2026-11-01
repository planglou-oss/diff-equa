import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { ErrorNotice, MathHTML } from "../../components/Content";
import { choiceStatus, choiceToken, selectedChoice } from "./choiceModel";
import type { ChoiceSet, ChoiceResult, ChoiceScore } from "./choiceModel";

const escapeHTML = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function ChoiceAnswer({
  questionId,
  answer,
  onChange,
  locked = false,
  readOnly = false,
  result,
}: {
  questionId: string;
  answer: string;
  onChange: (answer: string) => void;
  locked?: boolean;
  readOnly?: boolean;
  result?: ChoiceResult;
}) {
  const query = useQuery({
    queryKey: ["choices", questionId],
    queryFn: ({ signal }) =>
      api<ChoiceSet>(`/questions/${questionId}/choices`, { signal }),
  });
  const [checked, setChecked] = useState<ChoiceResult>();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setChecked(undefined);
    setError(null);
  }, [answer, questionId]);
  if (query.isPending) return <p role="status">กำลังโหลดตัวเลือก…</p>;
  if (query.error)
    return <ErrorNotice error={query.error} retry={() => query.refetch()} />;
  const set = query.data;
  if (!set.available) return <p className="notice">{set.message}</p>;
  const selected = selectedChoice(set, answer);
  const feedback = readOnly ? result : checked;
  return (
    <section className="choice-answer">
      <fieldset disabled={readOnly || busy}>
        <legend>เลือกคำตอบ 1 จาก 4 ตัวเลือก</legend>
        <MathHTML html={`<p>${escapeHTML(set.prompt ?? "")}</p>`} />
        <div className="choice-options">
          {set.options?.map((o, i) => (
            <label
              key={o.id}
              className={`choice-option ${selected === o.id ? "selected" : ""} ${feedback?.correctOptionId === o.id ? "correct" : ""}`}
            >
              <input
                type="radio"
                name={`choice-${questionId}`}
                value={o.id}
                checked={selected === o.id}
                onChange={() => onChange(choiceToken(set.version!, o.id))}
              />
              <b>{["ก", "ข", "ค", "ง"][i]}.</b>
              <MathHTML html={`<p>$${escapeHTML(o.latex)}$</p>`} />
            </label>
          ))}
        </div>
      </fieldset>
      <small>{set.sourceLabel} · บันทึกตัวเลือกอัตโนมัติ</small>
      {answer && !selected && (
        <p className="info">
          คำตอบเดิมไม่ตรงกับชุดตัวเลือกปัจจุบัน
          {readOnly ? "" : " กรุณาเลือกใหม่"}
        </p>
      )}
      {!readOnly && !locked && (
        <button
          className="primary-button"
          disabled={!selected || busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const score = await api<ChoiceScore>("/choices/check", {
                method: "POST",
                body: JSON.stringify({ items: [{ questionId, answer }] }),
              });
              setChecked(score.items[0]);
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "กำลังตรวจ…" : "ตรวจคำตอบจากเฉลย"}
        </button>
      )}
      {locked && <p className="info">ระบบจะตรวจและแสดงคะแนนเมื่อจบชุดฝึก</p>}
      {error !== null && <ErrorNotice error={error} />}
      {feedback && !locked && (
        <div className={`choice-feedback ${feedback.status}`} role="status">
          <b>{choiceStatus[feedback.status]}</b>
          {feedback.feedback && (
            <MathHTML html={`<p>${escapeHTML(feedback.feedback)}</p>`} />
          )}
          {feedback.correctLatex && (
            <MathHTML
              html={`<p>คำตอบที่ถูก: $${escapeHTML(feedback.correctLatex)}$</p>`}
            />
          )}
          {feedback.explanation && (
            <MathHTML html={`<p>${escapeHTML(feedback.explanation)}</p>`} />
          )}
          {feedback.sourceUrl && (
            <a href={feedback.sourceUrl} target="_blank" rel="noreferrer">
              เปิดภาพเฉลยต้นฉบับเพื่อเทียบ →
            </a>
          )}
        </div>
      )}
    </section>
  );
}
