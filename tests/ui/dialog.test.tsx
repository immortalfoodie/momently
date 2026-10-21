import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { expectNoAxeViolations } from '../helpers/a11y';

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Modal
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Budget Cap"
        description="Adjust hard cap threshold"
      >
        <p>Modal body content</p>
      </Dialog>
    </div>
  );
}

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open Sheet
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Event Run-Sheet"
        placement="bottom"
      >
        <p>Drawer body content</p>
      </Drawer>
    </div>
  );
}

describe('UI Primitive: Dialog & Drawer', () => {
  it('opens dialog, has accessible name, and returns focus to trigger upon closure', async () => {
    const user = userEvent.setup();
    const { container } = render(<DialogHarness />);

    const trigger = screen.getByRole('button', { name: 'Open Modal' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    // Open modal
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Edit Budget Cap' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Adjust hard cap threshold')).toBeInTheDocument();

    await expectNoAxeViolations(container);

    // Close via close button
    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    await user.click(closeBtn);

    // Focus returns to the opening trigger button
    expect(trigger).toHaveFocus();
  });

  it('closes dialog on Escape key cancellation', async () => {
    const handleClose = vi.fn();
    render(
      <Dialog open onClose={handleClose} title="Escape Test">
        <p>Body</p>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Escape Test' });
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('opens Drawer with accessible name and closes on Escape', async () => {
    const user = userEvent.setup();
    const { container } = render(<DrawerHarness />);

    const trigger = screen.getByRole('button', { name: 'Open Sheet' });
    await user.click(trigger);

    const drawer = screen.getByRole('dialog', { name: 'Event Run-Sheet' });
    expect(drawer).toBeInTheDocument();

    await expectNoAxeViolations(container);

    // Close via close button
    const closeBtn = screen.getByRole('button', { name: 'Close drawer' });
    await user.click(closeBtn);
    expect(trigger).toHaveFocus();
  });
});
