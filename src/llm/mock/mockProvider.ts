import { ok, type Result } from '@/lib/result';
import type { LlmError, LlmRequest, LLMProvider } from '@/llm/types';
import { mockIntake } from './mockIntake';
import { mockConcepts } from './mockConcepts';
import { mockIntent } from './mockIntent';
import { mockNarrate } from './mockNarrate';
import type { IntakeInput } from '@/llm/schemas/intake';
import type { ConceptsInput } from '@/llm/schemas/concepts';
import type { IntentInput } from '@/llm/schemas/intent';
import type { NarrateInput } from '@/llm/schemas/narrate';

/**
 * Offline, deterministic LLM Provider implementing the demo mode.
 * WHY: Enables 100% testable, zero-API-key execution for presentations, development, and CI environments.
 */
export class MockProvider implements LLMProvider {
  readonly name = 'mock';

  async complete(request: LlmRequest): Promise<Result<string, LlmError>> {
    switch (request.task) {
      case 'intake': {
        const result = mockIntake(request.input as IntakeInput);
        return ok(JSON.stringify(result));
      }
      case 'concepts': {
        const result = mockConcepts(request.input as ConceptsInput);
        return ok(JSON.stringify(result));
      }
      case 'intent': {
        const result = mockIntent(request.input as IntentInput);
        return ok(JSON.stringify(result));
      }
      case 'narrate': {
        const result = mockNarrate(request.input as NarrateInput);
        return ok(JSON.stringify(result));
      }
    }
  }
}
