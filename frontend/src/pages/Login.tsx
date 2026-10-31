import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "../store";
import { ErrorState } from "../components/ui";

export function Login() {
  const { login, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  return (
    <div className="login-page">
      <div className="login-visual">
        <a href="#/dashboard" className="login-brand">
          <span className="brand-mark">Б</span>
          <span>
            АИС ПК
            <small>
              Брянский государственный
              <br />
              технический университет
            </small>
          </span>
        </a>
        <div className="login-copy">
          <span className="eyebrow">ПРИЁМНАЯ КОМИССИЯ</span>
          <h1>
            Большое будущее
            <br />
            начинается здесь<span>.</span>
          </h1>
          <p>
            Всё для приёмной кампании —<br />в одном рабочем пространстве.
          </p>
          <div className="login-illustration">
            <div className="illustration-card">
              <span>Приёмная кампания</span>
              <strong>2026</strong>
              <div className="illustration-lines">
                <i />
                <i />
                <i />
              </div>
              <ShieldCheck size={34} />
            </div>
            <span className="orb orb-one" />
            <span className="orb orb-two" />
          </div>
        </div>
        <div className="login-visual-footer">
          <ShieldCheck size={16} />
          Защищённая внутренняя система БГТУ
        </div>
      </div>
      <main className="login-main">
        <a href="#/dashboard" className="login-back">
          <ArrowLeft size={16} />
          Вернуться к демо
        </a>
        <div className="login-form-wrap">
          <span className="login-lock">
            <LockKeyhole size={24} />
          </span>
          <h2>Добро пожаловать</h2>
          <p>Войдите в рабочее пространство приёмной комиссии</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                await login(
                  String(f.get("username")),
                  String(f.get("password")),
                );
                window.location.hash = "/dashboard";
                notify("Вы вошли в рабочую базу");
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              Логин
              <input
                name="username"
                placeholder="Введите логин"
                required
                autoComplete="username"
                autoFocus
              />
            </label>
            <label className="field">
              Пароль
              <span className="password-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  placeholder="Введите пароль"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error && <ErrorState error={error} />}
            <button
              className="button primary login-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Входим…" : "Войти в систему"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="login-support">
            <ShieldCheck size={17} />
            <p>
              Доступ предоставляется администратором БГТУ.
              <br />
              Для входа подключитесь к локальной сети университета.
            </p>
          </div>
        </div>
        <footer>© 2026 БГТУ · АИС Приёмная комиссия</footer>
      </main>
    </div>
  );
}
