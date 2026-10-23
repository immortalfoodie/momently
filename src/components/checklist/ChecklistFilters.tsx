'use client';

import { useEffect, useRef } from 'react';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';

export interface ChecklistFilterState {
  category: string;
  status: string;
  priority: string;
  hideCompleted: boolean;
}

export interface ChecklistFiltersProps {
  categories: string[];
  totalTasks: number;
  filteredTasks: number;
  filters: ChecklistFilterState;
  onChange: (filters: ChecklistFilterState) => void;
  className?: string;
}

export function ChecklistFilters({
  categories,
  totalTasks,
  filteredTasks,
  filters,
  onChange,
  className = '',
}: ChecklistFiltersProps) {
  const { announce } = useAnnouncer();
  const lastAnnouncedRef = useRef<string>('');

  useEffect(() => {
    const text = `Showing ${filteredTasks} of ${totalTasks} tasks`;
    if (lastAnnouncedRef.current !== text) {
      lastAnnouncedRef.current = text;
      announce(text);
    }
  }, [filteredTasks, totalTasks, announce]);

  return (
    <div className={`p-4 bg-white border border-[#E6DCD2] rounded-[16px] space-y-3 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Category">
          <Select
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            aria-label="Filter tasks by category"
          >
            <option value="all">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select
            value={filters.status}
            onChange={(e) => onChange({ ...filters, status: e.target.value })}
            aria-label="Filter tasks by status"
          >
            <option value="all">All statuses</option>
            <option value="todo">To do</option>
            <option value="doing">In progress</option>
            <option value="done">Done</option>
          </Select>
        </Field>

        <Field label="Priority">
          <Select
            value={filters.priority}
            onChange={(e) => onChange({ ...filters, priority: e.target.value })}
            aria-label="Filter tasks by priority"
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E6DCD2]">
        <label className="flex items-center gap-2 text-sm text-[#2B1B2E] font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hideCompleted}
            onChange={(e) => onChange({ ...filters, hideCompleted: e.target.checked })}
            className="rounded border-[#E6DCD2]"
          />
          <span>Hide completed tasks</span>
        </label>

        <span className="text-xs font-semibold text-[#5B4A5E]">
          Showing {filteredTasks} of {totalTasks} tasks
        </span>
      </div>
    </div>
  );
}
