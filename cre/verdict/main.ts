/**
 * Refrain verdict workflow entry point.
 *
 * The CRE runner compiles this file (workflow-path) into the user workflow.
 * Configuration passes through the zod schema declared in workflow.ts.
 */
import { Runner } from '@chainlink/cre-sdk';
import { configSchema, initWorkflow } from './workflow';

export async function main() {
  const runner = await Runner.newRunner({ configSchema });
  await runner.run(initWorkflow);
}

main();
