export type RoutineItem = {
  id: string;
  name: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
  memo: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RoutineCheck = {
  id: string;
  routine_item_id: string;
  check_date: string;
  checked: boolean;
  checked_at: string | null;
};
