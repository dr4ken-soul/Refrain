/**
 * CRE fixture parity: the TypeScript mirror must reproduce, byte for byte,
 * what the Python engine froze into cre/fixtures.
 *
 * For each fixture the test proves two independent facts:
 *
 *   1. sha256 over the canonical bytes of the bundle (bundleHash excluded)
 *      equals the committed bundle.bundleHash, so the workflow's canonical
 *      byte implementation matches shared_types.canonical.canonical_json;
 *   2. evaluateBundle over the committed bundle equals the committed
 *      evaluation, rule for rule, including evidence text.
 *
 * The Python twin of this test (tests/test_cre_fixture.py) proves the same
 * two facts from the other side of the language boundary.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { bundleHash } from './canonical';
import { evaluateBundle, type EvidenceBundle } from './rules';

interface CommittedEvaluation {
  decision: string;
  reason_code: string | null;
  rule_results: Array<{ rule: string; pass: boolean | null; evidence: string }>;
}

function loadFixture(name: string): { bundle: EvidenceBundle; evaluation: CommittedEvaluation } {
  const path = new URL(`../fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(path, 'utf8'));
}

const NAMES = ['verdict-approved.json', 'verdict-rejected.json'];

for (const name of NAMES) {
  test(`${name}: canonical bundle hash matches the committed hash`, () => {
    const { bundle } = loadFixture(name);
    assert.equal(bundleHash(bundle as unknown as Record<string, unknown>), bundle.bundleHash);
  });

  test(`${name}: rules mirror reproduces the committed evaluation`, () => {
    const { bundle, evaluation } = loadFixture(name);
    const computed = evaluateBundle(bundle);
    assert.equal(computed.decision, evaluation.decision);
    assert.equal(computed.reasonCode, evaluation.reason_code);
    assert.deepEqual(
      computed.ruleResults.map((row) => ({
        rule: row.rule,
        pass: row.pass,
        evidence: row.evidence,
      })),
      evaluation.rule_results.map((row) => ({
        rule: row.rule,
        pass: row.pass,
        evidence: row.evidence,
      })),
    );
  });
}
