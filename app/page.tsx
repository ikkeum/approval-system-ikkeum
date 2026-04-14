import { redirect } from "next/navigation";

export default function Home() {
  // middleware가 미인증이면 /login으로 리다이렉트, 인증이면 그대로 /dashboard로 보냄.
  redirect("/dashboard");
}
