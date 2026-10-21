import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Studio Home',
};

export default function Home() {
  return (
    <div className="py-2">
      <PageHeader
        title="Momently Celebration Studio"
        description="Plan, stress-test, and orchestrate milestone celebrations with real-time budget, vendor, and contingency intelligence."
        actions={
          <LinkButton
            href="/new"
            variant="primary"
            icon={<Icon name="plus" size={16} aria-hidden="true" />}
          >
            Create New Event
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-[10px] bg-[#F4EDE6] text-[#6B2D5C] flex items-center justify-center mb-2">
              <Icon name="bulb" size={20} aria-hidden="true" />
            </div>
            <CardTitle level={2}>Creative Concepts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#5B4A5E]">
              Explore 3 differentiated celebration aesthetics with guaranteed budget feasibility and transparent tradeoffs.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-[10px] bg-[#FFF4DC] text-[#8A5A00] flex items-center justify-center mb-2">
              <Icon name="wallet" size={20} aria-hidden="true" />
            </div>
            <CardTitle level={2}>Deterministic Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#5B4A5E]">
              Every rupee accounted for with strict mathematical invariance. Cost calculations never hallucinate.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="w-10 h-10 rounded-[10px] bg-[#E8F0F8] text-[#2B5C8A] flex items-center justify-center mb-2">
              <Icon name="storm" size={20} aria-hidden="true" />
            </div>
            <CardTitle level={2}>Chaos Lab</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#5B4A5E]">
              Simulate weather disruptions, vendor dropouts, and sudden schedule delays with one-click recovery options.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white rounded-[16px] border border-[#E6DCD2] p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-[#2B1B2E]">
            Experience the 25th Anniversary Demo
          </h2>
          <p className="text-sm text-[#5B4A5E] mt-1">
            Explore a benchmark Mumbai anniversary celebration for 80 guests with a ₹1.5 lakh budget cap.
          </p>
        </div>
        <LinkButton href="/events/demo" variant="secondary">
          Open Demo Studio
        </LinkButton>
      </div>
    </div>
  );
}
