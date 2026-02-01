export type ViewType = 'table' | 'board' | 'calendar';

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty' | 'before' | 'after' | 'in_list';

export interface Filter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface View {
  id: string;
  moduleName: string; // 'bugs', 'features', etc.
  viewName: string;
  viewType: ViewType;
  visibleColumns?: string[];
  filters?: Filter[];
  sorts?: Sort[];
  groupBy?: string; // for board grouping (e.g., 'status')
  dateField?: string; // for calendar (e.g., 'publishAt', 'startsAt')
  isDefault?: boolean;
  createdAt?: Date | string; // Can be Date object or ISO string (from server actions)
  updatedAt?: Date | string; // Can be Date object or ISO string (from server actions)
}

export function createDefaultView(moduleName: string, viewType: ViewType, options?: {
  visibleColumns?: string[];
  dateField?: string;
  groupBy?: string;
}): View {
  return {
    id: `${moduleName}_${viewType}_default`,
    moduleName,
    viewName: `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} View`,
    viewType,
    visibleColumns: options?.visibleColumns,
    filters: [],
    sorts: [],
    groupBy: options?.groupBy,
    dateField: options?.dateField,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
