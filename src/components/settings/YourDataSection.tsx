'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { useAnnouncer } from '@/components/ui/LiveRegion';
import { exportBackup, parseBackup } from '@/lib/export/backup';
import { downloadText } from '@/lib/export/download';
import { engineContext } from '@/store/engineContext';
import { useEventsStore } from '@/store/eventsStore';
import { useEventList } from '@/store/selectors';

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function YourDataSection() {
  const router = useRouter();
  const { announce } = useAnnouncer();
  const records = useEventList();
  const importEvents = useEventsStore((s) => s.importEvents);
  const deleteAllData = useEventsStore((s) => s.deleteAllData);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleExport = () => {
    setErrorMessage(null);
    setStatusMessage(null);
    const now = engineContext.clock();
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `momently-backup-${dateStr}.json`;
    const json = exportBackup(records, now);
    const res = downloadText(filename, 'application/json;charset=utf-8', json);
    if (res.ok) {
      announce(`Downloaded ${res.value.filename}`);
      setStatusMessage(`Exported ${records.length} ${records.length === 1 ? 'event' : 'events'} to ${res.value.filename}.`);
    } else {
      setErrorMessage(res.error.message);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await readFileText(file);
      const parsed = parseBackup(text);
      if (!parsed.ok) {
        setErrorMessage(parsed.error.message);
        announce(parsed.error.message);
        return;
      }

      const result = importEvents(parsed.value.records);
      const totalSkipped = parsed.value.skipped + result.skipped;
      const summary = `Imported ${result.imported} ${result.imported === 1 ? 'event' : 'events'}, skipped ${totalSkipped}`;
      setStatusMessage(summary);
      announce(summary);
    } catch {
      const msg = 'Could not read the selected backup file.';
      setErrorMessage(msg);
      announce(msg);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmDelete = () => {
    deleteAllData();
    setConfirmDeleteOpen(false);
    announce('All local data deleted from this browser.');
    router.push('/');
  };

  return (
    <section aria-labelledby="settings-your-data-heading" className="space-y-3">
      <h2
        id="settings-your-data-heading"
        className="text-xl font-serif font-bold text-[#2B1B2E]"
      >
        Your data
      </h2>

      <Card className="p-5 space-y-5">
        <div className="space-y-1">
          <p className="text-base font-semibold text-[#2B1B2E]">
            {records.length} {records.length === 1 ? 'event' : 'events'} stored in this browser
          </p>
          <p className="text-xs text-[#5B4A5E]">
            Backups include your saved contacts and event history—keep backup files private.
          </p>
        </div>

        {statusMessage && (
          <div
            role="status"
            className="p-3.5 rounded-[12px] bg-[#E7F4EE] border border-[#C3E6D7] text-sm text-[#1F6F54]"
          >
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-[12px] bg-[#FBE9EB] border border-[#F4C5CB] text-sm text-[#A12B3A]"
          >
            {errorMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <Button
            type="button"
            variant="secondary"
            icon={<Icon name="download" size={16} aria-hidden="true" />}
            onClick={handleExport}
            className="min-h-[44px]"
          >
            Export all my data
          </Button>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="import-backup-file"
              className="text-xs font-semibold text-[#2B1B2E]"
            >
              Import data (.json)
            </label>
            <input
              id="import-backup-file"
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="text-sm text-[#2B1B2E] file:mr-3 file:min-h-[36px] file:px-3 file:py-1.5 file:rounded-[8px] file:border file:border-[#E6DCD2] file:bg-white file:text-sm file:font-medium file:text-[#2B1B2E] hover:file:bg-[#F4EDE6] cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#E6DCD2]">
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmDeleteOpen(true)}
            className="min-h-[44px]"
          >
            Delete all my data from this browser
          </Button>
        </div>
      </Card>

      {confirmDeleteOpen && (
        <Dialog
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          title="Delete all local data?"
        >
          <div className="space-y-4">
            <p className="text-sm text-[#5B4A5E] leading-relaxed">
              This permanently removes every event plan, version snapshot and contact stored in this browser. This action can&apos;t be undone—we recommend clicking &ldquo;Export all my data&rdquo; first if you want a backup copy.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmDeleteOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDelete}
                className="min-h-[44px]"
              >
                Delete everything
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}
