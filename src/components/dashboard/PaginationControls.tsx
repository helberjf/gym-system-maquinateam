import Link from "next/link";
import type { OffsetPagination } from "@/lib/pagination";

type RawSearchParams = Record<string, string | string[] | undefined>;

type PaginationControlsProps = {
  pathname: string;
  pagination: OffsetPagination;
  searchParams?: RawSearchParams;
};

function buildPageHref(
  pathname: string,
  searchParams: RawSearchParams | undefined,
  page: number,
) {
  const params = new URLSearchParams();

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, entry));
        return;
      }

      if (value.length > 0) {
        params.set(key, value);
      }
    });
  }

  if (page <= 1) {
    params.delete("page");
  } else {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const windowSize = 5;
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(1, currentPage - halfWindow);
  const end = Math.min(totalPages, start + windowSize - 1);
  const adjustedStart = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];

  for (let page = adjustedStart; page <= end; page += 1) {
    pages.push(page);
  }

  return pages;
}

export function PaginationControls({
  pathname,
  pagination,
  searchParams,
}: PaginationControlsProps) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const visiblePages = getVisiblePages(pagination.page, pagination.totalPages);

  return (
    <nav
      aria-label="Paginacao"
      className="rounded-3xl border border-brand-gray-mid bg-brand-gray-dark p-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-brand-gray-light">
          Mostrando {pagination.startItem} a {pagination.endItem} de{" "}
          {pagination.totalItems} resultado(s).
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={buildPageHref(pathname, searchParams, pagination.page - 1)}
            aria-disabled={!pagination.hasPreviousPage}
            className={[
              "inline-flex min-h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
              pagination.hasPreviousPage
                ? "border-brand-gray-mid bg-brand-black text-white hover:border-brand-red"
                : "pointer-events-none border-brand-gray-mid bg-brand-black/40 text-brand-gray-light opacity-50",
            ].join(" ")}
          >
            Anterior
          </Link>

          {visiblePages.map((page) => {
            const isCurrentPage = page === pagination.page;

            return (
              <Link
                key={page}
                href={buildPageHref(pathname, searchParams, page)}
                aria-current={isCurrentPage ? "page" : undefined}
                className={[
                  "inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border px-3 text-sm font-medium transition",
                  isCurrentPage
                    ? "border-brand-red bg-brand-red text-black"
                    : "border-brand-gray-mid bg-brand-black text-white hover:border-brand-red",
                ].join(" ")}
              >
                {page}
              </Link>
            );
          })}

          <Link
            href={buildPageHref(pathname, searchParams, pagination.page + 1)}
            aria-disabled={!pagination.hasNextPage}
            className={[
              "inline-flex min-h-10 items-center justify-center rounded-xl border px-4 text-sm font-medium transition",
              pagination.hasNextPage
                ? "border-brand-gray-mid bg-brand-black text-white hover:border-brand-red"
                : "pointer-events-none border-brand-gray-mid bg-brand-black/40 text-brand-gray-light opacity-50",
            ].join(" ")}
          >
            Proxima
          </Link>
        </div>
      </div>
    </nav>
  );
}

