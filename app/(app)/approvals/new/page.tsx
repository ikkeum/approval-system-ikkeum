import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LeaveForm from "./LeaveForm";
import ExpenseForm from "./ExpenseForm";

type SP = { type?: "leave" | "expense" };

export default async function NewApprovalPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { type = "leave" } = await searchParams;
  if (type !== "leave" && type !== "expense")
    redirect("/approvals/new?type=leave");

  const supabase = await createClient();

  // 대표(2단계) 이름만 안내용으로 조회
  const { data: exec } = await supabase
    .from("profiles")
    .select("name,dept")
    .eq("is_executive", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main style={{ padding: "32px 40px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        {type === "leave" ? "연차 신청" : "품의 작성"}
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
        결재 라인: <strong>본인(기안)</strong> → <strong>대표</strong>
        {exec ? ` (${exec.name}${exec.dept ? ` · ${exec.dept}` : ""})` : ""}
        . 제출하면 대표에게 대기 상태로 전달됩니다.
      </p>
      {type === "leave" ? <LeaveForm /> : <ExpenseForm />}
    </main>
  );
}
