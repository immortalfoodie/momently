import { describe, expect, it } from 'vitest';
import { createId, createIdFactory } from '@/lib/id';

describe('createId', () => {
  it('generates an 8-character unique identifier without prefix', () => {
    const id = createId();
    expect(id).toMatch(/^[0-9a-f]{8}$/i);
  });

  it('generates a prefixed identifier', () => {
    const id = createId('task');
    expect(id).toMatch(/^task_[0-9a-f]{8}$/i);
  });

  it('generates distinct IDs on sequential calls', () => {
    const first = createId('slot');
    const second = createId('slot');
    expect(first).not.toBe(second);
  });
});

describe('createIdFactory', () => {
  it('produces repeatable sequences for deterministic unit tests', () => {
    const generatorA = createIdFactory('fixed_seed');
    const generatorB = createIdFactory('fixed_seed');

    const sequenceA = [generatorA('item'), generatorA('item'), generatorA('item')];
    const sequenceB = [generatorB('item'), generatorB('item'), generatorB('item')];

    expect(sequenceA).toEqual(sequenceB);
  });

  it('generates distinct IDs within the same factory sequence', () => {
    const generator = createIdFactory('unique_run');
    const first = generator('slot');
    const second = generator('slot');
    expect(first).not.toBe(second);
  });
});
