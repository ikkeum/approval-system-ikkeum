import crypto from "node:crypto";

// Google Chat REST API. Service Account JWT bearer 인증 → outbound DM 전송 전용.
// 사용자가 봇한테 보낸 메시지는 처리하지 않음 (Chat App config에 placeholder URL).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/chat.bot";

type SAKey = {
  client_email: string;
  private_key: string;
};

function loadSAKey(): SAKey | null {
  const raw = process.env.GOOGLE_CHAT_SA_KEY_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SAKey>;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(): Promise<string | null> {
  const sa = loadSAKey();
  if (!sa) return null;
  const key = sa.private_key.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
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
      "[chat] token exchange failed",
      res.status,
      await res.text(),
    );
    return null;
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export type ChatCard = {
  title: string;
  buttonText: string;
  buttonUrl: string;
};

/**
 * Workspace 사용자(이메일)에게 카드 DM을 보낸다.
 * - spaces:setUp: DM 공간이 없으면 생성, 있으면 기존 반환 (idempotent)
 * - 그 후 cardsV2 메시지 POST
 *
 * 반환: 성공 여부. 실패해도 throw 하지 않음 (호출부는 fire-and-forget).
 */
export async function sendDmCard(
  toEmail: string,
  card: ChatCard,
): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const setupRes = await fetch(
    "https://chat.googleapis.com/v1/spaces:setup",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        space: { spaceType: "DIRECT_MESSAGE" },
        memberships: [
          { member: { name: `users/${toEmail}`, type: "HUMAN" } },
        ],
      }),
    },
  );
  if (!setupRes.ok) {
    console.error(
      "[chat] space setup failed",
      setupRes.status,
      await setupRes.text(),
    );
    return false;
  }
  const space = (await setupRes.json()) as { name?: string };
  if (!space.name) return false;

  const msgRes = await fetch(
    `https://chat.googleapis.com/v1/${space.name}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cardsV2: [
          {
            cardId: "approval-notification",
            card: {
              header: { title: card.title },
              sections: [
                {
                  widgets: [
                    {
                      buttonList: {
                        buttons: [
                          {
                            text: card.buttonText,
                            onClick: {
                              openLink: { url: card.buttonUrl },
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
    },
  );
  if (!msgRes.ok) {
    console.error(
      "[chat] message send failed",
      msgRes.status,
      await msgRes.text(),
    );
    return false;
  }
  return true;
}
