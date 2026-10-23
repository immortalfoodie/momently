import type { PlanDocument } from '@/lib/export/planDocument';

export interface PrintablePlanDetailsProps {
  doc: PlanDocument;
}

export function PrintablePlanDetails({ doc }: PrintablePlanDetailsProps) {
  return (
    <div className="space-y-8">
      {/* Checklist by timeframe */}
      <section aria-labelledby="print-checklist-heading" className="space-y-4">
        <h2
          id="print-checklist-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Checklist by timeframe
        </h2>
        {doc.checklist.length > 0 ? (
          <div className="space-y-4">
            {doc.checklist.map((group) => (
              <div key={group.name} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[#5B4A5E]">
                  {group.name}
                </h3>
                <ul className="space-y-1 text-sm text-[#2B1B2E]">
                  {group.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2">
                      <span className="font-mono text-xs text-[#5B4A5E] uppercase">
                        [{task.status}]
                      </span>
                      <span className="font-medium">{task.title}</span>
                      <span className="text-xs text-[#5B4A5E]">
                        ({task.priority})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#5B4A5E]">No checklist tasks.</p>
        )}
      </section>

      {/* Vendor status */}
      <section aria-labelledby="print-vendors-heading" className="space-y-3">
        <h2
          id="print-vendors-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Vendor status
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <caption className="sr-only">
              Vendor booking status by category
            </caption>
            <thead>
              <tr className="border-b border-[#E6DCD2] text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
                <th scope="col" className="py-2 pr-4">
                  Category
                </th>
                <th scope="col" className="py-2 pl-4">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCD2]">
              {doc.vendors.map((v) => (
                <tr key={v.category}>
                  <th
                    scope="row"
                    className="py-2 pr-4 font-semibold text-[#2B1B2E] capitalize"
                  >
                    {v.category}
                  </th>
                  <td className="py-2 pl-4 text-[#5B4A5E] capitalize">
                    {v.status.replace('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Guest counts */}
      <section aria-labelledby="print-guests-heading" className="space-y-3">
        <h2
          id="print-guests-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Guest counts
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <caption className="sr-only">
              Guest headcount, catering servings and dietary counts
            </caption>
            <thead>
              <tr className="border-b border-[#E6DCD2] text-xs font-semibold uppercase tracking-wider text-[#5B4A5E]">
                <th scope="col" className="py-2 pr-4">
                  Group
                </th>
                <th scope="col" className="py-2 pl-4">
                  Count
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6DCD2]">
              <tr>
                <th scope="row" className="py-2 pr-4 font-medium text-[#2B1B2E]">
                  Total guests
                </th>
                <td className="py-2 pl-4 text-[#2B1B2E]">{doc.guestCounts.total}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-4 font-medium text-[#2B1B2E]">
                  Food servings (with 5% buffer)
                </th>
                <td className="py-2 pl-4 text-[#2B1B2E]">{doc.guestCounts.servings}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-4 font-medium text-[#2B1B2E]">
                  Banquet tables (8 seats)
                </th>
                <td className="py-2 pl-4 text-[#2B1B2E]">{doc.guestCounts.tables}</td>
              </tr>
              <tr>
                <th scope="row" className="py-2 pr-4 font-medium text-[#2B1B2E]">
                  Vegetarian / Jain / Vegan / Gluten-free
                </th>
                <td className="py-2 pl-4 text-[#2B1B2E]">
                  {doc.guestCounts.vegetarian} / {doc.guestCounts.jain} /{' '}
                  {doc.guestCounts.vegan} / {doc.guestCounts.glutenFree}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Top risks */}
      <section aria-labelledby="print-risks-heading" className="space-y-3">
        <h2
          id="print-risks-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Top risks
        </h2>
        {doc.topRisks.length > 0 ? (
          <ul className="space-y-2 text-sm text-[#2B1B2E]">
            {doc.topRisks.map((risk) => (
              <li key={risk.id}>
                <strong className="capitalize">[{risk.severity}] {risk.title}:</strong>{' '}
                {risk.mitigation}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#5B4A5E]">No major risks flagged.</p>
        )}
      </section>

      {/* Assumptions & Disclaimers */}
      <section aria-labelledby="print-assumptions-heading" className="space-y-3">
        <h2
          id="print-assumptions-heading"
          className="text-xl font-serif font-bold text-[#2B1B2E] border-b border-[#E6DCD2] pb-1.5"
        >
          Assumptions and disclaimers
        </h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-[#5B4A5E]">
          {doc.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="pt-2 space-y-1 text-xs text-[#5B4A5E]">
          {doc.disclaimers.map((d) => (
            <p key={d} className="font-medium text-[#2B1B2E]">
              {d}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
