'use client';

import type { DecisionSource, EventPlan } from '@/domain/types';
import type { PlanSnapshot } from '@/engine/history';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DecisionStatusPill } from '@/components/ui/DecisionStatusPill';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';

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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface DecisionsListProps {
  ledger: EventPlan['ledger'];
  showAll: boolean;
  onShowAll: () => void;
}

export function DecisionsList({ ledger, showAll, onShowAll }: DecisionsListProps) {
  const reversedLedger = [...ledger].reverse();
  const visibleDecisions = showAll ? reversedLedger : reversedLedger.slice(0, 20);

  return (
    <>
      <ul className="divide-y divide-surface-muted" aria-label="Past decisions">
        {visibleDecisions.map((entry) => {
          const src = getSourceBadge(entry.source);
          return (
            <li key={entry.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DecisionStatusPill status={entry.status} />
                  <Badge tone={src.tone}>{src.label}</Badge>
                  <span className="text-xs font-medium text-ink">{entry.summary}</span>
                </div>
              </div>
              <time dateTime={entry.timestamp} className="text-xs text-ink-muted shrink-0">
                {formatTimestamp(entry.timestamp)}
              </time>
            </li>
          );
        })}
      </ul>

      {reversedLedger.length > 20 && !showAll && (
        <div className="pt-3 text-center border-t border-surface-muted">
          <Button size="sm" variant="ghost" onClick={onShowAll}>
            Show all {reversedLedger.length} decisions
          </Button>
        </div>
      )}
    </>
  );
}

interface SavedVersionsListProps {
  history: PlanSnapshot[];
  onCompare: (snap: PlanSnapshot) => void;
  onRestore: (snap: PlanSnapshot) => void;
}

export function SavedVersionsList({ history, onCompare, onRestore }: SavedVersionsListProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="sparkle" size={24} className="text-primary" aria-hidden="true" />}
        title="No saved versions yet"
        description="Historical snapshots are automatically captured before applying approved proposals."
      />
    );
  }

  return (
    <ul className="divide-y divide-surface-muted" aria-label="Saved plan version history">
      {[...history].reverse().map((snap) => (
        <li
          key={snap.version}
          className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-ink">Before: {snap.label}</span>
              <Badge tone="neutral">v{snap.version}</Badge>
            </div>
            <time dateTime={snap.savedAt} className="text-xs text-ink-muted block">
              Saved {formatTimestamp(snap.savedAt)}
            </time>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onCompare(snap)}
            >
              Compare with current
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onRestore(snap)}
            >
              Restore this version
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface RestoreConfirmDialogProps {
  snapshot: PlanSnapshot | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RestoreConfirmDialog({ snapshot, onClose, onConfirm }: RestoreConfirmDialogProps) {
  return (
    <Dialog
      open={Boolean(snapshot)}
      onClose={onClose}
      title={`Restore Version ${snapshot?.version}?`}
      description="This creates a new version with these details. Nothing is lost: you can switch back any time."
    >
      <div className="py-2 text-xs text-ink-muted">
        <p>
          Restoring replaces current settings with the snapshot taken{' '}
          <strong>{snapshot?.label}</strong>. A new version entry will be created.
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Restore Version {snapshot?.version}
        </Button>
      </div>
    </Dialog>
  );
}
