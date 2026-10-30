import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantOutcomeView } from '@/components/review/AssistantOutcomeView';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI: compound request step list', () => {
  it('renders steps in order with text status badges and passes axe', async () => {
    const { container } = render(
      <AssistantOutcomeView
        outcome={{
          kind: 'info',
          message: 'I worked through your 2 requests in order.',
          items: [],
          steps: [
            { label: 'Look for costs we may have forgotten', status: 'checked', detail: 'Found 3 items.' },
            { label: 'Test: Rain hits the outdoor event', status: 'skipped', detail: 'Indoor venue.' },
          ],
        }}
      />,
    );

    const region = screen.getByRole('region', { name: "What I'll do" });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Look for costs we may have forgotten');
    expect(items[0]).toHaveTextContent('Checked');
    expect(items[1]).toHaveTextContent('Not done');
    await expectNoAxeViolations(container);
  });

  it('keeps the plain info list when there are no steps', () => {
    render(
      <AssistantOutcomeView
        outcome={{ kind: 'info', message: 'Hidden costs', items: [{ title: 'Generator', detail: 'Backup power' }] }}
      />,
    );
    expect(screen.queryByRole('region', { name: "What I'll do" })).not.toBeInTheDocument();
    expect(screen.getByText('Generator')).toBeInTheDocument();
  });
});
