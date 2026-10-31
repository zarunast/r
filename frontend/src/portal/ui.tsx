import type { ReactNode } from "react";
import { CircleHelp, LoaderCircle } from "lucide-react";
export function PortalNotice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`p-notice ${error ? "p-notice-error" : ""}`}
      role={error ? "alert" : undefined}
    >
      <CircleHelp size={18} />
      <div>{children}</div>
    </div>
  );
}
export function PortalBusy() {
  return (
    <div className="p-loading" role="status">
      <LoaderCircle size={22} className="p-spin" />
      Загружаем открытые данные…
    </div>
  );
}
