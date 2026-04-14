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

export type LeavePayloadT = z.infer<typeof LeavePayload>;
export type ExpensePayloadT = z.infer<typeof ExpensePayload>;

export const SignupInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(40),
});

export const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
