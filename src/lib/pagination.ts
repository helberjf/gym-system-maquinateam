export const DEFAULT_DASHBOARD_PAGE_SIZE = 12;

type BuildOffsetPaginationInput = {
  page?: number;
  pageSize?: number;
  totalItems: number;
};

export type OffsetPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  skip: number;
  limit: number;
  startItem: number;
  endItem: number;
};

export function buildOffsetPagination({
  page = 1,
  pageSize = DEFAULT_DASHBOARD_PAGE_SIZE,
  totalItems,
}: BuildOffsetPaginationInput): OffsetPagination {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * safePageSize;
  const startItem = totalItems === 0 ? 0 : skip + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(totalItems, skip + safePageSize);

  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
    skip,
    limit: safePageSize,
    startItem,
    endItem,
  };
}

