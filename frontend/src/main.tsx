import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { api } from "./lib/api";
import type { Catalog, Question } from "./lib/api";
import {
  Header,
  QuestionDetail,
  QuestionList,
} from "./features/questions/Questions";
import { ErrorNotice, Mascot } from "./components/Content";
import { ResumeBanner, StudyRuntime } from "./features/study/StudyTools";
import { study, useStudy } from "./features/study/store";
import "katex/dist/katex.min.css";
import "./styles.css";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
const Tutor = lazy(() =>
  import("./features/tutor/Tutor").then((module) => ({
    default: module.Tutor,
  })),
);
const PracticePage = lazy(() =>
  import("./features/study/PracticePage").then((m) => ({
    default: m.PracticePage,
  })),
);
const FormulaPage = lazy(() =>
  import("./features/study/LibraryPages").then((m) => ({
    default: m.FormulaPage,
  })),
);
const ProgressPage = lazy(() =>
  import("./features/study/LibraryPages").then((m) => ({
    default: m.ProgressPage,
  })),
);
function App() {
  const saved = useStudy();
  const location = useLocation();
  const practiceLocked =
    location.pathname === "/practice" && saved.practice?.finishedAt === null;
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: ({ signal }) => api<Catalog>("/catalog", { signal }),
  });
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (practiceLocked) setOpen(false);
  }, [practiceLocked]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [prompt, setPrompt] = useState("");
  const [requestId, setRequestId] = useState(0);
  const ask = (q: Question, initialPrompt = "") => {
    study.visit(q);
    setPrompt(initialPrompt);
    setRequestId((v) => v + 1);
    setQuestion(q);
    setOpen(true);
  };
  return (
    <>
      <Header catalog={catalog.data} />
      <StudyRuntime />
      {location.pathname !== "/practice" && <ResumeBanner />}
      {catalog.isPending ? (
        <div className="empty" role="status">
          กำลังเปิดคลังข้อสอบ…
        </div>
      ) : catalog.error ? (
        <div className="detail-wrap">
          <ErrorNotice error={catalog.error} retry={() => catalog.refetch()} />
        </div>
      ) : (
        catalog.data && (
          <Suspense
            fallback={
              <div className="empty" role="status">
                กำลังเปิดหน้า…
              </div>
            }
          >
            <Routes>
              <Route
                path="/"
                element={<Navigate to={saved.lastList.url} replace />}
              />
              <Route
                path="/questions"
                element={<QuestionList catalog={catalog.data} onAsk={ask} />}
              />
              <Route
                path="/questions/:id"
                element={<QuestionDetail onAsk={ask} />}
              />
              <Route
                path="/practice"
                element={<PracticePage catalog={catalog.data} onAsk={ask} />}
              />
              <Route path="/formulas" element={<FormulaPage />} />
              <Route
                path="/progress"
                element={<ProgressPage catalog={catalog.data} />}
              />
              <Route
                path="*"
                element={
                  <div className="empty">
                    ไม่พบหน้านี้ <Link to="/questions">กลับคลังข้อสอบ</Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        )
      )}
      <footer className="site-footer">
        Yotsuba’s EE Math I ✿ ค่อย ๆ ฝึก แล้วจะเข้าใจมากขึ้น
        <br />
        <small>
          โจทย์และสูตรไม่ใช้โควตา AI · แชต AI ต้องใช้อินเทอร์เน็ต · API key
          เก็บที่เซิร์ฟเวอร์
        </small>
      </footer>
      {!practiceLocked && (
        <button
          id="fab"
          title="Yotsuba AI"
          aria-label={open ? "ปิดผู้ช่วยติว AI" : "เปิดผู้ช่วยติว AI"}
          aria-expanded={open}
          aria-controls="chat"
          onClick={() => setOpen((v) => !v)}
        >
          <Mascot className="fab-avatar" />
        </button>
      )}
      {open && !practiceLocked && (
        <Suspense
          fallback={
            <div id="chat" className="empty" role="status">
              กำลังเปิดผู้ช่วยติว…
            </div>
          }
        >
          <Tutor
            key={question?.id ?? "none"}
            question={question}
            available={catalog.data?.aiAvailable ?? false}
            onClose={() => setOpen(false)}
            initialPrompt={prompt}
            requestId={requestId}
          />
        </Suspense>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
