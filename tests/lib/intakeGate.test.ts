import { describe, expect, it } from 'vitest';
import { INTAKE_PROMPTS } from '@/lib/chatText';
import { looksLikeEventBrief } from '@/lib/intakeGate';

describe('looksLikeEventBrief', () => {
  it('rejects greetings and vague questions so no event is auto-created', () => {
    for (const text of ['Hey', 'hi there', 'What is the budget?', 'help', 'what can you do']) {
      expect(looksLikeEventBrief(text)).toBe(false);
    }
  });

  it('accepts real celebration briefs, including Hinglish', () => {
    expect(looksLikeEventBrief('Shaadi in Jaipur for 300 log')).toBe(true);
    expect(looksLikeEventBrief('Small get together for 20 people')).toBe(true);
    expect(looksLikeEventBrief('Planning something under ₹50,000')).toBe(true);
  });

  it('accepts every intake starter chip', () => {
    for (const prompt of INTAKE_PROMPTS) expect(looksLikeEventBrief(prompt)).toBe(true);
  });
});
