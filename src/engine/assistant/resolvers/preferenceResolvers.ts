import type { Constraint, EventPlan, PlanPatchOp } from '@/domain/types';
import { buildOption } from '@/engine/chaos/option';
import type { RecoveryOption } from '@/engine/chaos/types';
import { checkRequest, findConflicts } from '@/engine/conflicts';
import type { EngineContext } from '@/engine/context';
import { previewOps } from '@/engine/preview';
import type {
  AddPreferenceIntent,
  SetDateIntent,
  SetSettingIntent,
} from '@/llm/schemas/intent';
import type { AssistantOutcome } from '../types';

export function resolveAddPreference(
  plan: EventPlan,
  intent: AddPreferenceIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const newConstraint: Constraint = {
    id: ctx.ids('constraint'),
    kind: intent.preferenceKind,
    severity: intent.severity,
    description: intent.description,
  };

  const op: PlanPatchOp = { type: 'add_constraint', constraint: newConstraint };
  const checkRes = checkRequest(plan, [op], ctx);

  if (checkRes.verdict === 'conflict') {
    const preview = previewOps(plan, [op], ctx);
    const conflicts = preview.ok ? findConflicts(preview.value.plan, ctx) : checkRes.newConflicts;
    const options: RecoveryOption[] = [];

    for (const c of conflicts) {
      for (const resOpt of c.options) {
        const fullOps = [op, ...resOpt.ops];
        const opt = buildOption(
          plan,
          fullOps,
          {
            id: `opt_pref_conflict_${resOpt.id}`,
            label: resOpt.label,
            tradeoff: resOpt.tradeoff,
          },
          ctx,
          false,
          'user',
        );
        if (opt) options.push(opt);
      }
    }

    return {
      kind: 'conflict',
      message: `Adding preference "${intent.description}" introduces a conflict (${conflicts.map((c) => c.message).join('; ')}).`,
      conflicts,
      options,
    };
  }

  const opt = buildOption(
    plan,
    [op],
    {
      id: 'opt_add_preference',
      label: `Add ${intent.severity} preference: ${intent.description}`,
      tradeoff: `Records ${intent.preferenceKind} constraint with ${intent.severity} severity`,
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Proposed adding ${intent.severity} preference: "${intent.description}".`,
    options: opt ? [opt] : [],
    notes: [],
  };
}

export function resolveSetSetting(
  plan: EventPlan,
  intent: SetSettingIntent,
  ctx: EngineContext,
): AssistantOutcome {
  const op: PlanPatchOp = { type: 'set_setting', setting: intent.setting };
  const checkRes = checkRequest(plan, [op], ctx);

  if (checkRes.verdict === 'conflict') {
    const preview = previewOps(plan, [op], ctx);
    const conflicts = preview.ok ? findConflicts(preview.value.plan, ctx) : checkRes.newConflicts;
    const options: RecoveryOption[] = [];

    for (const c of conflicts) {
      for (const resOpt of c.options) {
        const fullOps = [op, ...resOpt.ops];
        const opt = buildOption(
          plan,
          fullOps,
          {
            id: `opt_setting_conflict_${resOpt.id}`,
            label: resOpt.label,
            tradeoff: resOpt.tradeoff,
          },
          ctx,
          false,
          'user',
        );
        if (opt) options.push(opt);
      }
    }

    return {
      kind: 'conflict',
      message: `Setting venue format to "${intent.setting}" introduces logistical conflicts (${conflicts.map((c) => c.message).join('; ')}).`,
      conflicts,
      options,
    };
  }

  const opt = buildOption(
    plan,
    [op],
    {
      id: 'opt_set_setting',
      label: `Change setting to ${intent.setting}`,
      tradeoff: `Updates venue setting from ${plan.meta.setting} to ${intent.setting}`,
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Proposed updating event setting from "${plan.meta.setting}" to "${intent.setting}".`,
    options: opt ? [opt] : [],
    notes: [],
  };
}

export function resolveSetDate(
  plan: EventPlan,
  intent: SetDateIntent,
  ctx: EngineContext,
  today: string,
): AssistantOutcome {
  if (intent.dateIso < today) {
    return {
      kind: 'clarify',
      question: `Event date ${intent.dateIso} is in the past relative to today (${today}). Please provide a future event date.`,
    };
  }

  const op: PlanPatchOp = {
    type: 'set_meta',
    changes: { dateIso: intent.dateIso },
  };

  const opt = buildOption(
    plan,
    [op],
    {
      id: 'opt_set_date',
      label: `Reschedule event to ${intent.dateIso}`,
      tradeoff: `Updates scheduled date from ${plan.meta.dateIso ?? 'unspecified'} to ${intent.dateIso}`,
    },
    ctx,
    false,
    'user',
  );

  return {
    kind: 'proposal',
    message: `Proposed setting event date to ${intent.dateIso}.`,
    options: opt ? [opt] : [],
    notes: [],
  };
}
