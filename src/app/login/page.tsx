import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { Logo } from "@/components/Logo";
import { hasSession } from "@/lib/auth";

export default async function LoginPage() {
  if (await hasSession()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6">
          <Logo />
          <h1 className="mt-4 text-xl font-semibold">Sign in to Deal Intel</h1>
          <p className="mt-1 text-sm text-muted">Live deal health from your HubSpot pipeline.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
