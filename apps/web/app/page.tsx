import { Footer } from '@/components/footer';
import { Anatomy } from '@/components/landing/anatomy';
import { Boundary } from '@/components/landing/boundary';
import { CreFilingPath } from '@/components/landing/cre-path';
import { Hero } from '@/components/landing/hero';
import { KolIndex } from '@/components/landing/kol-index';
import { ProblemStatement } from '@/components/landing/problem';
import { CurrentRecord } from '@/components/landing/record';
import { RejectedTrades } from '@/components/landing/rejections';
import { RulesSection } from '@/components/landing/rules';
import { safeGet } from '@/lib/api';
import type {
  Board,
  CaseDetail,
  CaseFile,
  CreRun,
  Kol,
  Metrics,
  Ruleset,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const [board, metrics, kols, rejected, ruleset, runs] = await Promise.all([
    safeGet<Board>('/api/board'),
    safeGet<Metrics>('/api/metrics'),
    safeGet<{ rows: Kol[] }>('/api/kols'),
    safeGet<{ events: CaseFile[] }>('/api/events?decision=rejected'),
    safeGet<Ruleset>('/api/rules/active'),
    safeGet<{ runs: CreRun[] }>('/api/cre/runs'),
  ]);

  const featured = board?.featuredEventId
    ? await safeGet<CaseDetail>(`/api/events/${board.featuredEventId}`)
    : null;

  const runRows = runs?.runs ?? [];
  const verdictRun =
    runRows.find(
      (run) =>
        run.workflow === 'verdict' &&
        run.eventId === featured?.event.eventId &&
        run.txHash !== null,
    ) ??
    runRows.find((run) => run.workflow === 'verdict') ??
    null;

  const error = board === null;

  return (
    <>
      <Hero board={board} caseFile={featured?.event ?? null} error={error} />
      <CurrentRecord metrics={metrics} mode={board?.mode ?? 'replay'} />
      <ProblemStatement />
      <Anatomy caseFile={featured?.event ?? null} run={verdictRun} />
      <KolIndex rows={kols?.rows ?? null} />
      <RejectedTrades cases={rejected?.events ?? null} />
      <RulesSection ruleset={ruleset} />
      <CreFilingPath run={verdictRun} />
      <Boundary />
      <Footer ledger={board?.chain.ledger ?? null} />
    </>
  );
}
