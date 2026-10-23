import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsClient } from '@/components/settings/SettingsClient';
import { LiveRegionProvider } from '@/components/ui/LiveRegion';
import { buildDemoPlan } from '@/engine/demo';
import * as apiClientModule from '@/lib/apiClient';
import { BACKUP_FORMAT, BACKUP_VERSION, exportBackup, parseBackup } from '@/lib/export/backup';
import * as downloadModule from '@/lib/export/download';
import { createIdFactory } from '@/lib/id';
import { ok } from '@/lib/result';
import { useEventsStore } from '@/store/eventsStore';
import { expectNoAxeViolations } from '../helpers/a11y';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(''),
}));

const ctx = {
  ids: createIdFactory('settings_page_test'),
  clock: () => new Date('2026-10-21T12:00:00.000Z'),
};

describe('UI: Settings Page & Data Portability (TASK 4 & 5)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pushMock.mockReset();
    vi.spyOn(apiClientModule, 'fetchHealth').mockResolvedValue(
      ok({ mode: 'demo' as const }),
    );
    useEventsStore.getState().deleteAllData();
    useEventsStore.setState({ hydrated: true });
    useEventsStore.getState().createDemoEvent();
  });

  it('renders AI mode, Your data, About this app sections and passes axe audit', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <SettingsClient />
      </LiveRegionProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'AI mode' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your data' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'About this app' })).toBeInTheDocument();
    expect(screen.getByText(/1 event stored in this browser/i)).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('Export all my data triggers a JSON download that parseBackup accepts', () => {
    let capturedContent = '';
    const downloadSpy = vi
      .spyOn(downloadModule, 'downloadText')
      .mockImplementation((filename, _mime, content) => {
        capturedContent = content;
        return { ok: true, value: { filename } };
      });

    render(
      <LiveRegionProvider>
        <SettingsClient />
      </LiveRegionProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export all my data' }));
    expect(downloadSpy).toHaveBeenCalledTimes(1);

    const parsed = parseBackup(capturedContent);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.records).toHaveLength(1);
    }
  });

  it('handles backup import success, partial skip, and invalid JSON failure messages', async () => {
    render(
      <LiveRegionProvider>
        <SettingsClient />
      </LiveRegionProvider>,
    );

    const input = screen.getByLabelText(/Import data/i) as HTMLInputElement;
    const { plan, assumptions } = buildDemoPlan(ctx);
    const validRecord = {
      plan,
      history: [],
      messages: [],
      assumptions,
      missingInfo: [],
      contacts: [],
    };
    const invalidRecord = { plan: { bad: true } };

    // Partial import: 2 valid, 1 invalid -> "Imported 2 events, skipped 1"
    const partialPayload = JSON.stringify({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2026-10-21T00:00:00.000Z',
      events: [validRecord, validRecord, invalidRecord],
    });
    const partialFile = new File([partialPayload], 'backup.json', {
      type: 'application/json',
    });

    fireEvent.change(input, { target: { files: [partialFile] } });

    await waitFor(() => {
      expect(screen.getByText('Imported 2 events, skipped 1')).toBeInTheDocument();
    });

    // Failure import: invalid JSON
    const badFile = new File(['not-json'], 'bad.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/not valid JSON/i);
    });

    // Full success import
    const fullValidPayload = exportBackup([validRecord], ctx.clock());
    const validFile = new File([fullValidPayload], 'good.json', {
      type: 'application/json',
    });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText('Imported 1 event, skipped 0')).toBeInTheDocument();
    });
  });

  it('delete flow: cancel deletes nothing, confirm deletes all data and navigates home, and dialog passes axe', async () => {
    const { container } = render(
      <LiveRegionProvider>
        <SettingsClient />
      </LiveRegionProvider>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete all my data from this browser' }),
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Delete all local data?' }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);

    // Cancel deletes nothing
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useEventsStore.getState().order).toHaveLength(1);

    // Open again and confirm
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete all my data from this browser' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete everything' }));

    expect(useEventsStore.getState().order).toHaveLength(0);
    expect(pushMock).toHaveBeenCalledWith('/');
  });
});
