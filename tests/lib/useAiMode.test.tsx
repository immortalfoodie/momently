import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiModeSection } from '@/components/settings/AiModeSection';
import { Header } from '@/components/shell/Header';
import * as apiClient from '@/lib/apiClient';
import { useAiMode } from '@/lib/useAiMode';
import { createDeps } from '@/server/deps';
import { handleHealth } from '@/server/handlers/health';

vi.mock('@/lib/apiClient', () => ({ fetchHealth: vi.fn() }));

describe('useAiMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shares one health request between components mounted together', async () => {
    vi.mocked(apiClient.fetchHealth).mockResolvedValue({ ok: true, value: { mode: 'live', model: 'gemini-test' } });

    render(
      <>
        <Header />
        <AiModeSection />
      </>,
    );

    await waitFor(() => expect(screen.getByText('Model: gemini-test')).toBeInTheDocument());
    expect(screen.getByText('Live AI', { selector: 'header *' })).toHaveAttribute(
      'aria-description',
      'Connected to live AI (gemini-test)',
    );
    expect(apiClient.fetchHealth).toHaveBeenCalledTimes(1);
  });

  it('does not cache a settled answer, so later mounts see fresh mode', async () => {
    vi.mocked(apiClient.fetchHealth).mockResolvedValueOnce({ ok: true, value: { mode: 'demo' } });
    const first = renderHook(() => useAiMode());
    await waitFor(() => expect(first.result.current.status).toBe('demo'));

    vi.mocked(apiClient.fetchHealth).mockResolvedValueOnce({ ok: false, error: { code: 'network', message: 'x' } });
    const second = renderHook(() => useAiMode());
    await waitFor(() => expect(second.result.current.status).toBe('offline'));
    expect(apiClient.fetchHealth).toHaveBeenCalledTimes(2);
  });

  it('treats a rejected request as offline', async () => {
    vi.mocked(apiClient.fetchHealth).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAiMode());
    await waitFor(() => expect(result.current.status).toBe('offline'));
  });
});

describe('Health handler model reporting', () => {
  it('reports the model name only in live mode', async () => {
    const live = await handleHealth(new Request('http://localhost/api/health'), createDeps({ mode: 'live', modelName: 'gemini-x' }));
    expect(await live.json()).toMatchObject({ mode: 'live', model: 'gemini-x' });

    const demo = await handleHealth(new Request('http://localhost/api/health'), createDeps({ mode: 'demo', modelName: 'gemini-x' }));
    expect((await demo.json()).model).toBeUndefined();
  });
});
