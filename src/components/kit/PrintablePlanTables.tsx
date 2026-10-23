import { PROVENANCE_TEXT_MAP } from '@/lib/export/budgetCsv';
import type { PlanDocument } from '@/lib/export/planDocument';
import { formatInr, formatMinuteOfDay } from '@/lib/format';

export interface PrintablePlanTablesProps {
  doc: PlanDocument;
}

export function PrintablePlanTables({ doc }: PrintablePlanTablesProps) {
  return (
    <div className="space-y-8">
      {/* Budget by category */}
      <section aria-labelledby="print-budget-heading" className="space-y-3">
        <h2
          id="print-budget-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Budget by category
        </h2>

        <p className="text-sm text-[#2B1B2E]">
          <strong>Total:</strong> {formatInr(doc.budget.total)}
          {doc.budget.cap !== null
            ? ` • Budget cap: ${formatInr(doc.budget.cap)}`
            : ''}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <caption className="sr-only">
              Budget breakdown by category and provenance
            </caption>
            <thead>
              <tr className="border-b border-[#E6DCD2] text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
                <th scope="col" className="py-2 pr-3">
                  Category
                </th>
                <th scope="col" className="py-2 px-3">
                  Item
                </th>
                <th scope="col" className="py-2 px-3">
                  Source
                </th>
                <th scope="col" className="py-2 pl-3 text-right">
                  Total (INR)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCD2]">
              {doc.budget.categories.flatMap((cat) =>
                cat.items.map((entry) => (
                  <tr key={entry.item.id}>
                    <td className="py-2 pr-3 text-[#5B4A5E]">{cat.label}</td>
                    <th scope="row" className="py-2 px-3 font-medium text-[#2B1B2E]">
                      {entry.item.label}
                    </th>
                    <td className="py-2 px-3 text-[#5B4A5E]">
                      {PROVENANCE_TEXT_MAP[entry.item.provenance]}
                    </td>
                    <td className="py-2 pl-3 text-right font-semibold text-[#2B1B2E]">
                      {formatInr(entry.total)}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Run of show */}
      <section aria-labelledby="print-schedule-heading" className="space-y-3">
        <h2
          id="print-schedule-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Run of show
        </h2>

        {doc.schedule.slots.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <caption className="sr-only">
                Chronological schedule of event sessions
              </caption>
              <thead>
                <tr className="border-b border-[#E6DCD2] text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
                  <th scope="col" className="py-2 pr-3">
                    Time
                  </th>
                  <th scope="col" className="py-2 px-3">
                    Session
                  </th>
                  <th scope="col" className="py-2 px-3">
                    Duration
                  </th>
                  <th scope="col" className="py-2 pl-3">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DCD2]">
                {doc.schedule.slots.map((s) => (
                  <tr key={s.slot.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-[#2B1B2E]">
                      {formatMinuteOfDay(s.slot.startMinute)} &ndash;{' '}
                      {formatMinuteOfDay(s.endMinute)}
                    </td>
                    <th scope="row" className="py-2 px-3 font-semibold text-[#2B1B2E]">
                      {s.slot.title}
                    </th>
                    <td className="py-2 px-3 text-[#5B4A5E]">
                      {s.slot.durationMinutes} min
                    </td>
                    <td className="py-2 pl-3 text-[#5B4A5E]">
                      {s.slot.note ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#5B4A5E]">No sessions scheduled.</p>
        )}
      </section>
    </div>
  );
}
