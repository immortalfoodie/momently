'use client';

import { useState } from 'react';
import type { BudgetCategory, BudgetItem } from '@/domain/types';
import { OptionCard } from '@/components/review/OptionCard';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useEvent, useStoreReady } from '@/store/selectors';
import { AddItemDialog } from './AddItemDialog';
import { BudgetSummary } from './BudgetSummary';
import { CapEditor } from './CapEditor';
import { CategoryBreakdown } from './CategoryBreakdown';
import { EditPriceDialog } from './EditPriceDialog';
import { ForgottenCostsList } from './ForgottenCostsList';
import { GuardianPanel } from './GuardianPanel';
import { LineItemsTable } from './LineItemsTable';
import { ProvenanceBreakdown } from './ProvenanceBreakdown';
import { useUserEdit } from './useUserEdit';
import { WhatIfGuests } from './WhatIfGuests';

import { useParams } from 'next/navigation';
import { useOptionalCurrentEvent } from '@/components/events/EventContext';

export interface BudgetClientProps {
  eventId?: string;
}

/**
 * BudgetClient coordinates all interactive budgeting, guardian tools, and line-item management.
 * WHY: Assembles the entire offline-ready budget dashboard with strict accessibility and single write path.
 */
// eslint-disable-next-line complexity
export function BudgetClient({ eventId: eventIdProp }: BudgetClientProps = {}) {
  const context = useOptionalCurrentEvent();
  const params = useParams();
  const paramId = (params?.id as string) || '';
  const eventId = eventIdProp || context?.plan.id || paramId;

  const isReady = useStoreReady();
  const storeEvent = useEvent(eventId);
  const event = context?.event ?? storeEvent;
  const plan = event?.plan;

  const {
    applyEdit,
    conflictOption,
    conflictDialogOpen,
    closeConflictDialog,
    handleApproveFunded,
  } = useUserEdit(eventId);

  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [addPrefill, setAddPrefill] = useState<{ category?: BudgetCategory; label?: string } | undefined>(undefined);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [isCapEditorOpen, setIsCapEditorOpen] = useState(false);

  if (!isReady || !event || !plan) {
    return (
      <div className="py-2 space-y-6">
        <PageHeader
          title="Budget Guardian"
          description="Deterministic line-item ledger with real-time floor protection, provenance badges, and lever controls."
        />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const handleOpenAddWithPrefill = (prefill: { category: BudgetCategory; label: string }) => {
    setAddPrefill(prefill);
    setIsAddItemOpen(true);
  };

  const handleAddSubmit = async (item: Omit<BudgetItem, 'id'>) => {
    await applyEdit(
      [{ type: 'add_budget_item', item: { ...item, id: `bi_${Date.now()}` } }],
      `Added "${item.label}" to budget`,
      item.rateKey?.split('.')[0],
    );
  };

  const handleEditSave = async (unitCost: number, provenance: BudgetItem['provenance'], note?: string) => {
    if (!editingItem) return;
    await applyEdit(
      [{ type: 'update_budget_item', id: editingItem.id, changes: { unitCost, provenance, note } }],
      `Updated price for "${editingItem.label}"`,
      editingItem.rateKey?.split('.')[0],
    );
  };

  const handleToggleLock = async (item: BudgetItem) => {
    await applyEdit(
      [{ type: 'update_budget_item', id: item.id, changes: { locked: !item.locked } }],
      `${item.locked ? 'Unlocked' : 'Locked'} "${item.label}"`,
      item.rateKey?.split('.')[0],
    );
  };

  const handleRemoveItem = async (item: BudgetItem) => {
    await applyEdit(
      [{ type: 'remove_budget_item', id: item.id }],
      `Removed "${item.label}" from budget`,
      item.rateKey?.split('.')[0],
    );
  };

  return (
    <div className="py-2 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Budget Guardian"
          description="Deterministic line-item ledger with real-time floor protection, provenance badges, and lever controls."
        />
        <div className="shrink-0">
          <Button
            variant="primary"
            onClick={() => {
              setAddPrefill(undefined);
              setIsAddItemOpen(true);
            }}
            icon={<Icon name="sparkle" size={14} aria-hidden="true" />}
          >
            Add expense
          </Button>
        </div>
      </div>

      {/* Region 1: Summary */}
      <section aria-labelledby="heading-budget-summary" className="space-y-3">
        <h2 id="heading-budget-summary" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Overview & Cap Utilization
        </h2>
        <BudgetSummary plan={plan} onEditCap={() => setIsCapEditorOpen(true)} />
      </section>

      {/* Region 2: Distributions */}
      <section aria-labelledby="heading-budget-breakdowns" className="space-y-3">
        <h2 id="heading-budget-breakdowns" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Category & Quote Source Distribution
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CategoryBreakdown plan={plan} />
          <ProvenanceBreakdown plan={plan} />
        </div>
      </section>

      {/* Region 3: Line Items Table */}
      <section aria-labelledby="heading-budget-ledger" className="space-y-3">
        <h2 id="heading-budget-ledger" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Line-Item Ledger
        </h2>
        <LineItemsTable
          plan={plan}
          onEditPrice={setEditingItem}
          onToggleLock={handleToggleLock}
          onRemoveItem={handleRemoveItem}
        />
      </section>

      {/* Region 4: Guardian Tools */}
      <section aria-labelledby="heading-guardian-tools" className="space-y-3">
        <h2 id="heading-guardian-tools" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Budget Guardian Tools
        </h2>
        <GuardianPanel plan={plan} eventId={eventId} />
      </section>

      {/* Region 5: What-If Guests */}
      <section aria-labelledby="heading-what-if" className="space-y-3">
        <h2 id="heading-what-if" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Living Plan Headcount Simulation
        </h2>
        <WhatIfGuests plan={plan} eventId={eventId} />
      </section>

      {/* Region 6: Forgotten Costs */}
      <section aria-labelledby="heading-forgotten-costs" className="space-y-3">
        <h2 id="heading-forgotten-costs" className="text-lg font-serif font-bold text-[#2B1B2E]">
          Frequently Overlooked Expenses
        </h2>
        <ForgottenCostsList plan={plan} onAddLineItem={handleOpenAddWithPrefill} />
      </section>

      {/* Dialogs */}
      <AddItemDialog
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onAdd={handleAddSubmit}
        prefill={addPrefill}
      />

      <EditPriceDialog
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={handleEditSave}
      />

      <CapEditor
        plan={plan}
        eventId={eventId}
        isOpen={isCapEditorOpen}
        onClose={() => setIsCapEditorOpen(false)}
      />

      <Dialog
        open={conflictDialogOpen}
        onClose={closeConflictDialog}
        title="Budget Cap Protection"
        description="This change exceeds your hard budget ceiling. Choose a funding strategy to proceed or raise your cap."
      >
        {conflictOption && (
          <div className="pt-2">
            <OptionCard
              option={conflictOption}
              eventId={eventId}
              plan={plan}
              onApprove={handleApproveFunded}
              onDismiss={closeConflictDialog}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
