'use client';

import { useState } from 'react';
import type { DecisionSource, EventPlan } from '@/domain/types';
import type { PlanSnapshot } from '@/engine/history';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DecisionStatusPill } from '@/components/ui/DecisionStatusPill';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { TabList, TabPanel, Tabs, TabTrigger } from '@/components/ui/Tabs';
import { useEventsStore } from '@/store/eventsStore';
import { CompareVersionDialog } from './CompareVersionDialog';

export interface VersionHistoryProps {
  plan: EventPlan;
  eventId: string;
  history: PlanSnapshot[];
  className?: string;
}

function getSourceBadge(source: DecisionSource): { label: string; tone: BadgeTone } {
  switch (source) {
    case 'user':
      return { label: 'You', tone: 'neutral' };
    case 'ai':
      return { label: 'AI-assisted', tone: 'brand' };
    case 'chaos':
      return { label: 'Chaos Lab', tone: 'warning' };
    case 'system':
      return { label: 'System', tone: 'info' };
  }
}

/**
 * VersionHistory displays immutable decision ledgers and non-destructive version snapshots.
 * WHY: Answers "How did we get here?" and provides safe rollback without database dependencies.
 */
// eslint-disable-next-line complexity
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

  const reversedLedger = [...plan.ledger].reverse();
  const visibleDecisions = showAllDecisions ? reversedLedger : reversedLedger.slice(0, 20);

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
    <Card className={`p-5 bg-white border border-[#E6DCD2] space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#E6DCD2]">
        <div>
          <h3 className="font-serif font-bold text-lg text-[#2B1B2E]">History & Audit Trail</h3>
          <p className="text-xs text-[#5B4A5E] mt-0.5">
            Active plan version: <strong className="text-[#2B1B2E]">v{plan.version}</strong> · Immutable append-only record.
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
          <ul className="divide-y divide-[#F4EDE6]" aria-label="Decision ledger entries">
            {visibleDecisions.map((entry) => {
              const src = getSourceBadge(entry.source);
              return (
                <li key={entry.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <DecisionStatusPill status={entry.status} />
                      <Badge tone={src.tone}>{src.label}</Badge>
                      <span className="text-xs font-medium text-[#2B1B2E]">{entry.summary}</span>
                    </div>
                  </div>
                  <time dateTime={entry.timestamp} className="text-xs text-[#5B4A5E] shrink-0">
                    {new Date(entry.timestamp).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </li>
              );
            })}
          </ul>

          {reversedLedger.length > 20 && !showAllDecisions && (
            <div className="pt-3 text-center border-t border-[#F4EDE6]">
              <Button size="sm" variant="ghost" onClick={() => setShowAllDecisions(true)}>
                Show all {reversedLedger.length} decisions
              </Button>
            </div>
          )}
        </TabPanel>

        {/* Tab 2: Saved versions */}
        <TabPanel value="versions">
          {history.length === 0 ? (
            <EmptyState
              icon={<Icon name="sparkle" size={24} className="text-[#6B2D5C]" aria-hidden="true" />}
              title="No saved versions yet"
              description="Historical snapshots are automatically captured before applying approved proposals."
            />
          ) : (
            <ul className="divide-y divide-[#F4EDE6]" aria-label="Saved plan version history">
              {[...history].reverse().map((snap) => (
                <li
                  key={snap.version}
                  className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#2B1B2E]">Before: {snap.label}</span>
                      <Badge tone="neutral">v{snap.version}</Badge>
                    </div>
                    <time dateTime={snap.savedAt} className="text-xs text-[#5B4A5E] block">
                      Saved {new Date(snap.savedAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setComparingSnapshot(snap)}
                    >
                      Compare with current
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setRestoringSnapshot(snap)}
                    >
                      Restore this version
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
      <Dialog
        open={Boolean(restoringSnapshot)}
        onClose={() => setRestoringSnapshot(null)}
        title={`Restore Version ${restoringSnapshot?.version}?`}
        description="This creates a new version with these details. Nothing is lost: you can switch back any time."
      >
        <div className="py-2 text-xs text-[#5B4A5E]">
          <p>
            Restoring replaces current settings with the snapshot taken{' '}
            <strong>{restoringSnapshot?.label}</strong>. A new version entry will be created.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-[#E6DCD2]">
          <Button variant="ghost" onClick={() => setRestoringSnapshot(null)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirmRestore}>
            Restore Version {restoringSnapshot?.version}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
