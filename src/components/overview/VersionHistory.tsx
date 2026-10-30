'use client';

import { useState } from 'react';
import type { EventPlan } from '@/domain/types';
import type { PlanSnapshot } from '@/engine/history';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { TabList, TabPanel, Tabs, TabTrigger } from '@/components/ui/Tabs';
import { useEventsStore } from '@/store/eventsStore';
import { CompareVersionDialog } from './CompareVersionDialog';
import { DecisionsList, RestoreConfirmDialog, SavedVersionsList } from './VersionHistoryParts';

export interface VersionHistoryProps {
  plan: EventPlan;
  eventId: string;
  history: PlanSnapshot[];
  className?: string;
}

/**
 * VersionHistory displays immutable decision ledgers and non-destructive version snapshots.
 * WHY: Answers "How did we get here?" and provides safe rollback without database dependencies.
 */
export function VersionHistory({
  plan,
  eventId,
  history,
  className = '',
}: VersionHistoryProps) {
  const [showAllDecisions, setShowAllDecisions] = useState(false);
  const [comparingSnapshot, setComparingSnapshot] = useState<PlanSnapshot | null>(null);
  const [restoringSnapshot, setRestoringSnapshot] = useState<PlanSnapshot | null>(null);
  const [restoredVersionNotice, setRestoredVersionNotice] = useState<number | null>(null);

  const { announce } = useAnnouncer();
  const restoreVersion = useEventsStore((s) => s.restoreVersion);

  const handleConfirmRestore = () => {
    if (!restoringSnapshot) return;
    const versionToRestore = restoringSnapshot.version;
    const res = restoreVersion(eventId, versionToRestore);

    if (res.ok) {
      announce(`Restored version ${versionToRestore}. Current version is now ${res.value.version}.`);
      setRestoredVersionNotice(res.value.version);
    }
    setRestoringSnapshot(null);
  };

  return (
    <Card className={`p-5 bg-white border border-border space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div>
          <h3 className="font-serif font-bold text-lg text-ink">History & Audit Trail</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Active plan version: <strong className="text-ink">v{plan.version}</strong> · Immutable append-only record.
          </p>
        </div>
        {restoredVersionNotice && (
          <Badge tone="success" className="animate-in fade-in">
            Restored to version {restoredVersionNotice}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="decisions">
        <TabList aria-label="Version history and decision views">
          <TabTrigger value="decisions">Decisions ({plan.ledger.length})</TabTrigger>
          <TabTrigger value="versions">Saved versions ({history.length})</TabTrigger>
        </TabList>

        {/* Tab 1: Decisions */}
        <TabPanel value="decisions">
          <DecisionsList
            ledger={plan.ledger}
            showAll={showAllDecisions}
            onShowAll={() => setShowAllDecisions(true)}
          />
        </TabPanel>

        {/* Tab 2: Saved versions */}
        <TabPanel value="versions">
          <SavedVersionsList
            history={history}
            onCompare={setComparingSnapshot}
            onRestore={setRestoringSnapshot}
          />
        </TabPanel>
      </Tabs>

      {/* Compare Dialog */}
      <CompareVersionDialog
        open={Boolean(comparingSnapshot)}
        onClose={() => setComparingSnapshot(null)}
        snapshotPlan={comparingSnapshot?.plan ?? null}
        currentPlan={plan}
        versionNumber={comparingSnapshot?.version ?? 0}
      />

      {/* Restore Confirm Dialog */}
      <RestoreConfirmDialog
        snapshot={restoringSnapshot}
        onClose={() => setRestoringSnapshot(null)}
        onConfirm={handleConfirmRestore}
      />
    </Card>
  );
}
