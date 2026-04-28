import crypto from "node:crypto";

// Gmail API 발송. Calendar SA 재활용:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
// 추가:
//   GOOGLE_MAIL_FROM = 발신자 (DWD 로 impersonate 할 GWS 사용자, 예: noreply@idealkr.com)
//
// Workspace Admin 에서 위 SA client_id 에 scope 'gmail.send' 가 위임돼 있어야 한다.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(impersonate: string): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    console.error("[mail] service account env vars missing");
    return null;
  }
  const key = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      sub: impersonate,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = base64url(signer.sign(key));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.error(
      "[mail] token exchange failed",
      res.status,
      await res.text(),
    );
    return null;
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

function encodeUtf8Subject(s: string): string {
  // RFC 2047 encoded-word: =?UTF-8?B?<base64>?=
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function buildRfc5322(opts: {
  from: string;
  to: string;
  subject: string;
  htmlBody: string;
}): string {
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${encodeUtf8Subject(opts.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  // HTML body는 base64로 인코딩해서 한글·이모지 안전 전송
  const bodyB64 = Buffer.from(opts.htmlBody, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
  return headers.join("\r\n") + "\r\n\r\n" + bodyB64;
}

export type MailInput = {
  to: string;
  subject: string;
  htmlBody: string;
};

/**
 * Gmail API로 메일 발송. fire-and-forget 호출자가 결과를 await 해도 throw 하지 않음.
 */
export async function sendMail(input: MailInput): Promise<boolean> {
  const from = process.env.GOOGLE_MAIL_FROM;
  if (!from) {
    console.error("[mail] GOOGLE_MAIL_FROM missing");
    return false;
  }
  const token = await getAccessToken(from);
  if (!token) return false;

  const message = buildRfc5322({
    from,
    to: input.to,
    subject: input.subject,
    htmlBody: input.htmlBody,
  });
  const raw = base64url(Buffer.from(message, "utf8"));

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );
  if (!res.ok) {
    console.error("[mail] send failed", res.status, await res.text());
    return false;
  }
  return true;
}
