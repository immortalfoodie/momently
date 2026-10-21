import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextInput } from '@/components/ui/TextInput';
import { expectNoAxeViolations } from '../helpers/a11y';

describe('UI Primitive: Form Fields & Inputs', () => {
  it('associates label with text input via htmlFor and id', async () => {
    const { container } = render(
      <Field label="Guest Count" hint="Total expected attendees">
        <TextInput />
      </Field>,
    );

    const input = screen.getByLabelText(/guest count/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByText('Total expected attendees')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('wires aria-invalid and aria-describedby when field error is present', async () => {
    const { container } = render(
      <Field label="Event City" error="City is required" alert>
        <TextInput />
      </Field>,
    );

    const input = screen.getByLabelText(/event city/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const errorMsg = screen.getByRole('alert');
    expect(errorMsg).toHaveTextContent('City is required');
    expect(input).toHaveAttribute('aria-describedby', errorMsg.id);
    await expectNoAxeViolations(container);
  });

  it('TextArea character counter announces to screen reader only at thresholds (80%, 90%, 100%)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Field label="Host Brief">
        <TextArea maxLength={10} showCount />
      </Field>,
    );

    const textarea = screen.getByLabelText(/host brief/i);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();

    // 1. Below 80% (5 chars): No threshold announcement
    await user.type(textarea, 'Hello');
    expect(liveRegion?.textContent).toBe('');

    // 2. Cross 80% threshold (8 chars)
    await user.type(textarea, '123');
    expect(liveRegion?.textContent).toContain('80% capacity');

    // 3. Cross 90% threshold (9 chars)
    await user.type(textarea, '4');
    expect(liveRegion?.textContent).toContain('90% capacity');

    // 4. Reach 100% threshold (10 chars)
    await user.type(textarea, '5');
    expect(liveRegion?.textContent).toContain('Maximum limit reached');

    await expectNoAxeViolations(container);
  });

  it('renders Select and NumberInput with proper context associations', async () => {
    const { container } = render(
      <div>
        <Field label="Event Setting">
          <Select>
            <option value="indoor">Indoor Banquet</option>
            <option value="outdoor">Outdoor Lawn</option>
          </Select>
        </Field>
        <Field label="Budget Cap">
          <NumberInput />
        </Field>
      </div>,
    );

    expect(screen.getByLabelText(/event setting/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget cap/i)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
