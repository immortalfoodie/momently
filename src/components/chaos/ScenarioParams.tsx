'use client';

import type { ChaosScenarioInput } from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import { getBudgetCap } from '@/engine/budget';
import { formatInr } from '@/lib/format';
import { Field } from '@/components/ui/Field';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';

export interface ScenarioParamsProps {
  plan: EventPlan;
  input: ChaosScenarioInput;
  onChange: (input: ChaosScenarioInput) => void;
  error?: string | null;
}

const LATE_START_DURATIONS = [30, 60, 90, 120, 180, 240] as const;

function RainParams() {
  return (
    <div className="p-3.5 rounded-lg bg-[#FAF5F0] border border-[#E6DCD2] text-xs text-[#5C4556]">
      Simulates sudden rain during celebration hours, evaluating waterproof canopy covers and standby backup venues.
    </div>
  );
}

function BudgetCutParams({
  plan,
  percent,
  error,
  onChange,
}: {
  plan: EventPlan;
  percent: number;
  error?: string | null;
  onChange: (input: ChaosScenarioInput) => void;
}) {
  const cap = getBudgetCap(plan.constraints) ?? 0;
  const newCap = Math.round(cap * (1 - percent / 100));
  return (
    <div className="space-y-2">
      <Field label="Budget cut percentage (5% - 60%)" error={error ?? undefined}>
        <NumberInput
          min={5}
          max={60}
          value={percent}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ type: 'budget_cut', percent: isNaN(val) ? 0 : val });
          }}
        />
      </Field>
      <p className="text-xs text-[#5C4556]">
        Resulting budget cap:{' '}
        <span className="font-semibold text-[#2B1B2E]">{formatInr(newCap)}</span>{' '}
        (reduced from {formatInr(cap)})
      </p>
    </div>
  );
}

function GuestSurgeParams({
  plan,
  extraGuests,
  error,
  onChange,
}: {
  plan: EventPlan;
  extraGuests: number;
  error?: string | null;
  onChange: (input: ChaosScenarioInput) => void;
}) {
  const current = plan.meta.guestCount;
  const extra = isNaN(extraGuests) ? 0 : extraGuests;
  return (
    <div className="space-y-2">
      <Field label="Extra surprise guests (1 - 1000)" error={error ?? undefined}>
        <NumberInput
          min={1}
          max={1000}
          value={extraGuests}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ type: 'guest_surge', extraGuests: isNaN(val) ? 0 : val });
          }}
        />
      </Field>
      <p className="text-xs text-[#5C4556]">
        New total attendance:{' '}
        <span className="font-semibold text-[#2B1B2E]">{current + extra} guests</span>{' '}
        (baseline {current})
      </p>
    </div>
  );
}

function VendorCancelsParams({
  plan,
  category,
  error,
  onChange,
}: {
  plan: EventPlan;
  category: string;
  error?: string | null;
  onChange: (input: ChaosScenarioInput) => void;
}) {
  const categories = Array.from(new Set(plan.vendors.map((v) => v.category)));
  return (
    <Field label="Cancelled vendor category" error={error ?? undefined}>
      <Select
        value={category}
        onChange={(e) => onChange({ type: 'vendor_cancels', category: e.target.value })}
      >
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat.replace(/_/g, ' ')}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function LateStartParams({
  delayMinutes,
  error,
  onChange,
}: {
  delayMinutes: number;
  error?: string | null;
  onChange: (input: ChaosScenarioInput) => void;
}) {
  return (
    <Field label="Timeline delay duration" error={error ?? undefined}>
      <Select
        value={delayMinutes}
        onChange={(e) =>
          onChange({
            type: 'late_start',
            delayMinutes: parseInt(e.target.value, 10) || 30,
          })
        }
      >
        {LATE_START_DURATIONS.map((mins) => (
          <option key={mins} value={mins}>
            {mins} minutes ({mins / 60} {mins === 60 ? 'hour' : 'hours'})
          </option>
        ))}
      </Select>
    </Field>
  );
}

function ItemUnavailableParams({
  plan,
  family,
  error,
  onChange,
}: {
  plan: EventPlan;
  family: string;
  error?: string | null;
  onChange: (input: ChaosScenarioInput) => void;
}) {
  const familyOptions: Array<{ family: string; label: string }> = [];
  const seen = new Set<string>();
  for (const item of plan.budgetItems) {
    if (item.rateKey) {
      const fam = item.rateKey.split('.')[0]!;
      if (!seen.has(fam)) {
        seen.add(fam);
        familyOptions.push({ family: fam, label: `${item.label} (${fam})` });
      }
    }
  }

  return (
    <Field label="Unavailable inventory item family" error={error ?? undefined}>
      <Select
        value={family}
        onChange={(e) => onChange({ type: 'item_unavailable', family: e.target.value })}
      >
        {familyOptions.map((opt) => (
          <option key={opt.family} value={opt.family}>
            {opt.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function ScenarioParams({ plan, input, onChange, error }: ScenarioParamsProps) {
  switch (input.type) {
    case 'rain':
      return <RainParams />;
    case 'budget_cut':
      return <BudgetCutParams plan={plan} percent={input.percent} error={error} onChange={onChange} />;
    case 'guest_surge':
      return <GuestSurgeParams plan={plan} extraGuests={input.extraGuests} error={error} onChange={onChange} />;
    case 'vendor_cancels':
      return <VendorCancelsParams plan={plan} category={input.category} error={error} onChange={onChange} />;
    case 'late_start':
      return <LateStartParams delayMinutes={input.delayMinutes} error={error} onChange={onChange} />;
    case 'item_unavailable':
      return <ItemUnavailableParams plan={plan} family={input.family} error={error} onChange={onChange} />;
    default:
      return null;
  }
}
