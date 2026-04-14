import { z } from "zod";

export const LeavePayload = z.object({
  leaveType: z.enum(["연차", "오전반차", "오후반차"]),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().positive().max(30),
  reason: z.string().min(1).max(500),
});

export const ExpensePayload = z.object({
  amount: z.number().int().nonnegative().max(100_000_000),
  purpose: z.string().min(1).max(50),
  content: z.string().min(1).max(2000),
});

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LeaveOfAbsencePayload = z.object({
  start: DateStr,
  end: DateStr,
  reason: z.string().min(1).max(2000),
});

export const ReinstatementPayload = z.object({
  return_date: DateStr,
  reason: z.string().min(1).max(1000),
});

export const EmploymentCertPayload = z.object({
  purpose: z.string().min(1).max(200),
  destination: z.string().max(200).optional().default(""),
  copies: z.number().int().min(1).max(10),
});

export const CareerCertPayload = z.object({
  purpose: z.string().min(1).max(200),
  destination: z.string().max(200).optional().default(""),
  period_start: DateStr.optional().or(z.literal("")),
  period_end: DateStr.optional().or(z.literal("")),
  copies: z.number().int().min(1).max(10),
});

export type LeavePayloadT = z.infer<typeof LeavePayload>;
export type ExpensePayloadT = z.infer<typeof ExpensePayload>;
export type LeaveOfAbsencePayloadT = z.infer<typeof LeaveOfAbsencePayload>;
export type ReinstatementPayloadT = z.infer<typeof ReinstatementPayload>;
export type EmploymentCertPayloadT = z.infer<typeof EmploymentCertPayload>;
export type CareerCertPayloadT = z.infer<typeof CareerCertPayload>;

export const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(40),
});

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
