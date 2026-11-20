import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Question } from "../../lib/api";
import { ErrorNotice } from "../../components/Content";
import { useStudy } from "./store";
import { groupFinalPapers, finalPeriodLabel } from "./finalExams";

type Page = { items: Question[]; total: number };
async function loadFinalPapers(signal: AbortSignal) {
  const path = "/questions?examType=Final&pageSize=100&page=";
  const first = await api<Page>(path + "1", { signal });
  const rest = await Promise.all(
    Array.from(
      { length: Math.max(0, Math.ceil(first.total / 100) - 1) },
      (_, i) => api<Page>(path + (i + 2), { signal }),
    ),
  );
  return groupFinalPapers([first, ...rest].flatMap((page) => page.items));
}

export function FinalExamSetup({
  onStart,
  onBack,
}: {
  onStart: (
    questions: Question[],
    minutes: number,
    year: number,
    month: number,
  ) => void;
  onBack?: () => void;
}) {
  const { completedFinalPapers } = useStudy();
  const [period, setPeriod] = useState("");
  const [minutes, setMinutes] = useState(180);
  const query = useQuery({
    queryKey: ["final-papers"],
    queryFn: ({ signal }) => loadFinalPapers(signal),
    staleTime: 5 * 60 * 1000,
  });
  if (query.isPending)
    return <p role="status">กำลังรวบรวมข้อสอบ Final แยกตามปีและเดือน…</p>;
  if (query.error)
    return <ErrorNotice error={query.error} retry={() => query.refetch()} />;
  const papers = query.data;
  if (!papers.length)
    return <p className="notice">ยังไม่มีข้อสอบ Final ในคลัง</p>;
  const paper = papers.find((p) => p.key === period) ?? papers[0];
  return (
    <form
      className="setup-card"
      onSubmit={(e) => {
        e.preventDefault();
        onStart(paper.questions, minutes, paper.year, paper.month);
      }}
    >
      <p className="notice">
        รวมทุกข้อที่ระบุว่า Final ของปีและเดือนเดียวกันจากคลังโจทย์
        ไม่สุ่มและไม่ตัดข้อที่ยังไม่มีตัวเลือกออก ชุดนี้อาจไม่ใช่ข้อสอบฉบับเต็ม
        หากต้นฉบับในคลังมีไม่ครบ
      </p>
      <label>
        ปีและเดือนข้อสอบ Final
        <select value={paper.key} onChange={(e) => setPeriod(e.target.value)}>
          {papers.map((p) => (
            <option key={p.key} value={p.key}>
              {completedFinalPapers.includes(p.key) ? "✓ " : ""}Final{" "}
              {finalPeriodLabel(p.year, p.month)} · {p.questions.length} ข้อ
              {completedFinalPapers.includes(p.key) ? " · ทำแล้ว" : ""}
            </option>
          ))}
        </select>
      </label>
      <p className="info">
        ✓ หมายถึงเคยส่งข้อสอบหรือทำจนหมดเวลาแล้ว บันทึกไว้ในเบราว์เซอร์นี้
      </p>
      {paper.month === 0 && (
        <p className="info">
          ต้นฉบับระบุเฉพาะปี จึงแยกเป็นชุด “ไม่ระบุเดือน” และไม่รวมกับเดือนอื่น
        </p>
      )}
      <section aria-labelledby="final-paper-heading">
        <h3 id="final-paper-heading">
          ชุดจำลอง Final {finalPeriodLabel(paper.year, paper.month)} ·{" "}
          {paper.questions.length} ข้อ
        </h3>
        <p className="info">
          เรียงตามหัวข้อและเลขข้อในคลัง โดยกำหนดเลขในชุดใหม่ตั้งแต่ 1
        </p>
        <ul>
          {paper.topics.map((topic) => (
            <li key={topic.name}>
              {topic.name} · {topic.count} ข้อ
            </li>
          ))}
        </ul>
        <p>วันสอบตามข้อมูลต้นฉบับ: {paper.dates.join(" · ")}</p>
        {paper.dates.length > 1 && (
          <p className="info">
            เดือนนี้มีหลายวันสอบ ระบบรวมเฉพาะวันสอบภายในเดือนและปีที่เลือก
          </p>
        )}
      </section>
      <label>
        เวลาสอบ (นาที)
        <input
          type="number"
          min={1}
          max={180}
          required
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </label>
      <p className="info">
        เวลาเริ่มต้น 180 นาทีปรับได้ ไม่ใช่เวลาสอบที่ยืนยันจากต้นฉบับ
        ทำวิธีทำบนกระดาษแล้วทำเครื่องหมายข้อที่ทำแล้วในเว็บ
        เฉลยและคำใบ้จะถูกซ่อนจนส่งข้อสอบหรือหมดเวลา
        ไม่มีคะแนนอัตโนมัติสำหรับชุดนี้
      </p>
      <p className="info">
        ชุดสอบและข้อที่ทำแล้วจะบันทึกในเครื่อง
        เวลาสอบเดินต่อแม้สลับหน้าหรือปิดเว็บ
      </p>
      <button className="primary-button">
        เริ่มจำลอง Final {finalPeriodLabel(paper.year, paper.month)}
      </button>
      {onBack && (
        <button type="button" className="chip" onClick={onBack}>
          กลับชุดก่อนหน้า
        </button>
      )}
    </form>
  );
}
