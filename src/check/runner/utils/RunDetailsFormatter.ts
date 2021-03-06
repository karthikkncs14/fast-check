import { stringify } from '../../../utils/stringify';
import { VerbosityLevel } from '../configuration/VerbosityLevel';
import { ExecutionStatus } from '../reporter/ExecutionStatus';
import { ExecutionTree } from '../reporter/ExecutionTree';
import {
  RunDetails,
  RunDetailsFailureInterrupted,
  RunDetailsFailureProperty,
  RunDetailsFailureTooManySkips,
} from '../reporter/RunDetails';

/** @internal */
function formatHints(hints: string[]): string {
  if (hints.length === 1) {
    return `Hint: ${hints[0]}`;
  }
  return hints.map((h, idx) => `Hint (${idx + 1}): ${h}`).join('\n');
}

/** @internal */
function formatFailures<Ts>(failures: Ts[]): string {
  return `Encountered failures were:\n- ${failures.map(stringify).join('\n- ')}`;
}

/** @internal */
function formatExecutionSummary<Ts>(executionTrees: ExecutionTree<Ts>[]): string {
  const summaryLines: string[] = [];
  const remainingTreesAndDepth: { depth: number; tree: ExecutionTree<Ts> }[] = [];
  for (const tree of executionTrees.reverse()) {
    remainingTreesAndDepth.push({ depth: 1, tree });
  }
  while (remainingTreesAndDepth.length !== 0) {
    const currentTreeAndDepth = remainingTreesAndDepth.pop()!;

    // format current tree according to its depth
    const currentTree = currentTreeAndDepth.tree;
    const currentDepth = currentTreeAndDepth.depth;
    const statusIcon =
      currentTree.status === ExecutionStatus.Success
        ? '\x1b[32m\u221A\x1b[0m'
        : currentTree.status === ExecutionStatus.Failure
        ? '\x1b[31m\xD7\x1b[0m'
        : '\x1b[33m!\x1b[0m';
    const leftPadding = Array(currentDepth).join('. ');
    summaryLines.push(`${leftPadding}${statusIcon} ${stringify(currentTree.value)}`);

    // push its children to the queue
    for (const tree of currentTree.children.reverse()) {
      remainingTreesAndDepth.push({ depth: currentDepth + 1, tree });
    }
  }
  return `Execution summary:\n${summaryLines.join('\n')}`;
}

/** @internal */
function preFormatTooManySkipped<Ts>(out: RunDetailsFailureTooManySkips<Ts>) {
  const message = `Failed to run property, too many pre-condition failures encountered\n{ seed: ${out.seed} }\n\nRan ${out.numRuns} time(s)\nSkipped ${out.numSkips} time(s)`;
  let details: string | null = null;
  const hints = [
    'Try to reduce the number of rejected values by combining map, flatMap and built-in arbitraries',
    'Increase failure tolerance by setting maxSkipsPerRun to an higher value',
  ];

  if (out.verbose >= VerbosityLevel.VeryVerbose) {
    details = formatExecutionSummary(out.executionSummary);
  } else {
    hints.push(
      'Enable verbose mode at level VeryVerbose in order to check all generated values and their associated status'
    );
  }

  return { message, details, hints };
}

/** @internal */
function preFormatFailure<Ts>(out: RunDetailsFailureProperty<Ts>) {
  const message = `Property failed after ${out.numRuns} tests\n{ seed: ${out.seed}, path: "${
    out.counterexamplePath
  }", endOnFailure: true }\nCounterexample: ${stringify(out.counterexample)}\nShrunk ${
    out.numShrinks
  } time(s)\nGot error: ${out.error}`;
  let details: string | null = null;
  const hints = [];

  if (out.verbose >= VerbosityLevel.VeryVerbose) {
    details = formatExecutionSummary(out.executionSummary);
  } else if (out.verbose === VerbosityLevel.Verbose) {
    details = formatFailures(out.failures);
  } else {
    hints.push('Enable verbose mode in order to have the list of all failing values encountered during the run');
  }

  return { message, details, hints };
}

/** @internal */
function preFormatEarlyInterrupted<Ts>(out: RunDetailsFailureInterrupted<Ts>) {
  const message = `Property interrupted after ${out.numRuns} tests\n{ seed: ${out.seed} }`;
  let details: string | null = null;
  const hints = [];

  if (out.verbose >= VerbosityLevel.VeryVerbose) {
    details = formatExecutionSummary(out.executionSummary);
  } else {
    hints.push(
      'Enable verbose mode at level VeryVerbose in order to check all generated values and their associated status'
    );
  }

  return { message, details, hints };
}

/**
 * Format output of `fc.check` using the default error reporting of `fc.assert`
 *
 * Produce a string containing the formated error in case of failed run,
 * undefined otherwise.
 */
function defaultReportMessage<Ts>(out: RunDetails<Ts> & { failed: false }): undefined;
/**
 * Format output of `fc.check` using the default error reporting of `fc.assert`
 *
 * Produce a string containing the formated error in case of failed run,
 * undefined otherwise.
 */
function defaultReportMessage<Ts>(out: RunDetails<Ts> & { failed: true }): string;
/**
 * Format output of `fc.check` using the default error reporting of `fc.assert`
 *
 * Produce a string containing the formated error in case of failed run,
 * undefined otherwise.
 */
function defaultReportMessage<Ts>(out: RunDetails<Ts>): string | undefined;
function defaultReportMessage<Ts>(out: RunDetails<Ts>): string | undefined {
  if (!out.failed) return;

  const { message, details, hints } =
    out.counterexamplePath === null
      ? out.interrupted
        ? preFormatEarlyInterrupted(out)
        : preFormatTooManySkipped(out)
      : preFormatFailure(out);

  let errorMessage = message;
  if (details != null) errorMessage += `\n\n${details}`;
  if (hints.length > 0) errorMessage += `\n\n${formatHints(hints)}`;
  return errorMessage;
}

/** @internal */
function throwIfFailed<Ts>(out: RunDetails<Ts>): void {
  if (!out.failed) return;
  throw new Error(defaultReportMessage(out));
}

/**
 * @internal
 * In case this code has to be executed synchronously the caller
 * has to make sure that no asyncReporter has been defined
 * otherwise it might trigger an unchecked promise
 */
export function reportRunDetails<Ts>(out: RunDetails<Ts>): Promise<void> | void {
  if (out.runConfiguration.asyncReporter) return out.runConfiguration.asyncReporter(out);
  else if (out.runConfiguration.reporter) return out.runConfiguration.reporter(out);
  else return throwIfFailed(out);
}

export { defaultReportMessage };
