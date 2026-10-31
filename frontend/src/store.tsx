import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoRequest, demoUser } from "./demo";
import type { User } from "./types";

const API_BASE = import.meta.env.DEV ? "/api" : "";
type Notice = { id: number; message: string; kind: "success" | "error" };
type CampaignDates = { change: string; payment: string };
type Context = {
  demo: boolean;
  user: User;
  year: number;
  setYear: (year: number) => void;
  dates: CampaignDates;
  setDates: (values: Partial<CampaignDates>) => void;
  revision: number;
  api: <T>(path: string, options?: RequestInit) => Promise<T>;
  download: (
    path: string,
    filename: string,
    options?: RequestInit,
  ) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => void;
  notify: (message: string, kind?: Notice["kind"]) => void;
  notices: Notice[];
};
const Store = createContext<Context | null>(null);

async function responseError(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail))
    return body.detail
      .map(
        (d: { loc?: string[]; msg?: string }) =>
          `${d.loc?.slice(1).join(".")}: ${d.msg}`,
      )
      .join("; ");
  return `Не удалось выполнить запрос (${response.status})`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User>(demoUser);
  const [year, setYear] = useState(2026);
  const [savedDates, saveDates] = useState<Record<string, CampaignDates>>(
    () => {
      try {
        const value = JSON.parse(
          localStorage.getItem("bgtu-campaign-dates") || "{}",
        );
        return value && typeof value === "object" && !Array.isArray(value)
          ? value
          : {};
      } catch {
        return {};
      }
    },
  );
  const datesKey = `${token ? "work" : "demo"}-${year}`;
  const dates = savedDates[datesKey] || {
    change: token ? "" : `${year}-08-20`,
    payment: token ? "" : `${year}-08-20`,
  };
  const setDates = useCallback(
    (values: Partial<CampaignDates>) => {
      saveDates((previous) => {
        const next = {
          ...previous,
          [datesKey]: {
            ...(previous[datesKey] || {
              change: token ? "" : `${year}-08-20`,
              payment: token ? "" : `${year}-08-20`,
            }),
            ...values,
          },
        };
        try {
          localStorage.setItem("bgtu-campaign-dates", JSON.stringify(next));
        } catch {
          /* Настройки сохранятся до закрытия вкладки. */
        }
        return next;
      });
    },
    [datesKey, year, token],
  );
  const [revision, setRevision] = useState(0);
  const [notices, setNotices] = useState<Notice[]>([]);
  const notify = useCallback(
    (message: string, kind: Notice["kind"] = "success") => {
      const id = Date.now() + Math.random();
      setNotices((n) => [...n.slice(-2), { id, message, kind }]);
      window.setTimeout(
        () => setNotices((n) => n.filter((item) => item.id !== id)),
        5000,
      );
    },
    [],
  );
  const logout = useCallback(() => {
    setToken(null);
    setUser(demoUser);
    setRevision((n) => n + 1);
  }, []);
  const fetchApi = useCallback(
    async (path: string, options: RequestInit = {}) => {
      let response: Response;
      try {
        response = await fetch(API_BASE + path, {
          ...options,
          headers: {
            ...(options.body && !(options.body instanceof FormData)
              ? { "Content-Type": "application/json" }
              : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
          },
        });
      } catch {
        throw new Error(
          "Нет соединения с сервером. Проверьте, что Python API запущен.",
        );
      }
      if (response.status === 401 && token) {
        logout();
        window.location.hash = "/login";
        throw new Error("Сессия завершена. Войдите снова.");
      }
      if (!response.ok) throw new Error(await responseError(response));
      return response;
    },
    [token, logout],
  );
  const api = useCallback(
    async <T,>(path: string, options?: RequestInit): Promise<T> => {
      if (!token) return demoRequest<T>(path, options);
      return (await fetchApi(path, options)).json() as Promise<T>;
    },
    [token, fetchApi],
  );
  const download = useCallback(
    async (path: string, filename: string, options?: RequestInit) => {
      if (!token)
        throw new Error("Для выгрузки отчёта войдите в рабочую базу.");
      const blob = await (await fetchApi(path, options)).blob();
      saveFile(blob, filename);
    },
    [token, fetchApi],
  );
  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch(API_BASE + "/auth/token", {
      method: "POST",
      body: new URLSearchParams({ username, password }),
    }).catch(() => {
      throw new Error("Сервер недоступен. Проверьте запуск Python API.");
    });
    if (!response.ok) throw new Error(await responseError(response));
    const data = (await response.json()) as { access_token: string };
    const me = await fetch(API_BASE + "/auth/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!me.ok) throw new Error(await responseError(me));
    setUser((await me.json()) as User);
    setToken(data.access_token);
    setRevision((n) => n + 1);
  }, []);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  const value = useMemo(
    () => ({
      demo: !token,
      user,
      year,
      setYear,
      dates,
      setDates,
      revision,
      api,
      download,
      login,
      logout,
      refresh,
      notify,
      notices,
    }),
    [
      token,
      user,
      year,
      dates,
      setDates,
      revision,
      api,
      download,
      login,
      logout,
      refresh,
      notify,
      notices,
    ],
  );
  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useStore() {
  const s = useContext(Store);
  if (!s) throw new Error("StoreProvider required");
  return s;
}
export function useLoad<T>(path: string | null) {
  const { api, revision } = useStore();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    setLoading(!!path);
    if (!path) {
      setData(null);
      return;
    }
    api<T>(path)
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [path, api, revision]);
  return { data, loading, error };
}
export function useDebounce(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
export function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const jsonBody = (body: unknown, method = "POST"): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
