import { useState } from "react";

const STATUS = {
  PENDING: { bg: "#FFF8F0", text: "#D97706", border: "#FBBF24", label: "승인대기" },
  APPROVED: { bg: "#F0FDF4", text: "#16A34A", border: "#4ADE80", label: "승인" },
  REJECTED: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5", label: "반려" },
  DRAFT: { bg: "#EFF6FF", text: "#2563EB", border: "#93C5FD", label: "임시저장" },
};

const Badge = ({ status }) => {
  const s = STATUS[status];
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>{s.label}</span>
  );
};

const APPROVALS = [
  { id: 1, type: "연차", title: "연차 사용 (4/21~4/22)", author: "김민수", dept: "개발팀", date: "2026-04-14", status: "PENDING", detail: { leaveType: "연차", start: "2026-04-21", end: "2026-04-22", days: 2, reason: "개인 사유" } },
  { id: 2, type: "품의", title: "AWS 서버 증설 비용", author: "박지영", dept: "인프라팀", date: "2026-04-13", status: "PENDING", detail: { amount: 2400000, purpose: "인프라/서버", content: "프로덕션 서버 EC2 인스턴스 업그레이드\nt3.medium → t3.large (월 비용 약 $67 → $134)" } },
  { id: 3, type: "연차", title: "오후 반차 (4/18)", author: "이준호", dept: "개발팀", date: "2026-04-12", status: "APPROVED", detail: { leaveType: "오후반차", start: "2026-04-18", end: "2026-04-18", days: 0.5, reason: "병원 진료" } },
  { id: 4, type: "품의", title: "모니터 구매 품의", author: "이준호", dept: "개발팀", date: "2026-04-10", status: "REJECTED", detail: { amount: 890000, purpose: "장비구매", content: "Dell U2723QE 4K 모니터 2대 구매\n단가 445,000원 x 2" } },
];

const MY_DOCS = [
  { id: 5, type: "품의", title: "디자인 외주 계약 품의", date: "2026-04-10", status: "APPROVED", detail: { amount: 5500000, purpose: "외주비", content: "매쓰보드 UI/UX 디자인 외주 계약\n기간: 4주, 산출물: Figma 디자인 시스템" } },
  { id: 6, type: "연차", title: "연차 사용 (5/1~5/2)", date: "2026-04-14", status: "PENDING", detail: { leaveType: "연차", start: "2026-05-01", end: "2026-05-02", days: 2, reason: "가정의 달 여행" } },
  { id: 7, type: "품의", title: "교육비 품의 - AWS SA 자격증", date: "2026-04-08", status: "REJECTED", detail: { amount: 450000, purpose: "교육비", content: "AWS Solutions Architect Professional 자격증 응시료 + 강의" } },
];

const NAV = [
  { id: "dashboard", icon: "⬚", label: "대시보드" },
  { id: "approval", icon: "✓", label: "결재함" },
  { id: "mydocs", icon: "◎", label: "내 문서" },
];

