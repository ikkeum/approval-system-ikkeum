# Changelog

스펙 단위 변경 기록. 형식: 날짜 · 스펙 · 요약 · 에이전트/작성자

## 2026-06-12

- **[security-hardening-202606](./specs/security-hardening-202606.md)** — 보안 강화 일괄 적용
  - RLS: 기안자 자가 승인 차단, 결재자 직접 UPDATE 제거, approval_steps 기안자 쓰기 제거, attendances 직접 쓰기 제거, 팀장 근태 열람 범위 축소 (`supabase/migrations/20260612000001_security_hardening.sql`)
  - 코드: submitAction·check-in/out 을 service_role 경유로 전환, `lib/ip.ts` 스푸핑 방어(x-real-ip 우선/XFF rightmost), 직인 SVG DOMPurify sanitize(`lib/stamp-svg.ts`), 이름 입력 문자 화이트리스트(`PersonName`)
  - 테스트: vitest 도입, 22 케이스, CI test 단계 추가
  - ⚠️ 마이그레이션은 코드 배포 **후** 적용할 것 (스펙의 "배포 후 수동 검증" 절차 참조)
  - 작성: Claude Code (Fable 5) · 세션 2026-06-12
