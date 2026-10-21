import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIO } from '@/data/demoScenario';
import type { EventPlan } from '@/domain/types';
import {
  attachConcepts,
  combineConcepts,
  conceptFit,
  priceConcept,
  resolveConceptRef,
  selectConceptOps,
} from '@/engine/assistant/concepts';
import type { EngineContext } from '@/engine/context';
import { applyPatch } from '@/engine/patch';
import { previewOps } from '@/engine/preview';
import { createIdFactory } from '@/lib/id';
import type { ConceptsOutput } from '@/llm/schemas/concepts';

import { createPlan } from '@/engine/planFactory';

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

describe('Assistant: Concepts Engine', () => {
  const fixedClock = () => new Date('2026-10-21T12:00:00.000Z');
  const makeCtx = (): EngineContext => ({
    ids: createIdFactory('concepts_test'),
    clock: fixedClock,
  });

  function makeDemoPlan(): EventPlan {
    const { plan } = createPlan({
      meta: DEMO_SCENARIO.meta,
      constraints: DEMO_SCENARIO.constraints,
      ids: createIdFactory('demo_init'),
      clock: fixedClock,
    });
    return {
      ...plan,
      concepts: DEMO_SCENARIO.concepts,
    };
  }

  it('prices concepts equal to true previewed ops total including dynamic contingency', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());
    const concept = frozenPlan.concepts[0];
    expect(concept).toBeDefined();
    if (!concept) return;

    const computedPrice = priceConcept(frozenPlan, concept, ctx);
    const ops = selectConceptOps(frozenPlan, concept, ctx);
    const preview = previewOps(frozenPlan, ops, ctx);

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    expect(computedPrice).toBe(preview.value.impact.budgetTotalAfter);
    expect(computedPrice).toBeGreaterThan(0);
  });

  it('ensures all demo concepts price under the 1.5L cap and Elegant Golden costs more than Memory Lane', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());
    const [c1, c2, c3] = frozenPlan.concepts;

    expect(c1).toBeDefined();
    expect(c2).toBeDefined();
    expect(c3).toBeDefined();
    if (!c1 || !c2 || !c3) return;

    const fit1 = conceptFit(frozenPlan, c1, ctx);
    const fit2 = conceptFit(frozenPlan, c2, ctx);
    const fit3 = conceptFit(frozenPlan, c3, ctx);

    expect(fit1.fits).toBe(true);
    expect(fit2.fits).toBe(true);
    expect(fit3.fits).toBe(true);

    expect(fit1.total).toBeLessThanOrEqual(150000);
    expect(fit2.total).toBeLessThanOrEqual(150000);
    expect(fit3.total).toBeLessThanOrEqual(150000);

    // Elegant Golden (decor premium) costs more than Memory Lane (decor essential)
    expect(fit2.total).toBeGreaterThan(fit3.total);
  });

  it('drops unknown service families during attachConcepts and preserves clean state', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    const generatedConcepts: ConceptsOutput = {
      concepts: [
        {
          title: 'Future Tech',
          tagline: 'Futuristic theme',
          summary: 'Tech and neon celebration',
          palette: ['#000000', '#111111', '#222222'],
          experienceHighlights: ['Holograms', 'LED bar', 'Laser show'],
          qualityProfile: {
            decor_theme: 'premium',
            unsupported_laser_drones: 'premium', // should be dropped
          },
          tradeoffs: ['High electrical power required'],
          whyItFits: 'Unique modern flair',
          tags: ['tech'],
        },
        {
          title: DEMO_SCENARIO.concepts[1]!.title,
          tagline: DEMO_SCENARIO.concepts[1]!.tagline,
          summary: DEMO_SCENARIO.concepts[1]!.summary,
          palette: [...DEMO_SCENARIO.concepts[1]!.palette],
          experienceHighlights: [...DEMO_SCENARIO.concepts[1]!.experienceHighlights],
          qualityProfile: DEMO_SCENARIO.concepts[1]!.qualityProfile ?? {},
          tradeoffs: [...DEMO_SCENARIO.concepts[1]!.tradeoffs],
          whyItFits: DEMO_SCENARIO.concepts[1]!.whyItFits,
          tags: [...DEMO_SCENARIO.concepts[1]!.tags],
        },
        {
          title: DEMO_SCENARIO.concepts[2]!.title,
          tagline: DEMO_SCENARIO.concepts[2]!.tagline,
          summary: DEMO_SCENARIO.concepts[2]!.summary,
          palette: [...DEMO_SCENARIO.concepts[2]!.palette],
          experienceHighlights: [...DEMO_SCENARIO.concepts[2]!.experienceHighlights],
          qualityProfile: DEMO_SCENARIO.concepts[2]!.qualityProfile ?? {},
          tradeoffs: [...DEMO_SCENARIO.concepts[2]!.tradeoffs],
          whyItFits: DEMO_SCENARIO.concepts[2]!.whyItFits,
          tags: [...DEMO_SCENARIO.concepts[2]!.tags],
        },
      ],
    };

    const updatedPlan = attachConcepts(frozenPlan, generatedConcepts, ctx);
    expect(updatedPlan.concepts).toHaveLength(3);
    const futureConcept = updatedPlan.concepts[0];
    expect(futureConcept?.qualityProfile?.unsupported_laser_drones).toBeUndefined();
    expect(futureConcept?.qualityProfile?.decor_theme).toBe('premium');
    expect(
      futureConcept?.tradeoffs.some((t) => t.includes('unsupported_laser_drones')),
    ).toBe(true);
    expect(updatedPlan.selectedConceptId).toBeNull();
  });

  it('resolves concept references by digit, ordinal name, exact title, and substring', () => {
    const concepts = deepFreeze(makeDemoPlan().concepts);

    const byOne = resolveConceptRef(concepts, '1');
    expect(byOne.ok).toBe(true);
    if (byOne.ok) expect(byOne.value.title).toBe('Vintage Bollywood Evening');

    const bySecond = resolveConceptRef(concepts, 'second');
    expect(bySecond.ok).toBe(true);
    if (bySecond.ok) expect(bySecond.value.title).toBe('Elegant Golden Celebration');

    const byTitle = resolveConceptRef(concepts, 'elegant golden');
    expect(byTitle.ok).toBe(true);
    if (byTitle.ok) expect(byTitle.value.title).toBe('Elegant Golden Celebration');

    const bySub = resolveConceptRef(concepts, 'Memory');
    expect(bySub.ok).toBe(true);
    if (bySub.ok) expect(bySub.value.title).toBe('Memory Lane');

    const unknown = resolveConceptRef(concepts, 'Cyberpunk Night');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error.message).toContain('Cyberpunk Night');
      expect(unknown.error.message).toContain('Vintage Bollywood Evening');
    }
  });

  it('combines concepts with target savings and produces valid approvable patches', () => {
    const ctx = makeCtx();
    const frozenPlan = deepFreeze(makeDemoPlan());

    // Combine decor from option 2 (Elegant Golden, premium decor) into option 1 (Vintage Bollywood, standard decor), 20% cheaper
    const result = combineConcepts(
      frozenPlan,
      {
        baseRef: '1',
        borrowRef: '2',
        borrowCategories: ['decor'],
        percentCheaper: 20,
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const proposal = result.value;
    expect(proposal.combinedProfile.decor_theme).toBe('premium');
    expect(proposal.options.length).toBeGreaterThan(0);

    const primaryOption = proposal.options[0];
    expect(primaryOption).toBeDefined();
    if (!primaryOption) return;

    expect(primaryOption.patch.source).toBe('user');

    // Test application through formal approval gate
    const approvedPatch = {
      ...primaryOption.patch,
      status: 'approved' as const,
    };
    const applyRes = applyPatch(frozenPlan, approvedPatch, ctx);
    expect(applyRes.ok).toBe(true);
    if (!applyRes.ok) return;

    const finalTotal = applyRes.value.impact.budgetTotalAfter;
    if (proposal.targetTotal !== null) {
      const diffPct = Math.abs(
        ((finalTotal - proposal.targetTotal) / proposal.combinedTotal) * 100,
      );
      // Either within 1 percentage point of target or note reports why
      if (diffPct > 1) {
        expect(
          primaryOption.notes.some(
            (n) =>
              n.includes('Closest achievable') ||
              n.includes('limit further cuts') ||
              n.includes('Target achieved'),
          ),
        ).toBe(true);
      }
    }
  });
});
