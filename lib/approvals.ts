export type ApprovalStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELED";

export type ApprovalType = "leave" | "expense";

export type ApprovalRow = {
  id: number;
  type: ApprovalType;
  title: string;
  author_id: string;
  approver_id: string | null;
  first_approver_id: string | null;
  second_approver_id: string | null;
  step: 1 | 2;
  first_decided_at: string | null;
  first_comment: string | null;
  status: ApprovalStatus;
  payload: Record<string, unknown>;
  attachments: unknown[];
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  updated_at: string;
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

export const TYPE_KO: Record<ApprovalType, string> = {
  leave: "연차",
  expense: "품의",
};
