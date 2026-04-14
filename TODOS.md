# TODOs

## 문서 템플릿 + 결재 라인 CRUD (대규모 리팩토링)

**상태**: 미시작
**동기**: 현재 6개 문서 유형이 코드에 하드코딩. 새 유형(사직서, 인재추천서 등) 추가 시 마이그레이션 + 폼 + 액션 + 렌더러 모두 손대야 함. 결재 라인도 "본인 → 팀장/대표" 2단계로 고정. 유형별로 결재 라인이 달라지는 업무 확장 불가.

**목표 상태**: admin이 `/admin/templates` 에서 문서 템플릿을 CRUD할 수 있고, 각 템플릿별로 입력 필드·결재 라인을 정의할 수 있음. 신청 시 시스템이 템플릿 정의를 읽어 동적으로 폼을 렌더링하고 결재 라인을 구성.

---

### Non-goals

- 조건부 분기 결재선(예: 금액 ≥ N원이면 대표 추가). **1차 버전은 선형 체인만**. 조건부는 그 다음 버전.
- WYSIWYG 폼 빌더 UI. 1차는 JSON 편집 or 필드 타입별 버튼 추가 정도.
- 템플릿 versioning. 템플릿 수정 시 기존 제출 건은 당시 스냅샷으로 동결 (하기 스키마에 반영).

---

### Phase 1 — 스키마 확장

**새 테이블**:

```sql
create table public.approval_templates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- 예: 'resignation', 'referral'
  name text not null,                     -- 예: '사직서'
  description text,
  color text default '#E0E7FF',           -- TypeTag 색
  fields jsonb not null default '[]',     -- 입력 필드 정의 (아래 스키마)
  chain jsonb not null default '[]',      -- 결재 라인 정의 (아래 스키마)
  title_template text,                    -- 예: '사직서 ({reason})' — payload 에서 치환
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_templates_active on approval_templates(is_active, code);
```

**`fields` JSONB 규격**:
```json
[
  { "name": "reason",   "label": "사유",   "type": "textarea", "required": true,  "maxLength": 2000 },
  { "name": "eff_date", "label": "퇴사일", "type": "date",     "required": true }
]
```
지원 필드 타입: `text`, `textarea`, `date`, `daterange`, `number`, `select` (+ options), `currency`.

**`chain` JSONB 규격** (1차: 정적 체인):
```json
[
  { "role": "self",         "label": "기안",   "auto_approve": true },
  { "role": "team_leader",  "label": "팀장" },
  { "role": "hr",           "label": "인사" },
  { "role": "executive",    "label": "대표" }
]
```
지원 role:
- `self` — 기안자 본인 (auto_approve: true면 제출 즉시 승인 처리)
- `team_leader` — 작성자 소속 팀의 leader_id
- `executive` — profiles.is_executive = true
- `hr` — (추후) HR 역할자. `profiles.role` 에 'hr' 추가하거나 별도 플래그
- `specific:{user_id}` — 지정된 한 명 (특수 문서용)

**`approvals` 테이블 확장**:
```sql
alter table public.approvals
  add column if not exists template_id uuid references approval_templates(id),
  add column if not exists chain_snapshot jsonb;  -- 제출 시점 체인 스냅샷 + 각 단계 status
```

`chain_snapshot` 런타임 구조:
```json
{
  "steps": [
    { "step": 1, "role": "self",        "approver_id": "u1", "status": "approved", "decided_at": "...", "comment": null },
    { "step": 2, "role": "team_leader", "approver_id": "u2", "status": "pending",  "decided_at": null,  "comment": null },
    { "step": 3, "role": "executive",   "approver_id": "u3", "status": "pending" }
  ],
  "current_step": 2
}
```

**기존 컬럼 유지**:
- `type` text → 사실상 `template.code` 의 alias 로만 유지 (backward compat)
- `approver_id` → 현재 대기 중인 결재자 (denormalized, 인덱스용)
- `first_approver_id / second_approver_id / step / first_decided_at / first_comment` → 유지하되 **신규 제출부터는 chain_snapshot 사용**. 기존 데이터 백필로 chain_snapshot 채워넣기.

---

### Phase 2 — Admin 템플릿 관리 UI

**라우트**: `/admin/templates`

- 목록: 템플릿 카드 그리드 (code, name, 단계 수, 활성 여부, 사용 건수)
- 생성/수정 폼:
  - 상단: code, name, description, color
  - 가운데: **필드 빌더** — 필드 추가 버튼 → 타입 선택 → name/label 입력. DnD로 순서 변경
  - 하단: **결재 라인 빌더** — 단계 추가 → role 선택 → label. DnD로 순서 변경
  - 미리보기: 실제 폼이 어떻게 렌더링되는지
- 삭제: 해당 템플릿으로 제출된 approvals 가 있으면 `is_active = false` 토글만, 실제 DELETE 는 0건일 때만

