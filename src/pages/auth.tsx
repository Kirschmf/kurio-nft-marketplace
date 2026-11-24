import { useEffect, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowLeft, X } from "lucide-react";
import { api, auth, errorMessage, errorsFrom } from "../lib/client";
import { loginSchema, registerSchema, fieldErrors } from "../lib/validation";
import { safeReturnTo } from "../lib/return-to";
import { Dialog } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import {
  Busy,
  DemoInfo,
  Field,
  PasswordField,
  useNotice,
} from "../components/common";

export function AuthPage({ register = false }: { register?: boolean }) {
  const search = useSearch({ strict: false }) as { redirect?: string },
    navigate = useNavigate(),
    notice = useNotice(),
    [form, setForm] = useState({
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
    }),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [info, setInfo] = useState(""),
    [desktop, setDesktop] = useState(window.innerWidth > 600);
  useEffect(() => {
    const media = matchMedia("(min-width: 601px)");
    const change = () => setDesktop(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (Object.keys(errors).length)
      document.querySelector<HTMLInputElement>("[aria-invalid=true]")?.focus();
  }, [errors]);
  const redirect = safeReturnTo(search.redirect, window.location.origin);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = (register ? registerSchema : loginSchema).safeParse(form);
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setError("");
    setBusy(true);
    try {
      const response = register
        ? await api.register(result.data)
        : await api.login(result.data);
      const adjustments = await auth.accept(response);
      if (adjustments.length) notice(adjustments.join(" "));
      await navigate({ to: redirect });
    } catch (error) {
      setErrors(errorsFrom(error));
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const content = (
    <div className="auth-backdrop">
      <div className="auth-background" aria-hidden="true">
        <img src="/assets/emerald.webp" alt="" />
        <span>
          SEJA DONO DO FUTURO
          <br />
          DA ARTE DIGITAL
        </span>
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <Link to="/" className="auth-close" aria-label="Voltar ao início">
          <X size={20} />
        </Link>
        <Link to="/" className="mobile-auth-back">
          <ArrowLeft size={20} />
          Voltar
        </Link>
        <h1 id="auth-title">{register ? "Cadastre-se" : "Entrar"}</h1>
        <p>
          {register
            ? "Crie sua conta e comece sua coleção."
            : "Bem-vindo de volta à Kurio."}
        </p>
        <form onSubmit={submit} noValidate>
          {register && (
            <Field
              label="Nome de usuário"
              autoComplete="username"
              required
              value={form.username}
              onChange={(event) =>
                setForm({ ...form, username: event.target.value })
              }
              error={errors.username}
            />
          )}
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            error={errors.email}
          />
          <PasswordField
            label="Senha"
            autoComplete={register ? "new-password" : "current-password"}
            required
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            error={errors.password}
          />
          {register && (
            <>
              <PasswordField
                label="Confirmar senha"
                autoComplete="new-password"
                required
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm({ ...form, confirmPassword: event.target.value })
                }
                error={errors.confirmPassword}
              />
              <small>Use pelo menos 12 caracteres.</small>
            </>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Busy label={register ? "Criando conta" : "Entrando"} />
            ) : register ? (
              "Criar conta"
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
        {!register && (
          <button
            className="text-link forgot-password"
            onClick={() =>
              setInfo(
                "A recuperação por e-mail não está disponível na demonstração. Use uma conta de teste ou altere a senha no perfil autenticado.",
              )
            }
          >
            Esqueceu a senha?
          </button>
        )}
        <div className="social-login">
          <Button
            variant="outline"
            onClick={() =>
              setInfo(
                "O login com Google não está ativo nesta demonstração. Entre com sua conta fictícia.",
              )
            }
          >
            Google
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setInfo(
                "O login com Facebook não está ativo nesta demonstração. Entre com sua conta fictícia.",
              )
            }
          >
            Facebook
          </Button>
        </div>
        <p className="auth-switch">
          {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
          <Link to={register ? "/login" : "/register"} search={{ redirect }}>
            {register ? "Entrar" : "Cadastre-se"}
          </Link>
        </p>
        <small className="fine-print">
          Ambiente de demonstração. Use dados fictícios.
        </small>
      </section>
      <DemoInfo open={!!info} onClose={() => setInfo("")} message={info} />
    </div>
  );
  return desktop ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void navigate({ to: "/" });
      }}
      title={register ? "Cadastre-se" : "Entrar"}
      className="auth-dialog"
    >
      {content}
    </Dialog>
  ) : (
    content
  );
}
