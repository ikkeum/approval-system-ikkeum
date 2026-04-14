import LoginForm from "./LoginForm";

type SP = { next?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { next } = await searchParams;
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <LoginForm next={next || "/dashboard"} />
    </main>
  );
}