**권한**:
- admin만 CRUD
- 일반 사용자는 읽기 전용 (신청 화면에서 활성 템플릿 목록 조회)

**RLS**:
```sql
alter table approval_templates enable row level security;

create policy "templates_read_active" on approval_templates
  for select to authenticated using (is_active = true);

-- admin service_role 경유로만 쓰기 (admin members 와 동일 패턴)
```

---

### Phase 3 — 동적 폼 + 결재 라인 실행

**신청 페이지** `/approvals/new?template={code}`:
- 템플릿 조회 → `fields` 읽어 `SimpleForm` 을 동적으로 렌더
- `SimpleForm` 컴포넌트에 타입 확장: `select`, `currency` 등 추가
- 제출 시 `chain` 을 해석해 `chain_snapshot` 생성:
  ```ts
  async function resolveChain(template, author) {
    const steps = [];
    for (const step of template.chain) {
      steps.push({
        step: steps.length + 1,
        role: step.role,
        approver_id: await resolveRole(step.role, author),
        label: step.label,
        status: step.auto_approve ? "approved" : "pending",
        decided_at: step.auto_approve ? now() : null,
      });
    }
    // current_step = 첫 번째 pending 의 step
  }
  ```

**RPC `advance_approval` 확장**:
- chain_snapshot 에서 현재 step 찾아 status 업데이트
- 다음 pending step 이 있으면 `approver_id` 를 그 사람으로 이동, status 유지 PENDING
- 마지막 step 이면 status=APPROVED

**기존 2단계 RPC는 폐기 or chain 기반으로 재작성**. 롤백 가능하게 새 RPC `advance_approval_v2` 로 만들고 feature flag.

---

### Phase 4 — 상세·목록·UI 통합

- 결재 라인 카드: `chain_snapshot.steps.length` 만큼 카드 렌더. 현재 step 은 "진행 중" 색, 이전은 "승인"/"반려", 이후는 "대기".
- 상세 렌더러: 현재 타입별 분기(LeaveDetails, ExpenseDetails 등)를 **필드 정의 기반 generic 렌더러**로 교체. payload 의 각 key 를 fields 에서 label 매칭해 표시.
- `NewApprovalMenu` 드롭다운: `APPROVAL_TYPES` 하드코딩 제거, `approval_templates where is_active = true` 동적 조회
- TypeTag 색: 템플릿의 `color` 컬럼 사용

---

### Phase 5 — 마이그레이션 & 정리

1. 기존 6개 타입을 seed 템플릿으로 삽입 (leave / expense / leave_of_absence / reinstatement / employment_cert / career_cert)
2. 기존 approvals row 의 `chain_snapshot` 백필 (1단계=self, 2단계=second_approver)
3. 하드코딩된 TYPE_KO / APPROVAL_TYPES / 개별 폼 / 개별 Details 컴포넌트 / 개별 서버 액션 제거
4. `lib/schemas.ts` 의 payload Zod들 → 필드 정의 기반 동적 validator 로
5. Feature flag 단계적 제거 (v2 → v1 교체)

---

### 예상 공수

| Phase | 난이도 | 시간(AI 페어) |
|---|---|---|
| 1. 스키마 | Low | 30분 |
| 2. Admin UI | Medium | 2~3시간 (필드/체인 빌더) |
| 3. 실행 로직 | Medium-High | 2시간 (RPC 재설계) |
| 4. UI 통합 | Low-Med | 1시간 |
| 5. 마이그레이션/정리 | Medium | 1~2시간 |
| **합계** | | **6~9시간** |

---

### 리스크 / 결정 필요 사항

- **chain JSONB vs approval_steps 테이블**: 초안은 JSONB. 감사 쿼리(누가 언제 승인) 많아지면 테이블로 리팩토링. Phase 5 에 재검토.
- **조건부 결재**: "금액 ≥ 100만원 품의는 대표 추가" 같은 규칙. 1차 스코프 밖. chain 구조에 `condition` 키 자리만 남겨두기.
- **템플릿 수정의 소급 영향**: 이미 제출된 건은 제출 당시 chain_snapshot 로 고정. 템플릿 수정 시 향후 제출에만 적용. DB 컬럼 `chain_snapshot` 이 핵심 (snapshot 이라는 네이밍 의도).
- **필드 삭제 vs 비활성화**: 기존 제출 건의 payload 에 없는 필드가 생기거나 반대 경우 렌더러가 깨지지 않도록 관대하게(`payload[field.name] ?? "-"`).
- **호환성 유지**: Phase 4까지는 기존 `first_approver_id` 기반 코드와 새 chain 기반 코드가 공존. 혼란 방지를 위해 Phase 5에서 동시 제거.

---

### 발단 이력

- 2026-04-14: 팀 기능 추가 중 사용자 요청 "추후에는 3단 결재 기능도 넣어야 해. EX) 사직서, 인재 추천서 등등". 1차는 고정 2단계(본인→팀장/대표) 유지, 본 TODO 로 확장 계획 기록.
