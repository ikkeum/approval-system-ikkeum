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
  if (type !== "leave" && type !== "expense") redirect("/approvals/new?type=leave");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 결재자 후보: 본인 제외 전체. (소규모 팀에선 이게 가장 유연)
  const { data: approvers } = await supabase
    .from("profiles")
    .select("id,name,dept,role")
    .neq("id", user!.id)
    .order("name");

  // 기본 선택: 본인의 manager_id
  const { data: me } = await supabase
    .from("profiles")
    .select("manager_id")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <main style={{ padding: "32px 40px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
        {type === "leave" ? "연차 신청" : "품의 작성"}
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
        임시저장은 언제든 다시 열어 수정할 수 있습니다. 제출하면 결재자에게
        대기 상태로 전달됩니다.
      </p>
      {type === "leave" ? (
        <LeaveForm approvers={approvers ?? []} defaultApproverId={me?.manager_id ?? null} />
      ) : (
        <ExpenseForm approvers={approvers ?? []} defaultApproverId={me?.manager_id ?? null} />
      )}
    </main>
  );
}
