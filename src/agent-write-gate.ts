import fs from 'node:fs';
import path from 'node:path';
import { resolveAbDemoRoot } from './ab-demo/paths.js';

export interface AgentWriteGate {
  enabled: boolean;
  reason: string;
}

interface AbLatestResults {
  pass?: boolean | null;
  arms?: {
    pass?: boolean | null;
    tokenPass?: boolean;
    hallucinationPass?: boolean | null;
  };
}

function readLatestAbResults(cwd: string): AbLatestResults | null {
  const latestPath = path.join(resolveAbDemoRoot(cwd), 'results', 'latest.json');
  if (!fs.existsSync(latestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(latestPath, 'utf8')) as AbLatestResults;
  } catch {
    return null;
  }
}

/** Agent write tools are enabled when the kill-switch passes or REPOMIND_AGENT_WRITE=1. */
export function getAgentWriteGate(cwd: string = process.cwd()): AgentWriteGate {
  if (process.env.REPOMIND_AGENT_WRITE === '1') {
    return { enabled: true, reason: 'REPOMIND_AGENT_WRITE=1' };
  }

  const latest = readLatestAbResults(cwd);
  const pass = latest?.pass === true || latest?.arms?.pass === true;
  if (pass) {
    return { enabled: true, reason: 'ab-demo kill-switch pass' };
  }

  return {
    enabled: false,
    reason:
      'Agent write is disabled until the ab-demo kill-switch passes. Set REPOMIND_AGENT_WRITE=1 to override locally.',
  };
}

export function isAgentWriteEnabled(cwd: string = process.cwd()): boolean {
  return getAgentWriteGate(cwd).enabled;
}
