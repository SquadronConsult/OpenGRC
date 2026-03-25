import * as discovery from './handlers/discovery.mjs';
import * as repoAnalysis from './handlers/repo-analysis.mjs';
import * as gapAnalysis from './handlers/gap-analysis.mjs';
import * as fileOperations from './handlers/file-operations.mjs';
import * as evidenceLinkage from './handlers/evidence-linkage.mjs';
import * as connectors from './handlers/connectors.mjs';
import * as projectBootstrap from './handlers/project-bootstrap.mjs';
import * as frameworkReference from './handlers/framework-reference.mjs';
import * as searchPolicies from './handlers/search-policies.mjs';
import * as risksApi from './handlers/risks-api.mjs';
import * as policiesApi from './handlers/policies-api.mjs';
import * as pipelineApi from './handlers/pipeline-api.mjs';
import * as checklistApi from './handlers/checklist-api.mjs';
import * as autoScopeApi from './handlers/auto-scope-api.mjs';
import * as crossFrameworkApi from './handlers/cross-framework-api.mjs';
import * as findingsApi from './handlers/findings-api.mjs';
import * as grcBundleApi from './handlers/grc-bundle-api.mjs';
import * as orchestration from './handlers/orchestration.mjs';
import * as reporting from './handlers/reporting.mjs';
import * as skills from './handlers/skills.mjs';
import * as auditLog from './handlers/audit-log.mjs';

const gapMapAndRemediationTools = gapAnalysis.tools.filter(
  (t) => t.name !== 'gap_closure_execution_brief_v1',
);
const gapClosureOnlyTools = gapAnalysis.tools.filter(
  (t) => t.name === 'gap_closure_execution_brief_v1',
);

/** Same tool list order as legacy monolithic index.mjs */
export const tools = [
  ...discovery.tools,
  ...repoAnalysis.tools,
  ...gapMapAndRemediationTools,
  ...fileOperations.tools,
  ...evidenceLinkage.tools,
  ...connectors.tools,
  ...projectBootstrap.tools,
  ...frameworkReference.tools,
  ...searchPolicies.tools,
  ...risksApi.tools,
  ...policiesApi.tools,
  ...pipelineApi.tools,
  ...checklistApi.tools,
  ...autoScopeApi.tools,
  ...crossFrameworkApi.tools,
  ...findingsApi.tools,
  ...grcBundleApi.tools,
  ...orchestration.tools,
  ...reporting.tools,
  ...gapClosureOnlyTools,
  ...skills.tools,
  ...auditLog.tools,
];

const dispatchOrder = [
  discovery,
  repoAnalysis,
  gapAnalysis,
  fileOperations,
  evidenceLinkage,
  connectors,
  projectBootstrap,
  frameworkReference,
  searchPolicies,
  risksApi,
  policiesApi,
  pipelineApi,
  checklistApi,
  autoScopeApi,
  crossFrameworkApi,
  findingsApi,
  grcBundleApi,
  orchestration,
  reporting,
  skills,
  auditLog,
];

export async function dispatchTool(name, args) {
  for (const mod of dispatchOrder) {
    const result = await mod.handle(name, args);
    if (result != null) return result;
  }
  return null;
}
