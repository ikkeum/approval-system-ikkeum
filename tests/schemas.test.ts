import { describe, it, expect } from "vitest";
import { PersonName, SignupInput } from "@/lib/schemas";

describe("PersonName (직인 텍스트로 들어가는 이름 화이트리스트)", () => {
  it.each(["홍길동", "김 철수", "John Doe", "Jean-Luc", "안나·리"])(
    "정상 이름 허용: %s",
    (name) => {
      expect(PersonName.safeParse(name).success).toBe(true);
    },
  );

  it.each([
    "<script>alert(1)</script>",
    '홍길동" onload="alert(1)',
    "a<b>c",
    "",
  ])("위험 문자/빈 값 거부: %s", (name) => {
    expect(PersonName.safeParse(name).success).toBe(false);
  });
});

describe("SignupInput.name 도 동일 규칙을 적용한다", () => {
  const base = { email: "a@idealkr.com", password: "12345678" };
  it("정상 이름 통과", () => {
    expect(SignupInput.safeParse({ ...base, name: "홍길동" }).success).toBe(true);
  });
  it("HTML 메타문자 거부", () => {
    expect(
      SignupInput.safeParse({ ...base, name: "<svg onload=alert(1)>" }).success,
    ).toBe(false);
  });
});
