import type { EventPlan, VendorNeed, VendorQuote } from '@/domain/types';
import { formatInr } from '@/lib/format';
import { itemTotal } from './budget';

export const THRESHOLD = 40;

export interface QuoteVsBudget {
  budgetLineTotal: number;
  difference: number;
  percent: number;
}

export interface QuoteColumn {
  vendorName: string;
  price: number;
  answered: number;
  total: number;
  completenessPercent: number;
  missing: string[];
  vsBudget?: QuoteVsBudget;
}

export interface QuoteComparison {
  questions: string[];
  columns: QuoteColumn[];
  lowestPriceVendor?: string;
  mostCompleteVendor?: string;
  observations: string[];
}

function buildSingleColumn(
  quote: VendorQuote,
  questions: string[],
  budgetLineTotal?: number,
): QuoteColumn {
  const total = questions.length;
  const answeredList = questions.filter(
    (q) => typeof quote.answers[q] === 'string' && quote.answers[q].trim().length > 0,
  );
  const answered = answeredList.length;
  const completenessPercent = total > 0 ? Math.round((answered / total) * 100) : 100;
  const missing = questions.filter(
    (q) => !quote.answers[q] || quote.answers[q].trim().length === 0,
  );

  let vsBudget: QuoteVsBudget | undefined;
  if (budgetLineTotal !== undefined && budgetLineTotal > 0) {
    const difference = quote.price - budgetLineTotal;
    const percent = Math.round((difference / budgetLineTotal) * 100);
    vsBudget = { budgetLineTotal, difference, percent };
  }

  return {
    vendorName: quote.vendorName,
    price: quote.price,
    answered,
    total,
    completenessPercent,
    missing,
    vsBudget,
  };
}

function findExtremes(columns: QuoteColumn[]): {
  lowestQuote?: QuoteColumn;
  mostComplete?: QuoteColumn;
} {
  if (columns.length === 0) return {};
  let lowestQuote = columns[0];
  let mostComplete = columns[0];

  for (const col of columns) {
    if (lowestQuote && col.price < lowestQuote.price) {
      lowestQuote = col;
    }
    if (mostComplete && col.completenessPercent > mostComplete.completenessPercent) {
      mostComplete = col;
    }
  }

  return { lowestQuote, mostComplete };
}

function generateObservations(
  columns: QuoteColumn[],
  lowestQuote?: QuoteColumn,
): string[] {
  const observations: string[] = [];

  if (lowestQuote && lowestQuote.missing.length > 0) {
    const missingCount = lowestQuote.missing.length;
    observations.push(
      `The lowest price (${formatInr(lowestQuote.price)}) hasn't answered ${missingCount} of your questions: ask before paying`,
    );
  }

  for (const col of columns) {
    if (col.vsBudget && Math.abs(col.vsBudget.percent) >= THRESHOLD) {
      observations.push(
        `${col.vendorName} is more than ${THRESHOLD}% away from your budget line: check what's included`,
      );
    }
  }

  return observations;
}

/**
 * Compares vendor quotes objectively against category questions and allocated budget lines.
 * WHY: Provides deterministic, evidence-based comparisons without hallucinating ratings, reviews,
 * or arbitrary quality scores.
 */
export function compareQuotes(plan: EventPlan, need: VendorNeed): QuoteComparison {
  const questions = need.questionsToAsk;
  const quotes = need.quotes;

  if (quotes.length === 0) {
    return {
      questions,
      columns: [],
      observations: [],
    };
  }

  const matchingBudgetItem = plan.budgetItems.find(
    (item) => item.category === need.category,
  );
  const budgetLineTotal = matchingBudgetItem
    ? itemTotal(matchingBudgetItem, plan.meta.guestCount)
    : undefined;

  const columns = quotes.map((q) => buildSingleColumn(q, questions, budgetLineTotal));
  const { lowestQuote, mostComplete } = findExtremes(columns);
  const observations = generateObservations(columns, lowestQuote);

  return {
    questions,
    columns,
    lowestPriceVendor: lowestQuote?.vendorName,
    mostCompleteVendor: mostComplete?.vendorName,
    observations,
  };
}
