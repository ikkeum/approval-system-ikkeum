import crypto from "node:crypto";

type LeaveType = "연차" | "오전반차" | "오후반차";

export type LeaveCalendarInput = {
  name: string;
  leaveType: LeaveType;
  start: string;
  end: string;
};

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const TIMEZONE = "Asia/Seoul";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("Google service account env vars missing");
  }
  const key = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimPayload: Record<string, unknown> = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const subject = process.env.GOOGLE_IMPERSONATE_USER;
  if (subject) claimPayload.sub = subject;
  const claim = base64url(JSON.stringify(claimPayload));
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
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token exchange returned no access_token");
  return data.access_token;
}

function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function buildEventBody(input: LeaveCalendarInput) {
  const summary = `${input.name}_${input.leaveType}`;
  if (input.leaveType === "연차") {
    return {
      summary,
      start: { date: input.start },
      end: { date: addDays(input.end, 1) },
    };
  }
  const [startTime, endTime] =
    input.leaveType === "오전반차" ? ["09:00:00", "14:00:00"] : ["14:00:00", "19:00:00"];
  return {
    summary,
    start: { dateTime: `${input.start}T${startTime}`, timeZone: TIMEZONE },
    end: { dateTime: `${input.start}T${endTime}`, timeZone: TIMEZONE },
  };
}

export async function insertLeaveEvent(input: LeaveCalendarInput): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error("GOOGLE_CALENDAR_ID missing");
  const token = await getAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildEventBody(input)),
  });
  if (!res.ok) {
    throw new Error(`calendar insert failed: ${res.status} ${await res.text()}`);
  }
}
