'use client';

import { useState } from 'react';
import type { EventPlan, PlanPatchOp } from '@/domain/types';
import { useUserEdit } from '@/components/budget/useUserEdit';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { NumberInput } from '@/components/ui/NumberInput';
import { TextInput } from '@/components/ui/TextInput';

export interface GuestNeedsFormProps {
  plan: EventPlan;
  eventId: string;
  className?: string;
}

const FIELD_LABELS: Record<string, string> = {
  veg: 'Vegetarians',
  jain: 'Jain guests',
  vegan: 'Vegans',
  gf: 'Gluten-free guests',
  allergies: 'Guests with allergy alerts',
  wheelchair: 'Wheelchair users',
  elderly: 'Elderly guests',
  children: 'Children',
};

function computeGuestNeedsErrors(
  counts: Record<string, number>,
  maxGuests: number,
): Record<string, string | undefined> {
  const errs: Record<string, string | undefined> = {};
  for (const [key, val] of Object.entries(counts)) {
    if (val > maxGuests) {
      const label = FIELD_LABELS[key] ?? key;
      errs[key] = `${label} can't be more than your guest count of ${maxGuests}`;
    }
  }
  return errs;
}

export function GuestNeedsForm({ plan, eventId, className = '' }: GuestNeedsFormProps) {
  const { announce } = useAnnouncer();
  const { applyEdit } = useUserEdit(eventId);
  const maxGuests = plan.meta.guestCount;
  const initialNeeds = plan.guestNeeds;

  const [veg, setVeg] = useState(initialNeeds.vegetarian);
  const [jain, setJain] = useState(initialNeeds.jain);
  const [vegan, setVegan] = useState(initialNeeds.vegan);
  const [gf, setGf] = useState(initialNeeds.glutenFree);
  const [allergies, setAllergies] = useState(initialNeeds.allergyAlerts);

  const [wheelchair, setWheelchair] = useState(initialNeeds.wheelchairUsers);
  const [elderly, setElderly] = useState(initialNeeds.elderly);
  const [children, setChildren] = useState(initialNeeds.children);
  const [quietSpace, setQuietSpace] = useState(initialNeeds.quietSpaceNeeded);

  const [languages, setLanguages] = useState<string[]>(initialNeeds.languages);
  const [newLang, setNewLang] = useState('');
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const counts: Record<string, number> = {
    veg,
    jain,
    vegan,
    gf,
    allergies,
    wheelchair,
    elderly,
    children,
  };
  const errors = computeGuestNeedsErrors(counts, maxGuests);

  const hasErrors = Object.values(errors).some(Boolean);

  const handleAddLanguage = () => {
    const trimmed = newLang.trim();
    if (!trimmed || languages.includes(trimmed) || languages.length >= 5) return;
    setLanguages([...languages, trimmed]);
    setNewLang('');
  };

  const handleRemoveLanguage = (langToRemove: string) => {
    setLanguages(languages.filter((l) => l !== langToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) return;

    setIsSaving(true);
    setSavedSummary(null);

    const ops: PlanPatchOp[] = [
      {
        type: 'set_guest_needs',
        changes: {
          vegetarian: veg,
          jain,
          vegan,
          glutenFree: gf,
          allergyAlerts: allergies,
          wheelchairUsers: wheelchair,
          elderly,
          children,
          quietSpaceNeeded: quietSpace,
          languages,
        },
      },
    ];

    const success = await applyEdit(ops, 'Updated guest needs');
    setIsSaving(false);
    if (success) {
      const summary = `Saved requirements for ${maxGuests} guests`;
      setSavedSummary(summary);
      announce(summary);
    }
  };

  return (
    <Card className={`p-4 sm:p-6 bg-white border border-[#E6DCD2] space-y-6 ${className}`}>
      <form onSubmit={handleSave} className="space-y-6">
        {/* Group 1: Food */}
        <fieldset className="space-y-4 border-b border-[#E6DCD2] pb-6">
          <legend className="text-base font-semibold text-[#2B1B2E]">Food & Dietary</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Vegetarian" error={errors.veg}>
              <NumberInput value={veg} onChange={(e) => setVeg(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
            <Field label="Jain" error={errors.jain}>
              <NumberInput value={jain} onChange={(e) => setJain(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
            <Field label="Vegan" error={errors.vegan}>
              <NumberInput value={vegan} onChange={(e) => setVegan(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
            <Field label="Gluten-free" error={errors.gf}>
              <NumberInput value={gf} onChange={(e) => setGf(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
            <Field label="Allergy alerts" error={errors.allergies}>
              <NumberInput value={allergies} onChange={(e) => setAllergies(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
          </div>
        </fieldset>

        {/* Group 2: Access & Comfort */}
        <fieldset className="space-y-4 border-b border-[#E6DCD2] pb-6">
          <legend className="text-base font-semibold text-[#2B1B2E]">Access & Comfort</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Wheelchair users" error={errors.wheelchair}>
              <NumberInput value={wheelchair} onChange={(e) => setWheelchair(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
            <Field label="Elderly guests" error={errors.elderly}>
              <NumberInput value={elderly} onChange={(e) => setElderly(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
            <Field label="Children" error={errors.children}>
              <NumberInput value={children} onChange={(e) => setChildren(Number(e.target.value))} min={0} max={maxGuests} />
            </Field>
          </div>
          <label className="min-h-[44px] inline-flex items-center gap-2.5 cursor-pointer text-sm font-medium text-[#2B1B2E]">
            <input
              type="checkbox"
              checked={quietSpace}
              onChange={(e) => setQuietSpace(e.target.checked)}
              className="w-5 h-5 rounded border-[#E6DCD2] text-[#2B1B2E] focus:ring-1 focus:ring-[#2B1B2E]"
            />
            <span>Quiet retreat space needed (for neurodivergent guests, infants, or quiet breaks)</span>
          </label>
        </fieldset>

        {/* Group 3: Languages */}
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-[#2B1B2E]">Languages (max 5)</legend>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md">
            <TextInput
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              placeholder="e.g. Marathi, Gujarati, English"
              aria-label="Add a language"
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddLanguage}
              disabled={!newLang.trim() || languages.length >= 5}
              className="min-h-[44px]"
            >
              Add
            </Button>
          </div>
          {languages.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1" role="list" aria-label="Languages list">
              {languages.map((lang) => (
                <span
                  key={lang}
                  role="listitem"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F5F2EB] text-xs font-medium text-[#2B1B2E] border border-[#E6DCD2]"
                >
                  {lang}
                  <button
                    type="button"
                    onClick={() => handleRemoveLanguage(lang)}
                    aria-label={`Remove ${lang}`}
                    className="p-1 rounded-full text-[#7A6B7E] hover:text-[#2B1B2E] min-w-[24px] min-h-[24px] flex items-center justify-center"
                  >
                    <Icon name="close" size={14} aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            disabled={hasErrors || isSaving}
            className="min-h-[44px] px-6"
          >
            {isSaving ? 'Saving...' : 'Save guest needs'}
          </Button>
          {savedSummary && (
            <p className="text-sm font-medium text-[#1F6F54]" role="status">
              {savedSummary}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
