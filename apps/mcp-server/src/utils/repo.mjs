import fs from 'fs/promises';
import path from 'path';
import { assertWithinAllowedPath } from './guardrails.mjs';

const BLOCKED_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cursor',
  '.vscode',
]);

export async function scanRepoInventory(rootPath, limits = { maxFiles: 5000 }) {
  const resolvedRoot = assertWithinAllowedPath(rootPath);
  const stack = [resolvedRoot];
  const files = [];

  while (stack.length > 0 && files.length < limits.maxFiles) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (files.length >= limits.maxFiles) break;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!BLOCKED_DIRS.has(entry.name)) stack.push(full);
        continue;
      }
      if (entry.isFile()) files.push(full);
    }
  }

  const relative = files.map((f) => path.relative(resolvedRoot, f));
  // Normalize separators for consistent matching across Windows/Linux.
  const normalizedRelative = relative.map((f) => f.replace(/\\/g, '/'));
  const languages = detectLanguages(normalizedRelative);
  const frameworks = detectFrameworks(normalizedRelative);
  const iac = detectIac(normalizedRelative);
  const securitySignals = detectSecuritySignals(normalizedRelative);
  const contextHints = deriveContextHints(normalizedRelative);

  return {
    rootPath: resolvedRoot,
    fileCount: relative.length,
    sampleFiles: relative.slice(0, 100),
    languages,
    frameworks,
    iac,
    securitySignals,
    contextHints,
  };
}

function detectLanguages(files) {
  const flags = {
    typescript: files.some((f) => f.endsWith('.ts') || f.endsWith('.tsx')),
    javascript: files.some((f) => f.endsWith('.js') || f.endsWith('.jsx')),
    python: files.some((f) => f.endsWith('.py')),
    go: files.some((f) => f.endsWith('.go')),
    java: files.some((f) => f.endsWith('.java')),
    csharp: files.some((f) => f.endsWith('.cs')),
  };
  return Object.entries(flags)
    .filter(([, on]) => on)
    .map(([name]) => name);
}

function detectFrameworks(files) {
  const flags = {
    nextjs: files.includes('next.config.js') || files.includes('next.config.mjs'),
    nestjs: files.some((f) => f.includes('app.module.ts')),
    react: files.some((f) => f.endsWith('.tsx') || f.endsWith('.jsx')),
    express: files.some((f) => f.includes('express')),
    docker: files.some((f) => f.toLowerCase().includes('dockerfile')),
  };
  return Object.entries(flags)
    .filter(([, on]) => on)
    .map(([name]) => name);
}

function detectIac(files) {
  return {
    terraformFiles: files.filter((f) => f.endsWith('.tf')).length,
    k8sYamlFiles: files.filter(
      (f) => (f.endsWith('.yaml') || f.endsWith('.yml')) && f.toLowerCase().includes('k8'),
    ).length,
    cloudFormationFiles: files.filter((f) =>
      f.toLowerCase().includes('cloudformation'),
    ).length,
    dockerCompose: files.filter((f) => f.toLowerCase().includes('docker-compose')).length,
  };
}

function detectSecuritySignals(files) {
  return {
    hasCi: files.some((f) => f.startsWith('.github/workflows/') || f.includes('.gitlab-ci')),
    hasSast: files.some((f) => f.toLowerCase().includes('semgrep') || f.toLowerCase().includes('codeql')),
    hasDependencyLock: files.some(
      (f) =>
        f.endsWith('package-lock.json') ||
        f.endsWith('yarn.lock') ||
        f.endsWith('poetry.lock') ||
        f.endsWith('go.sum'),
    ),
    hasSecretsFiles: files.some((f) => /(^|\/)\.env($|\.)/i.test(f)),
  };
}

function deriveContextHints(files) {
  const asPosix = (f) => f.replace(/\\/g, '/');
  const normalized = files.map(asPosix);
  const hasPath = (p) => normalized.includes(p);

  const ciWorkflowFiles = normalized.filter((f) => f.startsWith('.github/workflows/'));
  const complianceFiles = normalized.filter((f) => {
    const lower = f.toLowerCase();
    return (
      lower.includes('/compliance/') ||
      lower.includes('/rmf/') ||
      lower.includes('/security/') ||
      lower.includes('/ssp/')
    );
  });
  const lockfiles = normalized.filter((f) => {
    const lower = f.toLowerCase();
    return (
      lower.endsWith('package-lock.json') ||
      lower.endsWith('yarn.lock') ||
      lower.endsWith('pnpm-lock.yaml') ||
      lower.endsWith('poetry.lock') ||
      lower.endsWith('go.sum') ||
      lower.endsWith('pipfile.lock')
    );
  });
  const dockerfiles = normalized.filter((f) => f.toLowerCase().includes('dockerfile'));
  const iacFiles = normalized.filter((f) => {
    const lower = f.toLowerCase();
    return (
      lower.endsWith('.tf') ||
      lower.includes('/k8s/') ||
      lower.includes('/kubernetes/') ||
      lower.includes('helm') ||
      lower.includes('cloudformation')
    );
  });

  return {
    ciWorkflowFiles: ciWorkflowFiles.slice(0, 30),
    complianceFiles: complianceFiles.slice(0, 40),
    lockfiles: lockfiles.slice(0, 30),
    dockerfiles: dockerfiles.slice(0, 30),
    iacFiles: iacFiles.slice(0, 40),
    hasGitHubActions: hasPath('.github/workflows') || ciWorkflowFiles.length > 0,
    likelyPrimaryCiFile:
      ciWorkflowFiles.find((f) => /ci|build|test/i.test(f)) || ciWorkflowFiles[0] || null,
  };
}
