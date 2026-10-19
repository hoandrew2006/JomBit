import { AlertCircle, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, PlayCircle, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { Brand, BrandLogo } from "./ui";

interface Props {
  children: (user?: User, demo?: { exit: () => void }) => ReactNode;
}

export function AuthGate({ children }: Props) {
  const supabase = getSupabase();
  const [user, setUser] = useState<User | null | undefined>(() => supabaseConfigured ? undefined : null);
  const [demo, setDemo] = useState(false);

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

  if (demo) return children(undefined, { exit: () => setDemo(false) });
  if (!supabaseConfigured) return children(undefined);
  if (user === undefined) return <div className="app-loading"><BrandLogo />Connecting to JomBit…</div>;
  if (!user) return <AuthScreen onDemo={() => setDemo(true)} />;
  return children(user);
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const supabase = getSupabase()!;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    if (result.error) return setError(authErrorMessage(result.error.message, mode));
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your JomBit account, then sign in.");
      setMode("signin");
    }
  };

  const switchMode = (nextMode: "signin" | "signup") => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <header className="auth-header">
          <Brand />
          <div className="auth-heading">
            <h1 id="auth-title">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p>Access your shared expenses on any device.</p>
          </div>
        </header>
        <form className="auth-form" id="auth-panel" onSubmit={submit} aria-busy={busy}>
          {mode === "signup" && <label><span>Display name</span><span className="auth-input"><UserRound size={18} /><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="How friends see you" /></span></label>}
          <label><span>Email</span><span className="auth-input"><Mail size={18} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" /></span></label>
          <label><span>Password</span><span className="auth-input"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="At least 8 characters" /><button className="auth-password-toggle" type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
          {error && <p className="auth-error" role="alert"><AlertCircle size={17} /><span>{error}</span></p>}
          {message && <p className="auth-message" role="status"><CheckCircle2 size={17} /><span>{message}</span></p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in to JomBit" : "Create account"}</button>
        </form>
        <p className="auth-mode-switch">{mode === "signin" ? "New to JomBit?" : "Already have an account?"} <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
        <div className="auth-demo-entry"><span>or</span><button className="secondary-button" type="button" onClick={onDemo}><PlayCircle size={18} /> Explore the demo</button><p>Explore with sample data. No account needed.</p></div>
        <p className="fine-print">Wallet and crypto features use test balances.</p>
      </section>
    </main>
  );
}

function authErrorMessage(message: string, mode: "signin" | "signup") {
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit") || normalized.includes("email rate")) {
    return "Too many confirmation emails were requested. Please wait before trying again.";
  }
  if (normalized.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (normalized.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "An account already exists for this email. Sign in instead.";
  }
  return mode === "signin"
    ? "We couldn’t sign you in. Check your details and try again."
    : "We couldn’t create your account. Please try again.";
}
