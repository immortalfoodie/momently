import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Executes axe-core accessibility audit on an element container in jsdom.
 *
 * NOTE ON COLOR CONTRAST:
 * jsdom does not compute layout geometry, pseudo-elements, or cascade color renderings,
 * so axe-core's 'color-contrast' rule cannot reliably calculate contrast in this test environment.
 * We explicitly disable 'color-contrast' here; color contrast is formally audited and verified
 * in the design tokens contrast audit table in src/app/globals.css (all pairings >= 5.3:1).
 *
 * @param container - DOM Node or HTMLElement rendered by React Testing Library.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });

  if (results.violations.length > 0) {
    const violationSummary = results.violations
      .map(
        (v) =>
          `[${v.id}] ${v.help} (${v.helpUrl})\n  Impact: ${v.impact}\n  Nodes:\n${v.nodes.map((n) => `    - ${n.html}: ${n.failureSummary}`).join('\n')}`,
      )
      .join('\n\n');

    expect.fail(`Expected no accessibility violations, but found ${results.violations.length}:\n\n${violationSummary}`);
  }

  expect(results.violations).toHaveLength(0);
}
