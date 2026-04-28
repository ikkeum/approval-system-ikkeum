export type ApprovalStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED";

export type ApprovalType =
  | "leave"
  | "expense"
  | "leave_of_absence"
  | "reinstatement"
  | "employment_cert"
  | "career_cert";

export const APPROVAL_TYPES: {
  key: ApprovalType;
  label: string;
  short: string;
}[] = [
  { key: "leave", label: "연차 신청", short: "연차" },
  { key: "expense", label: "품의서 작성", short: "품의" },
  { key: "leave_of_absence", label: "휴직원 신청", short: "휴직" },
  { key: "reinstatement", label: "복직원 신청", short: "복직" },
  { key: "employment_cert", label: "재직증명서 신청", short: "재직증명" },
  { key: "career_cert", label: "경력증명서 신청", short: "경력증명" },
];

export type ApprovalRow = {
  id: number;
  type: ApprovalType;
  template_id: string | null;
  title: string;
  author_id: string;
  approver_id: string | null;
  current_step: number;
  total_steps: number;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  attachments: unknown[];
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  updated_at: string;
};

export type ApprovalStepStatus =
  | "WAITING"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SKIPPED";

export type ApprovalStepMode =
  | "author"
  | "fixed"
  | "team_leader"
  | "executive"
  | "picker";

export type ApprovalStepRow = {
  approval_id: number;
  step_index: number;
  approver_id: string;
  mode: ApprovalStepMode;
  status: ApprovalStepStatus;
  decided_at: string | null;
  comment: string | null;
};

export const STATUS_KO: Record<ApprovalStatus, string> = {
  DRAFT: "임시저장",
  PENDING: "승인대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELED: "철회",
};

export const STATUS_STYLE: Record<
  ApprovalStatus,
  { bg: string; text: string; border: string }
> = {
  DRAFT: { bg: "#EFF6FF", text: "#2563EB", border: "#93C5FD" },
  PENDING: { bg: "#FFF8F0", text: "#D97706", border: "#FBBF24" },
  APPROVED: { bg: "#F0FDF4", text: "#16A34A", border: "#4ADE80" },
  REJECTED: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" },
  CANCELED: { bg: "#F3F4F6", text: "#6B7280", border: "#D1D5DB" },
};

export const TYPE_KO: Record<ApprovalType, string> = Object.fromEntries(
  APPROVAL_TYPES.map((t) => [t.key, t.short]),
) as Record<ApprovalType, string>;
