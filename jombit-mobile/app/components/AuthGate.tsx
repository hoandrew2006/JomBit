import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { BrandLogo } from "./ui";

interface Props {
  children: (user?: User) => ReactNode;
}

export function AuthGate({ children }: Props) {
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null | undefined>(() => supabaseConfigured ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setUser(data.session?.user ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  if (!supabaseConfigured) return children(undefined);
  if (user === undefined) return <div className="app-loading"><BrandLogo />Connecting to JomBit…</div>;
  if (!user) return <AuthScreen />;
  return children(user);
}

function AuthScreen() {
  const supabase = getSupabase()!;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() || "JomBit Member" },
            emailRedirectTo: new URL("/?app=1", window.location.origin).href,
          },
        });
    setBusy(false);
    if (result.error) return setError(result.error.message);
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your JomBit account, then sign in.");
      setMode("signin");
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <BrandLogo />
        <p className="eyebrow">YOUR SHARED MONEY, IN SYNC</p>
        <h1>{mode === "signin" ? "Welcome back." : "Create your JomBit account."}</h1>
        <p>Keep your groups, expenses and demo wallet available across your devices.</p>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(""); }}>Sign in</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && <label><span>Display name</span><span className="auth-input"><UserRound size={18} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="How friends see you" /></span></label>}
          <label><span>Email</span><span className="auth-input"><Mail size={18} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></span></label>
          <label><span>Password</span><span className="auth-input"><LockKeyhole size={18} /><input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="At least 8 characters" /></span></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in to JomBit" : "Create account"}</button>
        </form>
        <p className="fine-print">JomBit remains a proof of concept. Wallet, settlement, card and staking actions are simulated.</p>
      </section>
    </main>
  );
}
