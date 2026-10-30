'use client';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export interface WorkspaceErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Workspace-level error boundary for `/events/[id]/*` routes.
 * WHY: Keeps the surrounding AppShell and event navigation intact when a workspace view fails,
 * offering a calm recovery message and retry action without exposing stack traces or technical text.
 */
export default function WorkspaceErrorBoundary({ reset }: WorkspaceErrorProps) {
  return (
    <div className="py-6 space-y-6 max-w-xl mx-auto">
      <PageHeader
        title="We hit a snag loading this view"
        description="Your celebration plan is safe in this browser, but this workspace tab couldn't be displayed right now."
      />
      <Card className="p-6 bg-white border border-border text-center space-y-4">
        <p className="text-sm text-ink-muted">
          You can try loading this section again or switch to another tab in the sidebar.
        </p>
        <div className="flex justify-center">
          <Button type="button" variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
