import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { registerStaff, useStore } from "../store";
import { ErrorState } from "../components/ui";

export function Login() {
  const { login, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registeredLogin, setRegisteredLogin] = useState("");
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
          <h2>{registering ? "Регистрация сотрудника" : "Вход в систему"}</h2>

          <form
            key={String(registering)}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError("");
              try {
                if (registering) {
                  await registerStaff(f);
                  setRegisteredLogin(String(f.get("username")).trim());
                  setRegistering(false);
                  setVisible(false);
                  notify("Учётная запись создана. Войдите с новым паролем.");
                  return;
                }
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
                maxLength={100}
                defaultValue={registeredLogin}
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
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  minLength={registering ? 10 : undefined}
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
            {registering && (
              <>
                <label className="field">
                  Повторите пароль
                  <input
                    name="password_confirmation"
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={10}
                    required
                  />
                </label>
                <label className="field">
                  Роль
                  <select name="role" defaultValue="" required>
                    <option value="" disabled>
                      Выберите роль
                    </option>
                    <option value="operator">
                      Сотрудник приёмной комиссии
                    </option>
                    <option value="editor">Редактор сайта абитуриента</option>
                    <option value="examiner">Проверяющий экзамены</option>
                  </select>
                </label>
                <label className="field">
                  Код приглашения
                  <input
                    name="invitation"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={128}
                    required
                  />
                </label>
              </>
            )}
            {error && <ErrorState error={error} />}
            <button
              className="button primary login-submit"
              type="submit"
              disabled={busy}
            >
              {registering
                ? busy
                  ? "Создаём…"
                  : "Зарегистрироваться"
                : busy
                  ? "Входим…"
                  : "Войти в систему"}
              <ArrowRight size={18} />
            </button>
          </form>
          <button
            className="button login-mode"
            type="button"
            disabled={busy}
            onClick={() => {
              setRegistering(!registering);
              setError("");
              setVisible(false);
            }}
          >
            {registering ? "Вернуться ко входу" : "Создать учётную запись"}
          </button>
          <div className="login-support">
            <ShieldCheck size={17} />
            <p>
              {registering
                ? "Одноразовый код приглашения выдаёт администратор БГТУ."
                : "Доступ предоставляется администратором БГТУ."}
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
