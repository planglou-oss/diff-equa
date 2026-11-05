import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { Catalog, Question, SolutionGuide } from "../../lib/api";
import { ErrorNotice, MathHTML } from "../../components/Content";
import { defaultRecord, statusLabels } from "./model";
import { study, useStudy } from "./store";
import { formulaSummaries } from "./formulaSummaries";

export function FormulaPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const result = useQuery({
    queryKey: ["guides"],
    queryFn: ({ signal }) => api<SolutionGuide>("/guides", { signal }),
  });
  const topic = params.get("topicId") ?? "";
  const text = search.trim().toLowerCase();
  const guides = result.data?.items.filter(
    (g) =>
      (!topic || g.topicId === Number(topic)) &&
      (!text ||
        [
          g.title,
          ...g.tags,
          ...g.formulas.flatMap((f) => [f.title, f.note, f.latex]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(text)),
  );
  return (
    <main className="page-wrap">
      <section className="formula-section" aria-labelledby="formula-summaries-heading">
        <h2 id="formula-summaries-heading">รวมสรุปสูตร</h2>
        <p className="info">สูตรจากเอกสารสรุป แสดงหัวข้อละ 3 สูตรก่อน กดดูทั้งหมดเพื่ออ่านที่เหลือ</p>
        <p className="info">ปรับสัญลักษณ์บางจุดที่คลาดเคลื่อนในเอกสารให้สอดคล้องกับนิยาม สามารถดาวน์โหลดต้นฉบับไว้เปรียบเทียบได้</p>
        {formulaSummaries.map((group) => {
          const isExpanded = !!expanded[group.id];
          const visible = isExpanded ? group.formulas : group.formulas.slice(0, 3);
          return (
            <section className="formula-section" key={group.id} aria-labelledby={`${group.id}-heading`}>
              <h2 id={`${group.id}-heading`}>{group.title}</h2>
              <p className="info">{group.description}</p>
              <div className="formula-grid" id={`${group.id}-formulas`}>
                {visible.map((formula) => (
                  <article className="formula-card" key={formula.title}>
                    <h3>{formula.title}</h3>
                    <MathHTML html={`<p>$$${formula.latex}$$</p>`} />
                    {formula.note && <p>{formula.note}</p>}
                  </article>
                ))}
              </div>
              <div className="tool-actions summary-actions">
                <button type="button" className="chip" aria-expanded={isExpanded} aria-controls={`${group.id}-formulas`} onClick={() => setExpanded((current) => ({ ...current, [group.id]: !isExpanded }))}>
                  {isExpanded ? "แสดงน้อยลง" : `ดูทั้งหมด (${group.formulas.length} สูตร)`}
                </button>
                <a href={group.source} download>ดาวน์โหลดเอกสารต้นฉบับ PDF</a>
              </div>
            </section>
          );
        })}
      </section>
      <h2>สารบัญสูตรและแนวทางตรวจคำตอบ</h2>
      <p className="info">
        สูตรสรุปตามหัวข้อ · คำใบ้ทีละระดับอยู่ใต้การ์ดโจทย์ ·
        ตรวจเงื่อนไขของสูตรก่อนใช้
      </p>
      <div className="library-filters">
        <label>
          หัวข้อ
          <select
            value={topic}
            onChange={(e) =>
              setParams(e.target.value ? { topicId: e.target.value } : {})
            }
          >
            <option value="">ทุกหัวข้อ</option>
            {result.data?.items.map((g) => (
              <option key={g.topicId} value={g.topicId}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          ค้นหาสูตร
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="เช่น Laplace, ลาปลาซ, exact…"
          />
        </label>
      </div>
      {result.isPending ? (
        <p role="status">กำลังโหลดสูตร…</p>
      ) : result.error ? (
        <ErrorNotice error={result.error} retry={() => result.refetch()} />
      ) : (
        <>
          {!guides?.length && <div className="empty">ไม่พบสูตรที่ตรงคำค้น</div>}
          {guides?.map((g) => (
            <section className="formula-section" key={g.topicId}>
              <h2>
                {g.topicId}. {g.title}
              </h2>
              <div className="formula-grid">
                {g.formulas.map((f) => (
                  <article className="formula-card" key={f.title}>
                    <h3>{f.title}</h3>
                    <MathHTML html={`<p>$$${f.latex}$$</p>`} />
                    <p>{f.note}</p>
                  </article>
                ))}
              </div>
              <details className="guide-checks">
                <summary>จุดที่มักพลาดและวิธีตรวจคำตอบ</summary>
                <ul>
                  {g.mistakes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <ol>
                  {g.checks.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </details>
              <div className="tool-actions">
                <Link className="chip" to={"/questions?topicId=" + g.topicId}>
                  ฝึกจากโจทย์หัวข้อนี้
                </Link>
                <a href={g.source} target="_blank" rel="noreferrer">
                  อ่านเนื้อหาอ้างอิง MIT OCW ↗
                </a>
              </div>
            </section>
          ))}
        </>
      )}
      <div className="notice">
        การอ่านสูตรและเฉลยที่เก็บไว้ไม่ใช้โควตา AI · แชต AI
        ต้องเชื่อมต่ออินเทอร์เน็ตและตั้งค่า key ที่เซิร์ฟเวอร์
      </div>
    </main>
  );
}

export function ProgressPage({ catalog }: { catalog: Catalog }) {
  const s = useStudy();
  const [filter, setFilter] = useState("saved");
  const ids = Object.keys(s.records);
  const result = useQuery({
    queryKey: ["study-questions", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
          api<{ items: Question[] }>(
            `/questions?ids=${ids.join(",")}&pageSize=100&page=${i + 1}`,
            { signal },
          ),
        ),
      );
      return pages.flatMap((p) => p.items);
    },
  });
  const questions = result.data ?? [];
  const error = result.error;
  const loading = ids.length > 0 && result.isPending;
  const total = catalog.topics.reduce((n, t) => n + t.totalCount, 0);
  const understood = Object.values(s.records).filter(
    (r) => r.status === "understood",
  ).length;
  const reviewing = Object.values(s.records).filter(
    (r) => r.status === "reviewing",
  ).length;
  const saved = Object.values(s.records).filter((r) => r.favorite).length;
  const filtered = questions.filter((q) => {
    const r = s.records[q.id] ?? defaultRecord();
    return (
      filter === "all" ||
      (filter === "saved" && r.favorite) ||
      (filter === "notes" && r.note.trim()) ||
      r.status === filter
    );
  });
  return (
    <main className="page-wrap">
      <h2>ความคืบหน้าของฉัน ✿</h2>
      <div className="stats-grid">
        <div>
          <b>
            {understood}/{total}
          </b>
          <span>เข้าใจแล้ว</span>
        </div>
        <div>
          <b>{reviewing}</b>
          <span>กำลังทบทวน</span>
        </div>
        <div>
          <b>{saved}</b>
          <span>เก็บไว้ทบทวน</span>
        </div>
        <div>
          <b>{s.history.length}</b>
          <span>ชุดฝึกที่จบล่าสุด</span>
        </div>
      </div>
      <label className="progress-label">
        เข้าใจแล้ว {Math.round((100 * understood) / Math.max(total, 1))}%
        <progress max={total} value={understood} />
      </label>
      <p className="info">
        บันทึกในเบราว์เซอร์และเครื่องนี้ สถานะความเข้าใจเป็นการประเมินด้วยตัวเอง
      </p>
      <div className="type-filters" role="group" aria-label="กรองความคืบหน้า">
        {[
          ["saved", "★ เก็บไว้ทบทวน"],
          ["reviewing", "กำลังทบทวน"],
          ["understood", "เข้าใจแล้ว"],
          ["notes", "มีโน้ต"],
          ["all", "ทุกข้อที่บันทึก"],
        ].map(([value, label]) => (
          <button
            className={`chip ${filter === value ? "on" : ""}`}
            aria-pressed={filter === value}
            key={value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="empty" role="status">
          กำลังโหลดรายการ…
        </div>
      ) : error ? (
        <ErrorNotice error={error} />
      ) : (
        <div className="saved-list">
          {!filtered.length ? (
            <div className="empty">
              ยังไม่มีรายการในหมวดนี้{" "}
              <Link to="/questions">เริ่มจากคลังโจทย์</Link>
            </div>
          ) : (
            filtered.map((q) => {
              const r = s.records[q.id] ?? defaultRecord();
              return (
                <article className="saved-question" key={q.id}>
                  <div>
                    <Link to={"/questions/" + q.id}>
                      {q.topic} · ข้อ {q.displayNumber}
                    </Link>
                    <span className="tag">{statusLabels[r.status]}</span>
                    {r.favorite && <span aria-label="รายการโปรด">★</span>}
                  </div>
                  <small>
                    {q.examTypeRaw} · {q.dateLabel}
                  </small>
                  {r.note && <p className="note-preview">{r.note}</p>}
                </article>
              );
            })
          )}
        </div>
      )}
      {s.history.length > 0 && (
        <section>
          <h2>ชุดฝึกล่าสุด</h2>
          {s.history.map((p) => (
            <div className="history-row" key={p.id}>
              <span>
                {new Date(p.finishedAt!).toLocaleString("th-TH")} ·{" "}
                {p.questions.length} ข้อ · มีคำตอบ{" "}
                {Object.values(p.answers).filter((a) => a.trim()).length} ข้อ
              </span>
              {s.practice?.finishedAt === null ? (
                <small>จบชุดฝึกปัจจุบันก่อนเปิดชุดเก่า</small>
              ) : (
                <Link
                  className="chip"
                  to="/practice"
                  onClick={() => study.openResult(p)}
                >
                  ทบทวนชุดนี้
                </Link>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
