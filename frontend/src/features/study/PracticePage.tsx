import { useQuery } from "@tanstack/react-query";
import { ChoiceAnswer } from "./ChoiceAnswer";
import type { ChoiceScore } from "./choiceModel";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { AskTutor, Catalog, Question } from "../../lib/api";
import { ErrorNotice } from "../../components/Content";
import { QuestionCard } from "../questions/Questions";
import { remainingSeconds } from "./model";
import { study, useStudy } from "./store";

const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
export function PracticePage({
  catalog,
  onAsk,
}: {
  catalog: Catalog;
  onAsk?: AskTutor;
}) {
  const s = useStudy();
  const p = s.practice;
  const [newSet, setNewSet] = useState(false);
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [minutes, setMinutes] = useState(30);
  const [weak, setWeak] = useState(true);
  const [favorites, setFavorites] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!p || p.finishedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [p?.id, p?.finishedAt]);
  const score = useQuery({
    queryKey: ["choice-score", p?.id, p?.answers],
    queryFn: ({ signal }) =>
      api<ChoiceScore>("/choices/check", {
        method: "POST",
        signal,
        body: JSON.stringify({
          items: p!.questions.map((q) => ({
            questionId: q.id,
            answer: p!.answers[q.id] ?? "",
          })),
        }),
      }),
    enabled: !!p && p.finishedAt !== null,
  });
  if (!p || newSet)
    return (
      <main className="page-wrap">
        <h2>ฝึกทำข้อสอบ ✿</h2>
        <p className="info">
          เลือกหัวข้อและจำนวนข้อ ระบบจะสุ่มข้อไม่ซ้ำกัน
          พร้อมซ่อนเฉลยและคำใบ้จนจบชุดฝึก เลือกตอบ 4 ตัวเลือก
          และตรวจจากเฉลยต้นฉบับ
        </p>
        <form
          className="setup-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setNotice("");
            try {
              const includeIds = favorites
                ? Object.entries(s.records)
                    .filter(([, r]) => r.favorite)
                    .map(([id]) => id)
                : undefined;
              const excludeIds = weak
                ? Object.entries(s.records)
                    .filter(([, r]) => r.status === "understood")
                    .map(([id]) => id)
                : [];
              const result = await api<{
                items: Question[];
                available: number;
              }>("/practice/sets", {
                method: "POST",
                body: JSON.stringify({
                  topicId: Number(topic),
                  mode: "choice",
                  count,
                  includeIds,
                  excludeIds,
                }),
              });
              if (!result.items.length) {
                setNotice(
                  "ไม่พบข้อที่ตรงกับตัวเลือก ลองเปลี่ยนหัวข้อหรือปิดตัวกรองรายการโปรด",
                );
                return;
              }
              study.start(result.items, minutes);
              setNewSet(false);
              if (result.items.length < count)
                setNotice(
                  `มีข้อที่ตรงเงื่อนไข ${result.items.length} ข้อ จึงจัดชุดฝึกตามจำนวนที่มี`,
                );
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="notice">
            ชุดฝึกเลือกเฉพาะข้อที่เตรียม 4 ตัวเลือกโดยเทียบเฉลยต้นฉบับแล้ว
            ข้ออื่นยังอ่านทบทวนได้ในคลังโจทย์
          </p>
          <label>
            หัวข้อ
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">ทุกหัวข้อ</option>
              {catalog.topics
                .filter((t) => t.totalCount > 0)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="setup-row">
            <label>
              จำนวนข้อ
              <input
                type="number"
                min={1}
                max={50}
                required
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
            <label>
              เวลา (นาที)
              <input
                type="number"
                min={1}
                max={180}
                required
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={weak}
              onChange={(e) => setWeak(e.target.checked)}
            />
            สุ่มเฉพาะข้อที่ยังไม่ทำหรือกำลังทบทวน
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={favorites}
              onChange={(e) => setFavorites(e.target.checked)}
            />
            เฉพาะข้อที่เก็บไว้ทบทวน ★
          </label>
          <p className="info">
            เวลาจะเดินต่อเมื่อเปลี่ยนหน้าหรือปิดเบราว์เซอร์
            คำตอบและชุดฝึกบันทึกไว้ในเครื่องนี้
          </p>
          <button className="primary-button" disabled={busy}>
            {busy ? "กำลังสุ่ม…" : "เริ่มทำข้อสอบ"}
          </button>
          {p && (
            <button
              type="button"
              className="chip"
              onClick={() => setNewSet(false)}
            >
              กลับชุดก่อนหน้า
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
          {error !== null && <ErrorNotice error={error} />}
        </form>
      </main>
    );
  const locked = p.finishedAt === null;
  const q = p.questions[p.index];
  const answered = p.questions.filter((q) => p.answers[q.id]?.trim()).length;
  const remaining = remainingSeconds(p, now);
  const elapsed = Math.floor(((p.finishedAt ?? now) - p.startedAt) / 1000);
  return (
    <main className="page-wrap practice-page">
      <div className="practice-heading">
        <div>
          <h2>{locked ? "โหมดฝึกทำข้อสอบ" : "ทบทวนชุดฝึก"}</h2>
          <p className="info">
            ข้อ {p.index + 1} / {p.questions.length} · บันทึกคำตอบแล้ว{" "}
            {answered} ข้อ
          </p>
        </div>
        <div
          className={`timer ${locked && remaining <= 60 ? "urgent" : ""}`}
          role="timer"
          aria-label={locked ? "เวลาที่เหลือ" : "เวลาที่ใช้"}
        >
          {locked ? "เหลือ " : "ใช้เวลา "}
          {time(locked ? remaining : elapsed)}
        </div>
      </div>
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {!locked && (
        <div className="practice-summary" role="status">
          <b>
            {p.finishedAt! >= p.startedAt + p.durationSeconds * 1000
              ? "หมดเวลาแล้ว"
              : "จบชุดฝึกแล้ว"}{" "}
            ✿
          </b>
          <p>
            มีคำตอบที่บันทึก {answered}/{p.questions.length} ข้อ
            เปิดเฉลยด้านล่างแล้วประเมินความเข้าใจของตัวเองได้
          </p>
          <small>
            ตรวจเทียบตัวเลือกกับเฉลยต้นฉบับที่จัดเตรียมไว้ ไม่เรียก AI
          </small>
          {score.isPending ? (
            <p role="status">กำลังตรวจคำตอบจากเฉลย…</p>
          ) : score.error ? (
            <ErrorNotice error={score.error} retry={() => score.refetch()} />
          ) : (
            score.data && (
              <p className="choice-score" role="status">
                คะแนน {score.data.correct}/
                {score.data.total - score.data.ungraded} · ผิด{" "}
                {score.data.wrong} · ไม่ตอบ {score.data.unanswered}
                {score.data.ungraded > 0 &&
                  ` · ตรวจไม่ได้ ${score.data.ungraded} ข้อ (คำตอบเก่าหรือยังไม่มีเฉลยแบบเลือกตอบ)`}
              </p>
            )
          )}
          <div className="tool-actions">
            <button className="chip" onClick={() => setNewSet(true)}>
              สุ่มชุดใหม่
            </button>
            <Link className="chip" to="/progress">
              ดูความคืบหน้า
            </Link>
          </div>
        </div>
      )}
      <div
        className="practice-numbers"
        role="group"
        aria-label="เลือกข้อในชุดฝึก"
      >
        {p.questions.map((item, i) => (
          <button
            key={item.id}
            className={`chip ${i === p.index ? "on" : ""} ${p.answers[item.id]?.trim() ? "answered" : ""}`}
            aria-label={`ข้อฝึก ${i + 1}`}
            aria-current={i === p.index ? "step" : undefined}
            onClick={() => study.practice({ index: i })}
          >
            {i + 1}
            {p.answers[item.id]?.trim() ? " ✓" : ""}
          </button>
        ))}
      </div>
      <QuestionCard
        key={p.id + q.id}
        question={q}
        onAsk={onAsk}
        detail
        locked={locked}
        hideAnswer
      />
      <div className="practice-answer">
        <ChoiceAnswer
          key={p.id + q.id}
          questionId={q.id}
          answer={p.answers[q.id] ?? ""}
          locked={locked}
          readOnly={!locked}
          onChange={(answer) =>
            study.practice({ answers: { ...p.answers, [q.id]: answer } })
          }
          result={score.data?.items.find((item) => item.questionId === q.id)}
        />
      </div>
      <div className="practice-bottom">
        <button
          className="chip"
          disabled={p.index === 0}
          onClick={() => study.practice({ index: p.index - 1 })}
        >
          ← ข้อก่อนหน้า
        </button>
        <button
          className="chip"
          disabled={p.index === p.questions.length - 1}
          onClick={() => study.practice({ index: p.index + 1 })}
        >
          ข้อถัดไป →
        </button>
        {locked && (
          <button className="primary-button" onClick={() => study.finish()}>
            จบชุดฝึกและเปิดเฉลย
          </button>
        )}
      </div>
    </main>
  );
}
