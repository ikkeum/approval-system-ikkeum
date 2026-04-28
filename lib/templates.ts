import type { createClient } from "@/lib/supabase/server";

type SB = Awaited<ReturnType<typeof createClient>>;

// ============================================================================
// 폼 필드 스키마 (DynamicForm 이 소비)
// ============================================================================

export type FieldDef =
  | {
      kind: "date";
      name: string;
      label: string;
      required?: boolean;
    }
  | {
      kind: "text";
      name: string;
      label: string;
      required?: boolean;
      placeholder?: string;
      maxLength?: number;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      required?: boolean;
      rows?: number;
      maxLength?: number;
    }
  | {
      kind: "number";
      name: string;
      label: string;
      required?: boolean;
      min?: number;
      max?: number;
      defaultValue?: number;
    }
  | {
      kind: "daterange";
      startName: string;
      endName: string;
      label: string;
      required?: boolean;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      required?: boolean;
      options: string[];
    }
  | {
      kind: "row";
      children: FieldDef[];
    };

// ============================================================================
// 결재 라인 (체인)
// ============================================================================

export type ChainStepMode =
  | "author"
  | "fixed"
  | "team_leader"
  | "executive"
  | "picker";

export type ChainStep = {
  index: number;
  label: string;
  mode: ChainStepMode;
  approver_id?: string; // mode=fixed 일 때
};

// ============================================================================
// 템플릿
// ============================================================================

export type DocumentTemplate = {
  id: string;
  key: string;
  name: string;
  short_name: string;
  sort_order: number;
  is_active: boolean;
  schema: FieldDef[];
  chain: ChainStep[];
  title_template: string | null;
};

const TEMPLATE_COLS =
  "id,key,name,short_name,sort_order,is_active,schema,chain,title_template";

export async function loadActiveTemplates(
  supabase: SB,
): Promise<DocumentTemplate[]> {
  const { data } = await supabase
    .from("document_templates")
    .select(TEMPLATE_COLS)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as DocumentTemplate[];
}

export async function loadTemplateByKey(
  supabase: SB,
  key: string,
): Promise<DocumentTemplate | null> {
  const { data } = await supabase
    .from("document_templates")
    .select(TEMPLATE_COLS)
    .eq("key", key)
    .maybeSingle();
  return (data as DocumentTemplate) ?? null;
}

export async function loadTemplateById(
  supabase: SB,
  id: string,
): Promise<DocumentTemplate | null> {
  const { data } = await supabase
    .from("document_templates")
    .select(TEMPLATE_COLS)
    .eq("id", id)
    .maybeSingle();
  return (data as DocumentTemplate) ?? null;
}

// ============================================================================
// 유틸: 필드 평탄화 (row 풀어 leaf 만 반환)
// ============================================================================

type LeafField = Exclude<FieldDef, { kind: "row" }>;

export function flattenFields(fields: FieldDef[]): LeafField[] {
  const out: LeafField[] = [];
  for (const f of fields) {
    if (f.kind === "row") out.push(...flattenFields(f.children));
    else out.push(f);
  }
  return out;
}

// ============================================================================
// 제목 템플릿 치환: '{{key}}' → payload[key]
// title_template 이 없으면 fallback 사용
// ============================================================================

export function renderTitle(
  template: DocumentTemplate,
  payload: Record<string, unknown>,
  fallback: string,
): string {
  const tpl = template.title_template;
  if (!tpl) return fallback;
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = payload[k];
    return v == null ? "" : String(v);
  });
}
