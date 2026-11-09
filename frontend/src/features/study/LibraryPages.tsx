import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { Catalog, Question, SolutionGuide } from "../../lib/api";
import { ErrorNotice, MathHTML } from "../../components/Content";
import { defaultRecord, statusLabels } from "./model";
import { study, useStudy } from "./store";
import { formulaSummaries, type SummaryFormula } from "./formulaSummaries";

type Guide = SolutionGuide["items"][number];

function GuideChecks({ guide }: { guide: Guide }) {
  return (
    <>
      <details className="guide-checks">
        <summary>จุดที่มักพลาดและวิธีตรวจคำตอบ</summary>
        <ul>
          {guide.mistakes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ol>
          {guide.checks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </details>
      <div className="tool-actions">
        <Link className="chip" to={"/questions?topicId=" + guide.topicId}>
          ฝึกจากโจทย์หัวข้อนี้
        </Link>
        <a href={guide.source} target="_blank" rel="noreferrer">
          อ่านเนื้อหาอ้างอิง MIT OCW ↗
        </a>
      </div>
    </>
  );
}

function FormulaCards({
  formulas,
  id,
}: {
  formulas: readonly SummaryFormula[];
  id?: string;
}) {
  return (
    <div className="formula-grid" id={id}>
      {formulas.map((formula) => (
        <article className="formula-card" key={formula.title}>
          <h3>{formula.title}</h3>
          <MathHTML html={"<p>$$" + formula.latex + "$$</p>"} />
          {formula.note && <p>{formula.note}</p>}
        </article>
      ))}
    </div>
  );
}

function SummaryCategory({
  id,
  title,
  formulas,
  searching,
}: {
  id: string;
  title: string;
  formulas: SummaryFormula[];
  searching: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || searching;
  return (
    <section className="formula-category" aria-labelledby={id + "-heading"}>
      <h3 id={id + "-heading"}>{title}</h3>
      <FormulaCards
        id={id}
        formulas={showAll ? formulas : formulas.slice(0, 3)}
      />
      {!searching && formulas.length > 3 && (
        <div className="tool-actions summary-actions">
          <button
            type="button"
            className="chip"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded
              ? "แสดงน้อยลง"
              : "ดูทั้งหมด (" + formulas.length + " สูตร)"}
          </button>
        </div>
      )}
    </section>
  );
}

export function FormulaPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const result = useQuery({
    queryKey: ["guides"],
    queryFn: ({ signal }) => api<SolutionGuide>("/guides", { signal }),
  });
  const topic = params.get("topicId") ?? "";
  const text = search.trim().toLowerCase();
  const matches = (...parts: (string | undefined)[]) =>
    parts.join(" ").toLowerCase().includes(text);
  const matchesTopic = (id: number) => !topic || Number(topic) === id;
  const allGuides = [...(result.data?.items ?? [])].sort(
    (a, b) => a.topicId - b.topicId,
  );
  const summaries = formulaSummaries
    .filter((group) => matchesTopic(group.topicId))
    .map((group) => {
      const guide = allGuides.find((item) => item.topicId === group.topicId);
      const properties =
        group.id === "laplace" && guide
          ? [
              ...group.properties,
              ...guide.formulas.filter(
                (formula) => formula.title === "อนุพันธ์ (unilateral)",
              ),
            ]
          : group.properties;
      const category = (
        key: string,
        title: string,
        formulas: SummaryFormula[],
      ) => ({
        key,
        title,
        formulas: matches(
          group.title,
          group.description,
          title,
          ...(guide?.tags ?? []),
        )
          ? formulas
          : formulas.filter((formula) =>
              matches(formula.title, formula.note, formula.latex),
            ),
      });
      return {
        group,
        guide,
        categories: [
          category("basic", "ผลแปลงพื้นฐาน", group.basic),
          category("properties", "Properties", properties),
        ].filter((item) => item.formulas.length > 0),
      };
    })
    .filter(({ categories }) => categories.length > 0);
  const guides = allGuides.filter(
    (guide) =>
      matchesTopic(guide.topicId) &&
      !formulaSummaries.some((group) => group.topicId === guide.topicId) &&
      matches(
        guide.title,
        ...guide.tags,
        ...guide.formulas.flatMap((formula) => [
          formula.title,
          formula.note,
          formula.latex,
        ]),
      ),
  );

  const sections = [
    ...summaries.map(({ group, guide, categories }) => ({
      topicId: group.topicId,
      content: (
        <section
          className="formula-section"
          key={group.id}
          aria-labelledby={group.id + "-heading"}
        >
          <h2 id={group.id + "-heading"}>
            {group.topicId}. {group.title}
          </h2>
          <p className="info">{group.description}</p>
          {categories.map((category) => (
            <SummaryCategory
              key={category.key}
              id={group.id + "-" + category.key}
              title={category.title}
              formulas={category.formulas}
              searching={!!text}
            />
          ))}
          <div className="tool-actions summary-actions">
            <a href={group.source} download>
              ดาวน์โหลดเอกสารต้นฉบับ PDF
            </a>
          </div>
          {guide && <GuideChecks guide={guide} />}
        </section>
      ),
    })),
    ...guides.map((guide) => ({
      topicId: guide.topicId,
      content: (
        <section className="formula-section" key={guide.topicId}>
          <h2>
            {guide.topicId}. {guide.title}
          </h2>
          <FormulaCards formulas={guide.formulas} />
          <GuideChecks guide={guide} />
        </section>
      ),
    })),
  ].sort((a, b) => a.topicId - b.topicId);

  return (
    <main className="page-wrap">
      <h2>รวมสรุปสูตร</h2>
      <p className="info">
        สูตรสรุปตามหัวข้อ · คำใบ้ทีละระดับอยู่ใต้การ์ดโจทย์
      </p>
      <div className="library-filters">
        <label>
          หัวข้อ
          <select
            value={topic}
            onChange={(event) =>
              setParams(
                event.target.value ? { topicId: event.target.value } : {},
              )
            }
          >
            <option value="">ทุกหัวข้อ</option>
            {allGuides.map((guide) => (
              <option key={guide.topicId} value={guide.topicId}>
                {guide.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          ค้นหาสูตร
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="เช่น Laplace, ลาปลาซ, exact…"
          />
        </label>
      </div>
      {result.isPending && <p role="status">กำลังโหลดสูตร…</p>}
      {result.error && (
        <ErrorNotice error={result.error} retry={() => result.refetch()} />
      )}
      {result.isSuccess && !sections.length && (
        <div className="empty">ไม่พบสูตรที่ตรงคำค้น</div>
      )}
      {sections.map((section) => section.content)}
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
