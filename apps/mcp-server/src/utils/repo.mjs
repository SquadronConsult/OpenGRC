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
  const lower = (f) => f.toLowerCase();
  return {
    hasCi: files.some((f) => f.startsWith('.github/workflows/') || f.includes('.gitlab-ci')),
    hasSast: files.some((f) => lower(f).includes('semgrep') || lower(f).includes('codeql')),
    hasDependencyLock: files.some(
      (f) =>
        f.endsWith('package-lock.json') ||
        f.endsWith('yarn.lock') ||
        f.endsWith('pnpm-lock.yaml') ||
        f.endsWith('poetry.lock') ||
        f.endsWith('go.sum'),
    ),
    hasSecretsFiles: files.some((f) => /(^|\/)\.env($|\.)/i.test(f)),
    hasDast: files.some((f) => /zap|dast|stackhawk|burp|owasp-zap/i.test(lower(f))),
    hasStructuredLogging: files.some((f) =>
      /pino|winston|bunyan|structured[-_]log|pino-http/i.test(lower(f)),
    ),
    hasAuthConfig: files.some(
      (f) =>
        (lower(f).includes('jwt') || lower(f).includes('oauth') || lower(f).includes('session')) &&
        (lower(f).includes('auth') || lower(f).includes('guard') || lower(f).includes('middleware')),
    ),
    hasSbomGeneration: files.some((f) =>
      /syft|cyclonedx|sbom|spdx|bom\.json/i.test(lower(f)),
    ),
    hasSecretScanning: files.some((f) =>
      /gitleaks|trufflehog|secretlint|detect-secrets|secret-scanning/i.test(lower(f)),
    ),
    hasCodeowners: files.some(
      (f) => f.endsWith('CODEOWNERS') || f.endsWith('.github/CODEOWNERS'),
    ),
    hasLicenseChecker: files.some((f) =>
      /license-check|licensed\.yml|license_finder|fossa|license-compliance/i.test(lower(f)),
    ),
    hasOpenApiSpec: files.some(
      (f) =>
        lower(f).includes('openapi') ||
        lower(f).includes('swagger') ||
        (/\.(yaml|yml|json)$/.test(f) && lower(f).includes('api-spec')),
    ),
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

  const dockerComposeFiles = normalized.filter((f) =>
    /docker-compose.*\.(ya?ml)$/i.test(f),
  );
  const authConfigFiles = normalized.filter(
    (f) =>
      /(^|\/)(auth|jwt|oauth)[^/]*\.(ts|js|mjs)$/i.test(f) ||
      /\/auth\//i.test(f) ||
      /jwt-auth\.guard\./i.test(f),
  );
  const preCommitConfig = normalized.filter((f) =>
    /^\.pre-commit-config\.(ya?ml)$/.test(f),
  );

  return {
    ciWorkflowFiles: ciWorkflowFiles.slice(0, 30),
    complianceFiles: complianceFiles.slice(0, 40),
    lockfiles: lockfiles.slice(0, 30),
    dockerfiles: dockerfiles.slice(0, 30),
    iacFiles: iacFiles.slice(0, 40),
    dockerComposeFiles: dockerComposeFiles.slice(0, 20),
    authConfigFiles: authConfigFiles.slice(0, 30),
    preCommitConfig: preCommitConfig.slice(0, 5),
    hasGitHubActions: hasPath('.github/workflows') || ciWorkflowFiles.length > 0,
    likelyPrimaryCiFile:
      ciWorkflowFiles.find((f) => /ci|build|test/i.test(f)) || ciWorkflowFiles[0] || null,
  };
}
