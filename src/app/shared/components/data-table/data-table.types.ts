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
  /** Texto secundario (segunda línea, gris) en celdas de texto: clave de la fila. */
  subKey?: string;
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

/** Opcion del menu de acciones de cada fila. */
export interface RowActionOption {
  action: string;
  label: string;
  icon: string;
  /** Se pinta en rojo y con separador (eliminar, cancelar...). */
  danger?: boolean;
}

/** Menu por defecto, el que tenian todas las tablas. */
export const DEFAULT_ROW_ACTIONS: RowActionOption[] = [
  { action: 'edit', label: 'Editar', icon: 'edit' },
  { action: 'view', label: 'Ver', icon: 'visibility' },
  { action: 'toggle', label: 'Activar/Desactivar', icon: 'toggle_on' },
  { action: 'delete', label: 'Eliminar', icon: 'delete', danger: true },
];

export interface ExportEvent {
  format: 'excel' | 'pdf' | 'csv';
}
