import Link from "next/link";
import type { DashboardNotification } from "@/lib/notifications/service";

const toneClassMap: Record<DashboardNotification["tone"], string> = {
  info: "border-brand-gray-light/25 bg-brand-white/5 text-brand-white",
  warning: "border-yellow-500/35 bg-yellow-500/10 text-yellow-100",
  danger: "border-brand-red/45 bg-brand-red/10 text-brand-red",
  success: "border-emerald-500/35 bg-emerald-500/10 text-emerald-100",
};

export function DashboardNotifications({
  notifications,
}: {
  notifications: DashboardNotification[];
}) {
  const urgentCount = notifications.filter(
    (notification) => notification.tone === "danger",
  ).length;

  return (
    <section className="mb-6 rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-brand-red">
            Notificacoes
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">
            Central do painel
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-brand-gray-mid px-3 py-1 text-brand-gray-light">
            {notifications.length} item(ns)
          </span>
          {urgentCount > 0 ? (
            <span className="rounded-full border border-brand-red/40 bg-brand-red/10 px-3 py-1 text-brand-red">
              {urgentCount} urgente(s)
            </span>
          ) : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="mt-4 text-sm text-brand-gray-light">
          Nenhuma notificacao relevante no momento.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              href={notification.href}
              className={[
                "block rounded-2xl border p-4 transition hover:border-brand-red/45",
                toneClassMap[notification.tone],
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {notification.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs opacity-80">
                    {notification.message}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] opacity-70">
                  {notification.createdAt.toISOString().slice(5, 10)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
