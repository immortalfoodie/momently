'use client';

import { useState } from 'react';
import type { EventPlan, QualityLevel } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { TextInput } from '@/components/ui/TextInput';
import { resolveIntent } from '@/engine/assistant/resolveIntent';
import { listPlanFamilies } from '@/engine/assistant/resolvers/qualityResolvers';
import type { AssistantOutcome } from '@/engine/assistant/types';
import { budgetTotal } from '@/engine/budget';
import { engineContext } from '@/store/engineContext';

export type GuardianToolKey = 'afford' | 'save' | 'upgrade' | 'premium' | 'forgotten';

export interface GuardianFormCardsProps {
  plan: EventPlan;
  activeTool: GuardianToolKey | null;
  onSelectTool: (tool: GuardianToolKey) => void;
  onOutcome: (outcome: AssistantOutcome) => void;
}

/**
 * GuardianFormCards renders the structured form cards: Affordability Check, Savings Targets, and Quality Upgrades.
 * WHY: Modularizes interactive inputs while adhering to the 200-line engineering guideline.
 */
export function GuardianFormCards({
  plan,
  activeTool,
  onSelectTool,
  onOutcome,
}: GuardianFormCardsProps) {
  const families = listPlanFamilies(plan);
  const total = budgetTotal(plan.budgetItems, plan.meta.guestCount);
  const defaultSaveAmount = Math.max(1000, Math.round((total * 0.1) / 1000) * 1000);

  // Affordability state
  const [affordDesc, setAffordDesc] = useState('');
  const [affordFamily, setAffordFamily] = useState('');
  const [affordCost, setAffordCost] = useState<number>(0);

  // Savings state
  const [saveAmount, setSaveAmount] = useState<number>(defaultSaveAmount);

  // Upgrade state
  const [upgradeFamily, setUpgradeFamily] = useState<string>(families[0] ?? '');
  const [targetQuality, setTargetQuality] = useState<QualityLevel>('premium');

  const getToday = () => new Date().toISOString().split('T')[0] ?? '2026-01-01';

  const handleAffordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!affordDesc.trim()) return;
    const res = resolveIntent(
      plan,
      {
        kind: 'afford_check',
        description: affordDesc.trim(),
        family: affordFamily || null,
        userStatedCost: affordCost > 0 ? Math.round(affordCost) : null,
      },
      engineContext,
      getToday(),
    );
    onOutcome(res);
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = resolveIntent(
      plan,
      { kind: 'save_money', amount: Math.max(1, Math.round(saveAmount)) },
      engineContext,
      getToday(),
    );
    onOutcome(res);
  };

  const handleUpgradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!upgradeFamily) return;
    const res = resolveIntent(
      plan,
      { kind: 'upgrade', family: upgradeFamily, toQuality: targetQuality },
      engineContext,
      getToday(),
    );
    onOutcome(res);
  };

  return (
    <>
      {/* Tool 1: Can we afford...? */}
      <Card
        className={`p-4 bg-white border transition-colors ${
          activeTool === 'afford'
            ? 'border-[#6B2D5C] ring-1 ring-[#6B2D5C]'
            : 'border-[#E6DCD2]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="sparkle" size={16} className="text-[#6B2D5C]" aria-hidden="true" />
          <h3 className="font-serif font-bold text-sm text-[#2B1B2E]">Can we afford…?</h3>
        </div>
        <form onSubmit={handleAffordSubmit} className="space-y-2.5">
          <Field label="Addition description" id="afford-desc" required>
            <TextInput
              id="afford-desc"
              value={affordDesc}
              onChange={(e) => setAffordDesc(e.target.value)}
              placeholder="e.g. Live saxophonist"
              onFocus={() => onSelectTool('afford')}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Family" id="afford-fam">
              <Select
                id="afford-fam"
                value={affordFamily}
                onChange={(e) => setAffordFamily(e.target.value)}
                onFocus={() => onSelectTool('afford')}
              >
                <option value="">Other / not sure</option>
                {families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Your cost (₹)" id="afford-cost" hint="Optional">
              <NumberInput
                id="afford-cost"
                value={affordCost || ''}
                onChange={(e) => setAffordCost(Number(e.target.value) || 0)}
                min={0}
                step={500}
                onFocus={() => onSelectTool('afford')}
              />
            </Field>
          </div>
          <Button size="sm" variant="primary" type="submit" className="w-full">
            Check Affordability
          </Button>
        </form>
      </Card>

      {/* Tool 2: Where can we save? */}
      <Card
        className={`p-4 bg-white border transition-colors ${
          activeTool === 'save'
            ? 'border-[#6B2D5C] ring-1 ring-[#6B2D5C]'
            : 'border-[#E6DCD2]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="wallet" size={16} className="text-[#1F6F54]" aria-hidden="true" />
          <h3 className="font-serif font-bold text-sm text-[#2B1B2E]">Where can we save?</h3>
        </div>
        <form onSubmit={handleSaveSubmit} className="space-y-2.5">
          <Field
            label="Target savings (₹)"
            id="save-amt-input"
            hint="Default is 10% of total spend"
            required
          >
            <NumberInput
              id="save-amt-input"
              value={saveAmount || ''}
              onChange={(e) => setSaveAmount(Number(e.target.value) || 0)}
              min={1000}
              step={1000}
              onFocus={() => onSelectTool('save')}
              required
            />
          </Field>
          <Button size="sm" variant="primary" type="submit" className="w-full">
            Suggest Savings
          </Button>
        </form>
      </Card>

      {/* Tool 3: Upgrade something */}
      <Card
        className={`p-4 bg-white border transition-colors ${
          activeTool === 'upgrade'
            ? 'border-[#6B2D5C] ring-1 ring-[#6B2D5C]'
            : 'border-[#E6DCD2]'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <Icon name="check" size={16} className="text-[#D4A24C]" aria-hidden="true" />
          <h3 className="font-serif font-bold text-sm text-[#2B1B2E]">Upgrade something</h3>
        </div>
        <form onSubmit={handleUpgradeSubmit} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Service family" id="up-fam" required>
              <Select
                id="up-fam"
                value={upgradeFamily}
                onChange={(e) => setUpgradeFamily(e.target.value)}
                onFocus={() => onSelectTool('upgrade')}
                required
              >
                {families.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Target quality" id="up-qual" required>
              <Select
                id="up-qual"
                value={targetQuality}
                onChange={(e) => setTargetQuality(e.target.value as QualityLevel)}
                onFocus={() => onSelectTool('upgrade')}
                required
              >
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </Select>
            </Field>
          </div>
          <Button size="sm" variant="primary" type="submit" className="w-full">
            Evaluate Upgrade
          </Button>
        </form>
      </Card>
    </>
  );
}
