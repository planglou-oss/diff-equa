import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "../../lib/api";
import type { AskTutor, Catalog, Question, Solutions } from "../../lib/api";
import { study, useStudy } from "../study/store";
import { statusLabels, studyIDs } from "../study/model";
import {
  QuestionHelp,
  QuestionText,
  StepExplanation,
  StudyControls,
} from "../study/StudyTools";
import {
  ErrorNotice,
  Mascot,
  MathHTML,
  QuestionImage,
} from "../../components/Content";

type Props = { catalog: Catalog; onAsk: AskTutor };
export function Header({ catalog }: { catalog?: Catalog }) {
  const saved = useStudy();
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!header.current) return;
    const measure = () =>
      document.documentElement.style.setProperty(
        "--header-height",
        header.current!.getBoundingClientRect().height + "px",
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const [draft, setDraft] = useState(query);
  const location = useLocation();
  const isList =
    location.pathname === "/questions" || location.pathname === "/";
  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const timer = setTimeout(
      () =>
        setParams((p) => {
          p.set("q", draft.trim());
          if (!draft.trim()) p.delete("q");
          p.delete("page");
          return p;
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [draft, query, setParams]);
  const filter = (key: string, value: string) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      p.delete("page");
      return p;
    });
  return (
    <header ref={header}>
      <div className="header-inner">
        <h1>
          <Link to={saved.lastList.url} className="brand">
            <Mascot className="av" />
            <span>
              Yotsuba’s EE Math I <small>ข้อสอบและเฉลย · จุฬาฯ</small>
            </span>
          </Link>
        </h1>
        <nav className="app-tabs" aria-label="เมนูหลัก">
          {[
            [saved.lastList.url, "คลังข้อสอบ", "/questions"],
            ["/practice", "ฝึกทำข้อสอบ", "/practice"],
            ["/formulas", "สูตรและคำใบ้", "/formulas"],
            ["/progress", "ความคืบหน้า", "/progress"],
          ].map(([to, label, path]) => (
            <Link
              key={path}
              to={to}
              className={location.pathname.startsWith(path) ? "on" : ""}
              aria-current={
                location.pathname.startsWith(path) ? "page" : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        {isList ? (
          <div className="row">
            <label className="search">
              <span className="sr-only">ค้นหาโจทย์</span>
              <input
                maxLength={200}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="ค้นหา: ปี (เช่น 1998), เดือน, หรือคำในโจทย์..."
              />
            </label>
            <label>
              <span className="sr-only">ปีข้อสอบ</span>
              <select
                value={params.get("year") ?? ""}
                onChange={(e) => filter("year", e.target.value)}
              >
                <option value="">ทุกปี</option>
                {catalog?.years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
            <div
              className="type-filters"
              role="group"
              aria-label="ประเภทข้อสอบ"
            >
              {[
                "",
                ...(catalog?.examTypes ?? ["Midterm", "Final", "Quiz"]),
              ].map((t) => (
                <button
                  key={t}
                  className={`chip ${t === (params.get("examType") ?? "") ? "on" : ""}`}
                  aria-pressed={t === (params.get("examType") ?? "")}
                  onClick={() => filter("examType", t)}
                >
                  {t || "ทุกประเภท"}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="header-caption">
            ฝึกคิดทีละขั้น แล้วค่อยเปิดดูเฉลย ✿
          </div>
        )}
      </div>
    </header>
  );
}
export function QuestionList({ catalog, onAsk }: Props) {
  const saved = useStudy();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const topic = params.get("topicId") ?? "";
  const apiParams = new URLSearchParams(params);
  apiParams.delete("studyStatus");
  apiParams.delete("saved");
  const selected = studyIDs(
    saved.records,
    params.get("studyStatus") ?? "",
    params.get("saved") === "1",
  );
  if (selected.ids !== undefined) apiParams.set("ids", selected.ids.join(","));
  if (selected.excludeIds !== undefined)
    apiParams.set("excludeIds", selected.excludeIds.join(","));
  const query = apiParams.toString();
  const result = useQuery({
    queryKey: ["questions", query],
    queryFn: ({ signal }) =>
      api<{ items: Question[]; total: number; page: number; pageSize: number }>(
        "/questions?" + query,
        { signal },
      ),
  });
  const change = (key: string, value: string) => {
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      if (key !== "page") p.delete("page");
      return p;
    });
  };
  useEffect(() => {
    const key = "scroll:" + location.key;
    let restoring = true;
    const url = location.pathname + location.search;
    const y = Number(
      sessionStorage.getItem(key) ??
        (saved.lastList.url === url ? saved.lastList.y : 0),
    );
    let lastY = y,
      lastSaved = 0;
    const timer = setTimeout(() => {
      if (!result.isPending) {
        window.scrollTo(0, y);
        restoring = false;
        study.list(url, y);
      }
    }, 0);
    const save = () => {
      if (!restoring) {
        lastY = window.scrollY;
        sessionStorage.setItem(key, String(lastY));
        if (Date.now() - lastSaved > 800) {
          lastSaved = Date.now();
          study.list(url, lastY);
        }
      }
    };
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", save);
      if (!restoring) study.list(url, lastY);
    };
  }, [location.key, result.isPending]);
  const totalAll = catalog.topics.reduce((n, t) => n + t.totalCount, 0);
  const data = result.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="wrap">
      <nav aria-label="หัวข้อ">
        <button
          className={!topic ? "on" : ""}
          onClick={() => change("topicId", "")}
        >
          ทุกหัวข้อ <b>{totalAll}</b>
        </button>
        {catalog.topics
          .filter((t) => t.totalCount > 0)
          .map((t) => (
            <button
              key={t.id}
              className={topic === String(t.id) ? "on" : ""}
              onClick={() => change("topicId", String(t.id))}
              aria-pressed={topic === String(t.id)}
            >
              {t.id}. {t.name}
              <b>{t.totalCount}</b>
            </button>
          ))}
      </nav>
      <main>
        <div className="study-filters">
          <label>
            เรียงลำดับ
            <select
              value={params.get("sort") ?? ""}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="">ตามหัวข้อและเลขข้อ</option>
              <option value="year_asc">ปีน้อย → มาก</option>
              <option value="year_desc">ปีมาก → น้อย</option>
            </select>
          </label>
          <button
            className={`chip ${params.get("choiceOnly") === "1" ? "on" : ""}`}
            aria-pressed={params.get("choiceOnly") === "1"}
            onClick={() =>
              change("choiceOnly", params.get("choiceOnly") === "1" ? "" : "1")
            }
          >
            เฉพาะข้อที่มี 4 ตัวเลือก
          </button>
          <label>
            ความเข้าใจ
            <select
              value={params.get("studyStatus") ?? ""}
              onChange={(e) => change("studyStatus", e.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`chip ${params.get("saved") === "1" ? "on" : ""}`}
            aria-pressed={params.get("saved") === "1"}
            onClick={() =>
              change("saved", params.get("saved") === "1" ? "" : "1")
            }
          >
            ★ เก็บไว้ทบทวน
          </button>
          <Link className="chip" to="/practice">
            สุ่มชุดฝึก →
          </Link>
        </div>
        {result.isPending ? (
          <div className="empty" role="status">
            กำลังโหลดโจทย์…
          </div>
        ) : result.isError ? (
          <ErrorNotice error={result.error} retry={() => result.refetch()} />
        ) : (
          data && (
            <>
              <div className="info" aria-live="polite">
                พบ {data.total} ข้อ ✿ กด “ดูเฉลยต้นฉบับ” ใต้แต่ละข้อ
              </div>
              {!data.items.length ? (
                <div className="empty">
                  ไม่พบข้อที่ตรงกับเงื่อนไข
                  <br />
                  <button className="chip" onClick={() => setParams({})}>
                    ล้างตัวกรอง
                  </button>
                </div>
              ) : (
                data.items.map((q, i) => (
                  <div key={q.id}>
                    {i === 0 || data.items[i - 1].topicId !== q.topicId ? (
                      <h2>
                        {q.topicId}. {q.topic}
                      </h2>
                    ) : null}
                    <QuestionCard question={q} onAsk={onAsk} />
                  </div>
                ))
              )}
              <div className="pagination">
                <button
                  className="chip"
                  disabled={data.page <= 1}
                  onClick={() => change("page", String(data.page - 1))}
                >
                  ← ก่อนหน้า
                </button>
                <span>
                  หน้า {data.page} / {pages}
                </span>
                <button
                  className="chip"
                  disabled={data.page >= pages}
                  onClick={() => change("page", String(data.page + 1))}
                >
                  ถัดไป →
                </button>
              </div>
            </>
          )
        )}
      </main>
    </div>
  );
}
export function QuestionCard({
  question: q,
  onAsk,
  detail = false,
  locked = false,
  hideAnswer = false,
}: {
  question: Question;
  onAsk: AskTutor;
  detail?: boolean;
  locked?: boolean;
  hideAnswer?: boolean;
}) {
  const saved = useStudy();
  const [original, setOriginal] = useState(
    () =>
      !locked &&
      (saved.views[q.id]?.original ??
        sessionStorage.getItem("original:" + q.id) === "1"),
  );
  const [explanation, setExplanation] = useState(
    () =>
      !locked &&
      (saved.views[q.id]?.explanation ??
        sessionStorage.getItem("explanation:" + q.id) === "1"),
  );
  useEffect(() => {
    if (!locked) {
      sessionStorage.setItem("original:" + q.id, original ? "1" : "0");
      sessionStorage.setItem("explanation:" + q.id, explanation ? "1" : "0");
    }
  }, [q.id, original, explanation, locked]);
  const location = useLocation();
  const result = useQuery({
    queryKey: ["solutions", q.id],
    queryFn: ({ signal }) =>
      api<Solutions>(`/questions/${q.id}/solutions`, { signal }),
    enabled: !locked && (original || explanation),
  });
  return (
    <article
      className={`card ${original ? "open" : ""} ${explanation ? "openA" : ""}`}
    >
      <div className="top">
        <b>
          {detail ? (
            `ข้อ ${q.displayNumber}`
          ) : (
            <Link
              to={"/questions/" + q.id}
              state={{ from: location.pathname + location.search }}
              onClick={() => study.visit(q)}
            >
              ข้อ {q.displayNumber}
            </Link>
          )}
        </b>
        <span className="tag">{q.examTypeRaw}</span>
        {q.sourceLabel && <span className="tag">{q.sourceLabel}</span>}
        <span className="d">{q.dateLabel}</span>
      </div>
      {!!q.tags?.length && (
        <div className="question-tags">
          {q.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
      {!locked && <StudyControls question={q} />}
      <QuestionImage
        image={q.questionImage}
        alt={`โจทย์ ${q.topic} ข้อ ${q.displayNumber}`}
      />
      {!locked && (
        <>
          <QuestionText question={q} />
          <button
            className="btn"
            aria-expanded={original}
            aria-controls={"original-" + q.id}
            onClick={() => {
              if (!original) study.visit(q);
              setOriginal((v) => !v);
              study.view(q.id, { original: !original });
            }}
          >
            {original ? "ซ่อนเฉลยต้นฉบับ ▴" : "ดูเฉลยต้นฉบับ ▾"}
          </button>
          {original && (
            <div className="sol" id={"original-" + q.id}>
              <div className="explanation-label original-label">
                เฉลยจากต้นฉบับ · ภาพเอกสารเดิม
              </div>
              {result.isPending ? (
                <div className="aib" role="status">
                  กำลังโหลดเฉลย…
                </div>
              ) : result.error ? (
                <ErrorNotice
                  error={result.error}
                  retry={() => result.refetch()}
                />
              ) : (
                result.data && (
                  <QuestionImage
                    image={result.data.original}
                    alt={`เฉลยต้นฉบับ ข้อ ${q.displayNumber}`}
                  />
                )
              )}
            </div>
          )}
          <button className="btn ask" onClick={() => onAsk(q)}>
            <Mascot /> ถาม AI เรื่องข้อนี้
          </button>
          <button
            className="btn ai"
            aria-expanded={explanation}
            aria-controls={"explanation-" + q.id}
            onClick={() => {
              if (!explanation) study.visit(q);
              setExplanation((v) => !v);
              study.view(q.id, { explanation: !explanation });
            }}
          >
            <Mascot /> {explanation ? "ซ่อนคำอธิบาย AI ▴" : "คำอธิบายจาก AI ▾"}
            {!q.hasAIExplanation && <small> · ยังไม่มี</small>}
          </button>
          {explanation && (
            <div className="aisol" id={"explanation-" + q.id}>
              {result.isPending ? (
                <div className="aib" role="status">
                  กำลังโหลด…
                </div>
              ) : result.error ? (
                <ErrorNotice
                  error={result.error}
                  retry={() => result.refetch()}
                />
              ) : result.data?.aiExplanation ? (
                <>
                  <div className="explanation-label">
                    คำอธิบายจาก AI ·{" "}
                    {result.data.aiExplanation.reviewStatus === "reviewed"
                      ? "ตรวจทานแล้ว"
                      : "ยังไม่ได้ตรวจทาน"}
                  </div>
                  <StepExplanation
                    questionId={q.id}
                    html={result.data.aiExplanation.bodyHtml}
                  />
                </>
              ) : (
                <div className="aib">
                  ยังไม่มีคำอธิบาย AI สำหรับข้อนี้
                  สามารถอ่านเฉลยต้นฉบับหรือกดถาม AI ได้ครับ
                </div>
              )}
            </div>
          )}
          <QuestionHelp question={q} onAsk={onAsk} showAnswer={!hideAnswer} />
        </>
      )}
    </article>
  );
}
export function QuestionDetail({ onAsk }: { onAsk: AskTutor }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  const result = useQuery({
    queryKey: ["question", id],
    queryFn: ({ signal }) => api<Question>("/questions/" + id, { signal }),
  });
  useEffect(() => {
    if (result.data) study.visit(result.data);
  }, [result.data]);
  const from =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/questions")
      ? location.state.from
      : "/questions";
  return (
    <div className="detail-wrap">
      <Link
        className="back-link"
        to={from}
        onClick={(e) => {
          if (
            location.state?.from &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.shiftKey &&
            !e.altKey
          ) {
            e.preventDefault();
            navigate(-1);
          }
        }}
      >
        ← กลับรายการโจทย์
      </Link>
      {result.isPending ? (
        <div className="empty" role="status">
          กำลังโหลดโจทย์…
        </div>
      ) : result.error ? (
        <ErrorNotice error={result.error} />
      ) : (
        result.data && (
          <>
            <h2>
              {result.data.topicId}. {result.data.topic}
            </h2>
            <QuestionCard question={result.data} onAsk={onAsk} detail />
          </>
        )
      )}
    </div>
  );
}
