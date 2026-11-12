import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { publicDemo } from "./demo";
const base = import.meta.env.DEV ? "/api" : "";
type PortalContext = {
  year: number;
  setYear: (year: number) => void;
  demo: boolean;
  setDemo: (demo: boolean) => void;
  api: <T>(path: string) => Promise<T>;
  revision: number;
  reload: () => void;
};
const Context = createContext<PortalContext | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(2026);
  const [demo, toggleDemo] = useState(
    () => new URLSearchParams(window.location.search).get("demo") === "1",
  );
  const [revision, setRevision] = useState(0);
  const setDemo = useCallback((value: boolean) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("demo", "1");
    else url.searchParams.delete("demo");
    window.history.replaceState({}, "", url);
    toggleDemo(value);
  }, []);
  const api = useCallback(
    async <T,>(path: string): Promise<T> => {
      if (!path.startsWith("/public/"))
        throw new Error("Портал использует только открытые данные");
      if (demo) return publicDemo<T>(path);
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(base + path, {
          credentials: "omit",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (response.status === 404)
          throw new Error(
            "Номер не найден. Проверьте номер ЕПГУ и год приёма.",
          );
        if (!response.ok)
          throw new Error(
            "Не удалось получить данные. Повторите попытку позже.",
          );
        return (await response.json()) as T;
      } catch (error) {
        if (
          error instanceof TypeError ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          throw new Error(
            "Не удалось связаться с порталом. Попробуйте ещё раз через несколько минут.",
          );
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
    [demo],
  );
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  const value = useMemo(
    () => ({ year, setYear, demo, setDemo, api, revision, reload }),
    [year, demo, setDemo, api, revision, reload],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePortal() {
  const value = useContext(Context);
  if (!value) throw new Error("PortalProvider required");
  return value;
}
export function usePublicLoad<T>(path: string | null) {
  const { api, revision } = usePortal();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!path);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    setLoading(!!path);
    if (!path) return;
    api<T>(path)
      .then((value) => {
        if (active) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [api, path, revision]);
  return { data, error, loading };
}
