'use client';

import { useState } from 'react';
import type { BudgetCategory, BudgetItem } from '@/domain/types';
import { NarrationButton } from '@/components/review/NarrationButton';
import { OptionCard } from '@/components/review/OptionCard';
import { buildBudgetFacts } from '@/engine/budgetFacts';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { PAGE_COPY } from '@/lib/copy';
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

function useBudgetEvent(eventIdProp: string | undefined) {
  const context = useOptionalCurrentEvent();
  const params = useParams();
  const paramId = (params?.id as string) || '';
  const eventId = eventIdProp || context?.plan.id || paramId;

  const isReady = useStoreReady();
  const storeEvent = useEvent(eventId);
  const event = context?.event ?? storeEvent;
  return { eventId, isReady, event, plan: event?.plan };
}

function BudgetSkeleton() {
  return (
    <PageContainer width="full" className="space-y-6">
      <PageHeader
        title={PAGE_COPY.budget.title}
        description={PAGE_COPY.budget.description}
      />
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}

/**
 * BudgetClient coordinates all interactive budgeting, guardian tools, and line-item management.
 * WHY: Assembles the entire offline-ready budget dashboard with strict accessibility and single write path.
 */
export function BudgetClient({ eventId: eventIdProp }: BudgetClientProps = {}) {
  const { eventId, isReady, event, plan } = useBudgetEvent(eventIdProp);

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
    return <BudgetSkeleton />;
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

  const addExpenseAction = (
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
  );

  return (
    <PageContainer width="full" className="space-y-8">
      <PageHeader
        title={PAGE_COPY.budget.title}
        description={PAGE_COPY.budget.description}
        actions={addExpenseAction}
      />

      {/* Region 1: Summary */}
      <section aria-labelledby="heading-budget-summary" className="space-y-3">
        <h2 id="heading-budget-summary" className="text-lg font-serif font-bold text-ink">
          Your budget at a glance
        </h2>
        <BudgetSummary plan={plan} onEditCap={() => setIsCapEditorOpen(true)} />
        <NarrationButton
          purpose="budget_explainer"
          buildFacts={() => buildBudgetFacts(plan)}
          label="Explain my budget"
          regionLabel="Budget in plain words"
        />
      </section>

      {/* Region 2: Distributions */}
      <section aria-labelledby="heading-budget-breakdowns" className="space-y-3">
        <h2 id="heading-budget-breakdowns" className="text-lg font-serif font-bold text-ink">
          Where the money goes
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CategoryBreakdown plan={plan} />
          <ProvenanceBreakdown plan={plan} />
        </div>
      </section>

      {/* Region 3: Line Items Table */}
      <section aria-labelledby="heading-budget-items" className="space-y-3">
        <h2 id="heading-budget-items" className="text-lg font-serif font-bold text-ink">
          All expenses
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
        <h2 id="heading-guardian-tools" className="text-lg font-serif font-bold text-ink">
          Budget Guardian Tools
        </h2>
        <GuardianPanel plan={plan} eventId={eventId} />
      </section>

      {/* Region 5: What-If Guests */}
      <section aria-labelledby="heading-what-if" className="space-y-3">
        <h2 id="heading-what-if" className="text-lg font-serif font-bold text-ink">
          Living Plan Headcount Simulation
        </h2>
        <WhatIfGuests plan={plan} eventId={eventId} />
      </section>

      {/* Region 6: Forgotten Costs */}
      <section aria-labelledby="heading-forgotten-costs" className="space-y-3">
        <h2 id="heading-forgotten-costs" className="text-lg font-serif font-bold text-ink">
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
    </PageContainer>
  );
}
