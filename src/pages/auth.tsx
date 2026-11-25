import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { api, auth, errorMessage, errorsFrom, isCanceled } from "../lib/client";
import { loginSchema, registerSchema, fieldErrors } from "../lib/validation";
import { safeReturnTo } from "../lib/return-to";
import type { RegisterInput } from "../lib/types";
import { CatalogPage } from "./catalog";
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
    [info, setInfo] = useState(""),
    [desktop, setDesktop] = useState(window.innerWidth > 600);
  const close = () => {
    active.current = false;
    auth.cancelAuthentication();
    const destination = /^\/(checkout|account|orders|favorites)(\/|$)/.test(
      redirect,
    )
      ? "/"
      : redirect;
    void navigate({ to: destination }).then(() =>
      requestAnimationFrame(() => {
        if (origin.current?.isConnected) origin.current.focus();
      }),
    );
  };
  const redirect = safeReturnTo(search.redirect, window.location.origin);
  const origin = useRef(document.activeElement as HTMLElement | null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      auth.cancelAuthentication();
    };
  }, []);
  const mutation = useMutation({
    mutationFn: async (body: RegisterInput) => {
      const response = register
        ? await api.register(body)
        : await api.login({ email: body.email, password: body.password });
      return auth.accept(response);
    },
    onSuccess: ({ adjustments, generation }) => {
      if (!active.current || generation !== auth.generation()) return;
      if (adjustments.length) notice(adjustments.join(" "));
      void navigate({ to: redirect });
    },
    onError: (error) => {
      if (!active.current || isCanceled(error)) return;
      setErrors(errorsFrom(error));
      setError(errorMessage(error));
    },
  });
  const busy = mutation.isPending;
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
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const result = (register ? registerSchema : loginSchema).safeParse(form);
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setError("");
    mutation.mutate({ ...form, ...result.data });
  };
  const content = (
    <div className="auth-backdrop">
      <section
        className={`auth-card ${register ? "auth-register" : ""}`}
        aria-labelledby="auth-title"
      >
        <button
          onClick={close}
          className="auth-close"
          aria-label="Fechar acesso à conta"
        >
          <X size={20} />
        </button>
        <Link to="/" className="auth-wordmark" aria-label="Kurio, início">
          KURIO
        </Link>
        <div className="auth-tabs" aria-label="Acesso à conta">
          <Link
            to="/login"
            search={{ redirect }}
            className={!register ? "active" : ""}
          >
            Entrar
          </Link>
          <span>/</span>
          <Link
            to="/register"
            search={{ redirect }}
            className={register ? "active" : ""}
          >
            Criar conta
          </Link>
        </div>
        <p className="auth-intro">
          {register
            ? "Crie seu perfil de colecionador e comece sua coleção."
            : "Entre para gerenciar sua carteira, coleção e perfil de criador."}
        </p>
        <h1 id="auth-title">
          {register ? "Criar perfil de colecionador" : "Entrar"}
        </h1>
        <form onSubmit={submit} noValidate>
          {register && (
            <Field
              label="Nome de usuário"
              placeholder="Nome de usuário"
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
            placeholder="Digite seu e-mail"
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
            placeholder="Senha"
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
                placeholder="Confirmar senha"
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
          {!register && (
            <button
              type="button"
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
        <div className="social-separator">Ou continue com</div>
        <div className="social-login">
          <Button
            variant="outline"
            onClick={() =>
              setInfo(
                "O login com Google não está ativo nesta demonstração. Entre com sua conta fictícia.",
              )
            }
          >
            <img src="/assets/icons/google.svg" width="20" height="20" alt="" />
            Continuar com Google
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setInfo(
                "O login com Facebook não está ativo nesta demonstração. Entre com sua conta fictícia.",
              )
            }
          >
            <img
              src="/assets/icons/facebook.svg"
              width="20"
              height="20"
              alt=""
            />
            Continuar com Facebook
          </Button>
        </div>
        <p className="auth-switch">
          {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
          <Link to={register ? "/login" : "/register"} search={{ redirect }}>
            {register ? "Entrar" : "Cadastre-se"}
          </Link>
        </p>
      </section>
      <DemoInfo open={!!info} onClose={() => setInfo("")} message={info} />
    </div>
  );
  return desktop ? (
    <>
      <div className="auth-catalog">
        <CatalogPage />
      </div>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={register ? "Cadastre-se" : "Entrar"}
        className="auth-dialog"
        returnFocusTo={origin.current}
      >
        {content}
      </Dialog>
    </>
  ) : (
    content
  );
}

export function LoginPage() {
  return <AuthPage />;
}
export function RegisterPage() {
  return <AuthPage register />;
}