export default function ApprovalWeb() {
  const [page, setPage] = useState("dashboard");
  const [modal, setModal] = useState(null); // 'leave' | 'expense'
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionDone, setActionDone] = useState({});
  const [leaveForm, setLeaveForm] = useState({ type: "연차", start: "", end: "", reason: "" });
  const [expForm, setExpForm] = useState({ title: "", amount: "", purpose: "", detail: "" });
  const [approvalTab, setApprovalTab] = useState("all");
  const [mydocTab, setMydocTab] = useState("all");

  const fire = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  const filteredApprovals = approvalTab === "all" ? APPROVALS
    : approvalTab === "pending" ? APPROVALS.filter(d => d.status === "PENDING")
    : APPROVALS.filter(d => d.status !== "PENDING");

  const filteredMyDocs = mydocTab === "all" ? MY_DOCS
    : MY_DOCS.filter(d => d.status === mydocTab.toUpperCase());

  // ---- styles ----
  const c = {
    bg: "#F4F5F7",
    sidebar: "#1E1E1C",
    sidebarHover: "#2A2A28",
    accent: "#185FA5",
    accentLight: "#EBF2FA",
    card: "#FFFFFF",
    border: "#E5E7EB",
    textPrimary: "#1E1E1C",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
  };

  const sidebar = {
    width: 220, background: c.sidebar, color: "#fff", display: "flex", flexDirection: "column",
    padding: "0", flexShrink: 0, height: "100%",
  };

  const sideNavItem = (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "11px 20px",
    background: active ? "rgba(24,95,165,0.25)" : "transparent",
    color: active ? "#7EB5E8" : "#9CA3AF",
    fontWeight: active ? 700 : 500, fontSize: 14, cursor: "pointer",
    borderLeft: active ? "3px solid #185FA5" : "3px solid transparent",
    transition: "all 0.12s", borderRadius: 0, border: "none", textAlign: "left",
    width: "100%", fontFamily: "inherit",
  });

  const cardStyle = {
    background: c.card, borderRadius: 12, border: `1px solid ${c.border}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };

  const btnPrimary = {
    padding: "10px 22px", borderRadius: 8, border: "none",
    background: c.accent, color: "#fff", fontWeight: 700, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit",
    boxShadow: "0 2px 8px rgba(24,95,165,0.2)",
  };

  const btnOutline = {
    padding: "10px 22px", borderRadius: 8, border: `1.5px solid ${c.border}`,
    background: "#fff", color: c.textPrimary, fontWeight: 600, fontSize: 13,
    cursor: "pointer", fontFamily: "inherit",
  };

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 8,
    border: `1.5px solid ${c.border}`, fontSize: 14, fontFamily: "inherit",
    outline: "none", color: c.textPrimary, background: "#FAFBFC",
    boxSizing: "border-box",
  };

  const labelStyle = { fontSize: 12, fontWeight: 700, color: c.textSecondary, marginBottom: 6, display: "block" };
  const fieldGroup = { marginBottom: 18 };

  const tableHeader = {
    display: "grid", padding: "10px 20px", fontSize: 11, fontWeight: 700,
    color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.04em",
    borderBottom: `1px solid ${c.border}`, background: "#F9FAFB", borderRadius: "12px 12px 0 0",
  };

  const tableRow = (last) => ({
    display: "grid", padding: "14px 20px", fontSize: 13,
    borderBottom: last ? "none" : `1px solid #F3F4F6`,
    cursor: "pointer", transition: "background 0.1s", alignItems: "center",
  });

  const tag = (type) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: 5,
    fontSize: 11, fontWeight: 700,
    background: type === "연차" ? "#EEF2FF" : "#FDF2F8",
    color: type === "연차" ? "#4338CA" : "#BE185D",
  });

  const tab = (active) => ({
    padding: "6px 16px", borderRadius: 6, border: "none",
    background: active ? c.textPrimary : "transparent",
    color: active ? "#fff" : c.textMuted,
    fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.12s",
  });

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    backdropFilter: "blur(2px)",
  };

  const modalBox = {
    background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520,
    maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  };

  const cols5 = "100px 1fr 120px 100px 90px";
  const cols4 = "100px 1fr 100px 90px";

  // ==== RENDER ====

  const StatCard = ({ label, value, sub, color }) => (
    <div style={{ ...cardStyle, padding: "20px 24px", flex: 1 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || c.textPrimary, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const Dashboard = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, margin: 0 }}>대시보드</h1>
          <p style={{ fontSize: 13, color: c.textMuted, margin: "4px 0 0" }}>안녕하세요, 대영님. 오늘의 결재 현황입니다.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnOutline} onClick={() => setModal("leave")}>📋 연차신청</button>
          <button style={btnPrimary} onClick={() => setModal("expense")}>💰 품의서 작성</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        <StatCard label="결재 대기" value="2건" sub="승인이 필요합니다" color="#D97706" />
        <StatCard label="이번 달 처리" value="7건" sub="승인 5 · 반려 2" />
        <StatCard label="잔여 연차" value="7일" sub="총 15일 중 8일 사용" color={c.accent} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary }}>결재 대기</span>
            <button style={{ background: "none", border: "none", fontSize: 12, color: c.accent, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => { setPage("approval"); setApprovalTab("pending"); }}>전체보기 →</button>
          </div>
          {APPROVALS.filter(d => d.status === "PENDING").map((doc, i, arr) => (
            <div key={doc.id} style={{ padding: "14px 20px", borderBottom: i < arr.length - 1 ? `1px solid #F3F4F6` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => { setSelected(doc); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={tag(doc.type)}>{doc.type}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>{doc.author} · {doc.dept} · {doc.date}</div>
                </div>
              </div>
              <Badge status={doc.status} />
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ padding: "16px 20px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary }}>최근 내 문서</span>
            <button style={{ background: "none", border: "none", fontSize: 12, color: c.accent, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setPage("mydocs")}>전체보기 →</button>
          </div>
          {MY_DOCS.map((doc, i, arr) => (
            <div key={doc.id} style={{ padding: "14px 20px", borderBottom: i < arr.length - 1 ? `1px solid #F3F4F6` : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={tag(doc.type)}>{doc.type}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>{doc.title}</div>
                  <div style={{ fontSize: 11, color: c.textMuted }}>{doc.date}</div>
                </div>
              </div>
              <Badge status={doc.status} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 16, padding: "20px 24px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: c.textPrimary, marginBottom: 14 }}>연차 현황</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: c.accent }}>8</span>
            <span style={{ fontSize: 14, color: c.textMuted }}>/ 15일 사용</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ width: "100%", height: 10, background: "#E5E7EB", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: "53%", height: "100%", background: `linear-gradient(90deg, ${c.accent}, #3A7FCC)`, borderRadius: 5 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: c.textMuted }}>
              <span>사용 8일</span>
              <span>잔여 7일</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ApprovalPage = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, margin: 0 }}>결재함</h1>
        <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 8, padding: 3 }}>
          {[["all","전체"],["pending","대기"],["done","완료"]].map(([k,v]) => (
            <button key={k} style={tab(approvalTab===k)} onClick={() => setApprovalTab(k)}>{v}</button>
          ))}
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ ...tableHeader, gridTemplateColumns: cols5 }}>
          <span>유형</span><span>제목</span><span>기안자</span><span>기안일</span><span>상태</span>
        </div>
        {filteredApprovals.map((doc, i, arr) => (
          <div key={doc.id}
            style={{ ...tableRow(i === arr.length - 1), gridTemplateColumns: cols5 }}
            onClick={() => setSelected(doc)}
            onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={tag(doc.type)}>{doc.type}</span>
            <span style={{ fontWeight: 600, color: c.textPrimary }}>{doc.title}</span>
            <span style={{ color: c.textSecondary }}>{doc.author}<br/><span style={{fontSize:11,color:c.textMuted}}>{doc.dept}</span></span>
            <span style={{ color: c.textMuted }}>{doc.date}</span>
            <Badge status={actionDone[doc.id] || doc.status} />
          </div>
        ))}
        {filteredApprovals.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: c.textMuted, fontSize: 13 }}>해당 문서가 없습니다</div>
        )}
      </div>
    </div>
  );

  const MyDocsPage = () => (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, margin: 0 }}>내 문서</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 4, background: "#F3F4F6", borderRadius: 8, padding: 3 }}>
            {[["all","전체"],["pending","대기"],["approved","승인"],["rejected","반려"]].map(([k,v]) => (
              <button key={k} style={tab(mydocTab===k)} onClick={() => setMydocTab(k)}>{v}</button>
            ))}
          </div>
          <button style={btnPrimary} onClick={() => setModal("leave")}>+ 새 기안</button>
        </div>
      </div>
      <div style={cardStyle}>
        <div style={{ ...tableHeader, gridTemplateColumns: cols4 }}>
          <span>유형</span><span>제목</span><span>기안일</span><span>상태</span>
        </div>
        {filteredMyDocs.map((doc, i, arr) => (
          <div key={doc.id} style={{ ...tableRow(i === arr.length - 1), gridTemplateColumns: cols4 }}>
            <span style={tag(doc.type)}>{doc.type}</span>
            <span style={{ fontWeight: 600, color: c.textPrimary }}>{doc.title}</span>
            <span style={{ color: c.textMuted }}>{doc.date}</span>
            <Badge status={doc.status} />
          </div>
        ))}
        {filteredMyDocs.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: c.textMuted, fontSize: 13 }}>해당 문서가 없습니다</div>
        )}
      </div>
    </div>
  );

  // ---- Modals ----
  const LeaveModal = () => (
    <div style={overlay} onClick={() => setModal(null)}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary }}>📋 연차신청</span>
          <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: c.textMuted }} onClick={() => setModal(null)}>✕</button>
        </div>
        <div style={{ padding: "24px" }}>
          <div style={fieldGroup}>
            <label style={labelStyle}>연차 유형</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["연차", "오전반차", "오후반차"].map(t => (
                <button key={t} onClick={() => setLeaveForm({...leaveForm, type: t})} style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
                  border: `1.5px solid ${leaveForm.type === t ? c.accent : c.border}`,
                  background: leaveForm.type === t ? c.accentLight : "#fff",
                  color: leaveForm.type === t ? c.accent : c.textMuted,
                }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...fieldGroup, flex: 1 }}>
              <label style={labelStyle}>시작일</label>
              <input type="date" style={inputStyle} value={leaveForm.start} onChange={e => setLeaveForm({...leaveForm, start: e.target.value})} />
            </div>
            <div style={{ ...fieldGroup, flex: 1 }}>
              <label style={labelStyle}>종료일</label>
              <input type="date" style={inputStyle} value={leaveForm.end} onChange={e => setLeaveForm({...leaveForm, end: e.target.value})} />
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>사유</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="연차 사용 사유를 입력하세요"
              value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>결재자</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: `1px solid ${c.border}` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.sidebar, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>대</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>대표이사</div>
                <div style={{ fontSize: 11, color: c.textMuted }}>최종 결재</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnOutline} onClick={() => { fire("임시저장되었습니다"); setModal(null); }}>임시저장</button>
          <button style={btnPrimary} onClick={() => { fire("연차신청이 제출되었습니다 ✓"); setModal(null); }}>제출하기</button>
        </div>
      </div>
    </div>
  );

  const ExpenseModal = () => (
    <div style={overlay} onClick={() => setModal(null)}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary }}>💰 품의서</span>
          <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: c.textMuted }} onClick={() => setModal(null)}>✕</button>
        </div>
        <div style={{ padding: "24px" }}>
          <div style={fieldGroup}>
            <label style={labelStyle}>제목</label>
            <input style={inputStyle} placeholder="품의 제목을 입력하세요" value={expForm.title} onChange={e => setExpForm({...expForm, title: e.target.value})} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...fieldGroup, flex: 1 }}>
              <label style={labelStyle}>금액 (원)</label>
              <input style={inputStyle} type="number" placeholder="0" value={expForm.amount} onChange={e => setExpForm({...expForm, amount: e.target.value})} />
            </div>
            <div style={{ ...fieldGroup, flex: 1 }}>
              <label style={labelStyle}>용도</label>
              <select style={inputStyle} value={expForm.purpose} onChange={e => setExpForm({...expForm, purpose: e.target.value})}>
                <option value="">선택</option>
                <option value="장비구매">장비구매</option>
                <option value="외주비">외주비</option>
                <option value="교육비">교육비</option>
                <option value="인프라/서버">인프라/서버</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>상세 내용</label>
            <textarea style={{ ...inputStyle, minHeight: 100, resize: "vertical" }} placeholder="품의 상세 내용을 입력하세요&#10;(구매처, 수량, 단가 등)"
              value={expForm.detail} onChange={e => setExpForm({...expForm, detail: e.target.value})} />
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>첨부파일</label>
            <div style={{ padding: 24, borderRadius: 8, border: `1.5px dashed #CDD1D9`, background: "#FAFBFC", textAlign: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>📎</div>
              <div style={{ fontSize: 12, color: c.textMuted }}>견적서, 참고자료 등을 첨부하세요</div>
            </div>
          </div>
          <div style={fieldGroup}>
            <label style={labelStyle}>결재자</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: `1px solid ${c.border}` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.sidebar, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>대</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary }}>대표이사</div>
                <div style={{ fontSize: 11, color: c.textMuted }}>최종 결재</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 24px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button style={btnOutline} onClick={() => { fire("임시저장되었습니다"); setModal(null); }}>임시저장</button>
          <button style={btnPrimary} onClick={() => { fire("품의서가 제출되었습니다 ✓"); setModal(null); }}>제출하기</button>
        </div>
      </div>
    </div>
  );

  const DetailModal = () => {
    if (!selected) return null;
    const d = selected;
    const isPending = d.status === "PENDING" && !actionDone[d.id];
    const displayStatus = actionDone[d.id] || d.status;
    return (
      <div style={overlay} onClick={() => setSelected(null)}>
        <div style={{ ...modalBox, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={tag(d.type)}>{d.type}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary }}>{d.title}</span>
            </div>
            <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: c.textMuted }} onClick={() => setSelected(null)}>✕</button>
          </div>

          <div style={{ padding: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "10px 0", fontSize: 14, marginBottom: 20 }}>
              <span style={{ color: c.textMuted, fontWeight: 600 }}>기안자</span>
              <span style={{ fontWeight: 600 }}>{d.author} · {d.dept}</span>
              <span style={{ color: c.textMuted, fontWeight: 600 }}>기안일</span>
              <span>{d.date}</span>
              <span style={{ color: c.textMuted, fontWeight: 600 }}>상태</span>
              <span><Badge status={displayStatus} /></span>
            </div>

            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "18px 20px", marginBottom: 20, border: `1px solid #F3F4F6` }}>
              {d.type === "연차" && d.detail && (
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px 0", fontSize: 13 }}>
                  <span style={{ color: c.textMuted, fontWeight: 600 }}>유형</span><span>{d.detail.leaveType}</span>
                  <span style={{ color: c.textMuted, fontWeight: 600 }}>기간</span><span>{d.detail.start} ~ {d.detail.end} ({d.detail.days}일)</span>
                  <span style={{ color: c.textMuted, fontWeight: 600 }}>사유</span><span>{d.detail.reason}</span>
                </div>
              )}
              {d.type === "품의" && d.detail && (
                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px 0", fontSize: 13 }}>
                  <span style={{ color: c.textMuted, fontWeight: 600 }}>금액</span><span style={{ fontWeight: 700, color: c.accent }}>₩ {d.detail.amount?.toLocaleString()}</span>
                  <span style={{ color: c.textMuted, fontWeight: 600 }}>용도</span><span>{d.detail.purpose}</span>
                  <span style={{ color: c.textMuted, fontWeight: 600 }}>내용</span><span style={{ whiteSpace: "pre-wrap" }}>{d.detail.content}</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>결재선</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#555" }}>{d.author[0]}</div>
                  <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>기안</div>
                </div>
                <div style={{ flex: 1, height: 2, background: displayStatus === "APPROVED" ? "#4ADE80" : displayStatus === "REJECTED" ? "#FCA5A5" : "#E5E7EB", borderRadius: 1, position: "relative" }}>
                  <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 12, color: "#bbb" }}>→</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: displayStatus === "APPROVED" ? "#16A34A" : displayStatus === "REJECTED" ? "#DC2626" : c.sidebar, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>대</div>
                  <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>결재</div>
                </div>
              </div>
            </div>
          </div>

          {isPending && (
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={{ ...btnOutline, borderColor: "#FCA5A5", color: "#DC2626" }}
                onClick={() => { setActionDone({...actionDone, [d.id]: "REJECTED"}); fire("반려되었습니다"); }}>
                반려
              </button>
              <button style={btnPrimary}
                onClick={() => { setActionDone({...actionDone, [d.id]: "APPROVED"}); fire("승인되었습니다 ✓"); }}>
                승인
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Pretendard Variable', 'Noto Sans KR', -apple-system, sans-serif", background: c.bg, color: c.textPrimary, overflow: "hidden" }}>
      {/* Sidebar */}
      <div style={sidebar}>
        <div style={{ padding: "22px 20px 28px" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            <span style={{ color: "#7EB5E8" }}>이끔</span>
            <span style={{ color: "#888", fontWeight: 500, fontSize: 13, marginLeft: 6 }}>전자결재</span>
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 2, letterSpacing: "0.08em" }}>IKKEUM APPROVAL</div>
        </div>

        <nav style={{ flex: 1 }}>
          {NAV.map(n => (
            <button key={n.id} style={sideNavItem(page === n.id)} onClick={() => setPage(n.id)}>
              <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid #333" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800 }}>DY</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ddd" }}>대영</div>
              <div style={{ fontSize: 10, color: "#888" }}>대표이사</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", padding: "28px 36px" }}>
        {page === "dashboard" && <Dashboard />}
        {page === "approval" && <ApprovalPage />}
        {page === "mydocs" && <MyDocsPage />}
      </div>

      {/* Modals */}
      {modal === "leave" && <LeaveModal />}
      {modal === "expense" && <ExpenseModal />}
      {selected && <DetailModal />}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          background: c.sidebar, color: "#fff", padding: "12px 28px", borderRadius: 10,
          fontSize: 13, fontWeight: 700, zIndex: 200,
          boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
        }}>{toast}</div>
      )}
    </div>
  );
}
