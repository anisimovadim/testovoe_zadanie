import { useState, type FormEvent } from "react";
import { ArrowRight, Layers3, LockKeyhole, Eye, EyeOff } from "lucide-react";
import { client, db, errorText } from "./data";
export function Brand() {
  return (
    <div className="brand">
      <span className="mark">
        <Layers3 size={23} />
      </span>
      Контур<span className="brand-sub">CRM</span>
    </div>
  );
}
export function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { error } = await db().auth.signInWithPassword({
        email: String(form.get("email")).trim(),
        password: String(form.get("password")),
      });
      if (error) throw error;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <section className="cover">
        <Brand />
        <div className="cover-body">
          <div className="eyebrow">Строительное управление</div>
          <h1>
            Объекты
            <br />и задачи<span>.</span>
          </h1>
          <img
            src="/blueprint.svg"
            alt="Аксонометрический чертёж каркаса здания"
          />
        </div>
      </section>
      <section className="login-pane">
        <form onSubmit={submit}>
          <div className="login-icon">
            <LockKeyhole size={22} />
          </div>
          <h2>Вход в систему</h2>
          <p className="muted">Введите данные рабочего аккаунта.</p>
          <label>
            Электронная почта
            <input
              name="email"
              type="email"
              placeholder="name@company.ru"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Пароль
            <span className="password">
              <input
                name="password"
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {(!client || error) && (
            <div role="alert" className="error">
              {error ||
                "Для запуска укажите адрес Supabase и публичный ключ в .env.local."}
            </div>
          )}
          <button disabled={busy || !client} className="primary login-submit">
            {busy ? "Вход…" : "Войти"} <ArrowRight size={17} />
          </button>
        </form>
      </section>
    </main>
  );
}
