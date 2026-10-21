'use client';

import Link from 'next/link';
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

interface TabsContextValue {
  selectedTab: string;
  onSelectTab: (id: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Accessible tab container implementing the WAI-ARIA Tabs design pattern.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Implements roving `tabIndex` (0 for selected, -1 for others) and standard keyboard navigation:
 * Left/Right arrows navigate sequentially (with wraparound), Home jumps to the first tab, and
 * End jumps to the last tab.
 */
export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className = '',
}: TabsProps) {
  const baseId = useId();
  const [internalTab, setInternalTab] = useState<string>(defaultValue ?? '');
  const selectedTab = controlledValue !== undefined ? controlledValue : internalTab;

  const onSelectTab = (tabId: string) => {
    if (controlledValue === undefined) setInternalTab(tabId);
    onValueChange?.(tabId);
  };

  return (
    <TabsContext.Provider value={{ selectedTab, onSelectTab, baseId }}>
      <div className={`flex flex-col w-full ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
}

export interface TabListProps {
  'aria-label': string;
  children: ReactNode;
  className?: string;
}

function getNextTabIndex(key: string, current: number, total: number): number {
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (current + 1) % total;
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (current - 1 + total) % total;
  }
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  return -1;
}

export function TabList({ 'aria-label': ariaLabel, children, className = '' }: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = listRef.current;
    if (!list) return;

    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'));
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);
    if (currentIndex === -1) return;

    const targetIndex = getNextTabIndex(e.key, currentIndex, tabs.length);
    if (targetIndex === -1) return;

    e.preventDefault();
    const targetTab = tabs[targetIndex];
    if (targetTab) {
      targetTab.focus();
      targetTab.click();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`flex items-center gap-1 border-b border-[#E6DCD2] pb-px overflow-x-auto ${className}`}
    >
      {children}
    </div>
  );
}

export interface TabTriggerProps {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function TabTrigger({ value, children, disabled = false, className = '' }: TabTriggerProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabTrigger must be rendered within Tabs');

  const isSelected = context.selectedTab === value;
  const tabId = `${context.baseId}-tab-${value}`;
  const panelId = `${context.baseId}-panel-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-selected={isSelected}
      aria-controls={panelId}
      tabIndex={isSelected ? 0 : -1}
      disabled={disabled}
      onClick={() => context.onSelectTab(value)}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer select-none whitespace-nowrap -mb-px disabled:opacity-40 disabled:cursor-not-allowed ${
        isSelected
          ? 'border-[#6B2D5C] text-[#6B2D5C]'
          : 'border-transparent text-[#5B4A5E] hover:text-[#2B1B2E] hover:border-[#E6DCD2]'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ value, children, className = '' }: TabPanelProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be rendered within Tabs');

  if (context.selectedTab !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-panel-${value}`}
      aria-labelledby={`${context.baseId}-tab-${value}`}
      tabIndex={0}
      className={`pt-4 focus-visible:outline-none ${className}`}
    >
      {children}
    </div>
  );
}

export interface LinkTabItem {
  href: string;
  label: string;
  isActive: boolean;
}

export interface LinkTabsProps {
  items: LinkTabItem[];
  'aria-label': string;
  className?: string;
}

/**
 * Route-based tab navigation rendering anchor elements with aria-current="page".
 */
export function LinkTabs({ items, 'aria-label': ariaLabel, className = '' }: LinkTabsProps) {
  return (
    <nav aria-label={ariaLabel} className={`border-b border-[#E6DCD2] pb-px overflow-x-auto ${className}`}>
      <ul role="list" className="flex items-center gap-1 -mb-px p-0 m-0 list-none">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              className={`inline-block px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors select-none whitespace-nowrap no-underline ${
                item.isActive
                  ? 'border-[#6B2D5C] text-[#6B2D5C]'
                  : 'border-transparent text-[#5B4A5E] hover:text-[#2B1B2E] hover:border-[#E6DCD2]'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
