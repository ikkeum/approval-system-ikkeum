import path from "node:path";
import fs from "node:fs";

// sign-generator는 타입 정의가 없음.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - no types
import { createStamp } from "sign-generator";

// 폰트 파일은 프로젝트 루트의 fonts/ 디렉터리에 둡니다.
// Vercel 빌드 시 Next.js가 outputFileTracing으로 이 파일들을 함수 번들에 포함.
const FONT_DIR = path.join(process.cwd(), "fonts");

// 사내 공식 직인 폰트: MaruBuri.
// 다른 폰트로 바꾸려면 이 배열만 교체.
const FONT_CANDIDATES = ["MaruBuri.ttf"];

function resolveFonts(): string[] {
  const available = FONT_CANDIDATES.map((f) => path.join(FONT_DIR, f)).filter(
    (p) => fs.existsSync(p),
  );
  if (available.length === 0) {
    throw new Error(
      "폰트 파일이 없습니다. fonts/README.md 를 보고 MISEANG.ttf 등을 다운로드해주세요.",
    );
  }
  return available;
}

export async function generateStamp(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("이름이 비어 있습니다.");

  // 전통 직인은 이름 끝에 '인(印)' 자를 붙임. 이미 붙어있으면 중복 방지.
  const stampText = trimmed.endsWith("인") ? trimmed : `${trimmed}인`;

  const fonts = resolveFonts();

  const svgs: string[] = await createStamp(stampText, fonts, {
    boxOption: { width: 160, height: 160 },
    borderOption: { stroke: "#c62828", strokeWidth: 3 },
    attributes: { fill: "#c62828" },
    fontSize: 38,
  });

  return svgs[0] ?? svgs.join("\n");
}
