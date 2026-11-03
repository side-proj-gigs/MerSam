export type UUID = string;

export interface Timestamped {
  createdAt: Date;
  updatedAt: Date;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function emptyPage<T>(pageSize = 20): Page<T> {
  return { items: [], total: 0, page: 1, pageSize, pageCount: 0 };
}

export function buildPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
