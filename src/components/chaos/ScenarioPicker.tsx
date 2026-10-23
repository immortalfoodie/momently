'use client';

import { useId, useState } from 'react';
import {
  CHAOS_SCENARIO_CATALOG,
  chaosScenarioInputSchema,
  type ChaosScenarioInput,
} from '@/domain/chaosSchemas';
import type { EventPlan } from '@/domain/types';
import { scenarioAvailability } from '@/engine/chaos';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScenarioParams } from './ScenarioParams';

export interface ScenarioPickerProps {
  plan: EventPlan;
  selectedType: ChaosScenarioInput['type'];
  onSelectType: (type: ChaosScenarioInput['type']) => void;
  input: ChaosScenarioInput;
  onChangeInput: (input: ChaosScenarioInput) => void;
  onSimulate: (input: ChaosScenarioInput) => void;
  className?: string;
}

/**
 * ScenarioPicker presenting an accessible radio-card catalog of disruption scenarios with live validation.
 */
export function ScenarioPicker({
  plan,
  selectedType,
  onSelectType,
  input,
  onChangeInput,
  onSimulate,
  className = '',
}: ScenarioPickerProps) {
  const radioGroupId = useId();
  const [paramError, setParamError] = useState<string | null>(null);

  const handleSimulate = () => {
    const parse = chaosScenarioInputSchema.safeParse(input);
    if (!parse.success) {
      setParamError(parse.error.issues[0]?.message ?? 'Invalid scenario parameters');
      return;
    }
    setParamError(null);
    onSimulate(parse.data);
  };

  return (
    <Card className={`p-6 border-[#E6DCD2] bg-white space-y-6 ${className}`}>
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-[#2B1B2E]">
          Choose a problem to simulate
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHAOS_SCENARIO_CATALOG.map((item) => {
            const avail = scenarioAvailability(plan, item.type);
            const isSelected = selectedType === item.type;
            const isDisabled = !avail.available;

            return (
              <label
                key={item.type}
                className={`flex flex-col p-4 rounded-xl border text-left transition-all ${
                  isDisabled
                    ? 'border-[#E6DCD2] bg-[#FAF5F0]/60 opacity-60 cursor-not-allowed'
                    : isSelected
                      ? 'border-[#6B2D5C] bg-[#FAF5F0] ring-2 ring-[#6B2D5C]/30 cursor-pointer shadow-xs'
                      : 'border-[#E6DCD2] bg-white hover:border-[#6B2D5C]/50 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name={radioGroupId}
                    value={item.type}
                    checked={isSelected}
                    disabled={isDisabled}
                    onChange={() => {
                      setParamError(null);
                      onSelectType(item.type);
                    }}
                    className="mt-0.5 text-[#6B2D5C] focus:ring-[#6B2D5C] disabled:cursor-not-allowed"
                  />
                  <div className="space-y-1 min-w-0">
                    <span className="text-sm font-semibold text-[#2B1B2E] block">
                      {item.label}
                    </span>
                    <p className="text-xs text-[#5C4556] leading-relaxed">
                      {item.description}
                    </p>
                    {isDisabled && avail.reason && (
                      <p className="text-xs font-medium text-[#A12B3A] pt-1">
                        {avail.reason}
                      </p>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="pt-2 border-t border-[#F4EDE6] space-y-4">
        <h3 className="text-sm font-semibold text-[#2B1B2E]">
          Customize scenario parameters
        </h3>

        <ScenarioParams
          plan={plan}
          input={input}
          onChange={(newInput) => {
            setParamError(null);
            onChangeInput(newInput);
          }}
          error={paramError}
        />

        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleSimulate}
            className="w-full sm:w-auto"
          >
            Simulate this problem
          </Button>
        </div>
      </div>
    </Card>
  );
}
