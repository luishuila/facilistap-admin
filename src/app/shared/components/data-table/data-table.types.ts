export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'status' | 'image' | 'actions';
  width?: string;
  align?: 'left' | 'center' | 'right';
  format?: string;
  statusMap?: Record<string, { label: string; color: string }>;
  visible?: boolean;
}

export interface SortEvent {
  active: string;
  direction: 'asc' | 'desc' | '';
}

export interface PageEvent {
  pageIndex: number;
  pageSize: number;
}

export interface RowAction<T> {
  action: string;
  row: T;
}

export interface ExportEvent {
  format: 'excel' | 'pdf' | 'csv';
}
