'use client';

import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';

export interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global client error boundary.
 *
 * ACCESSIBILITY DECISION (WHY):
 * Presents a friendly, non-technical explanation preventing user confusion, while offering
 * an immediate keyboard-accessible recovery button (`reset()`) without exposing sensitive stack traces.
 */
export default function ErrorBoundary({ reset }: ErrorProps) {
  return (
    <div className="py-8">
      <PageHeader
        title="Something Went Wrong"
        description="An unexpected error occurred while preparing your celebration studio workspace."
      />
      <div className="bg-white rounded-[16px] border border-[#E6DCD2] p-8 text-center max-w-lg mx-auto shadow-sm">
        <p className="text-sm text-[#5B4A5E] mb-6">
          Please try refreshing this section or reloading the page. Your active plan data remains safe.
        </p>
        <Button variant="primary" onClick={reset}>
          Try Again
        </Button>
      </div>
    </div>
  );
}
