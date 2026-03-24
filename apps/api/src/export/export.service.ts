import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../entities/project.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { PoamEntry } from '../entities/poam-entry.entity';
import { ControlTestResult } from '../entities/control-test-result.entity';
import { Finding } from '../entities/finding.entity';

type PoamRisk = 'Low' | 'Moderate' | 'High';

type FedrampPoamRow = {
  poamId: string;
  weaknessName: string;
  weaknessDescription: string;
  weaknessDetectorSource: string;
  weaknessSourceIdentifier: string;
  resourcesAffected: string;
  originalRiskRating: PoamRisk;
  adjustedRiskRating: PoamRisk;
  riskAdjustment: 'No' | 'Pending' | 'Yes';
  falsePositive: 'No' | 'Pending' | 'Yes';
  operationalRequirement: 'No' | 'Pending' | 'Yes';
  vendorDependency: 'No' | 'Yes';
  lastVendorCheckinDate: string | null;
  vendorDependentProductName: string | null;
  status: string;
  discoveryDate: string;
  statusDate: string;
  plannedMilestone: string;
  plannedMilestoneDate: string | null;
  scheduledCompletionDate: string | null;
  comments: string;
  evidenceReferences: string[];
  source: 'FRR' | 'KSI';
};

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Project) private readonly proj: Repository<Project>,
    @InjectRepository(ChecklistItem) private readonly items: Repository<ChecklistItem>,
    @InjectRepository(PoamEntry) private readonly poamRepo: Repository<PoamEntry>,
    @InjectRepository(ControlTestResult)
    private readonly ctr: Repository<ControlTestResult>,
    @InjectRepository(Finding) private readonly findings: Repository<Finding>,
  ) {}

  async exportJson(projectId: string) {
    const project = await this.proj.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const list = await this.items.find({
      where: { projectId },
      relations: [
        'frrRequirement',
        'ksiIndicator',
        'evidence',
        'catalogRequirement',
        'catalogRequirement.frameworkRelease',
        'catalogRequirement.frameworkRelease.framework',
      ],
    });
    return {
      project: {
        id: project.id,
        name: project.name,
        pathType: project.pathType,
        impactLevel: project.impactLevel,
      },
      checklist: list.map((i) => ({
        id: i.id,
        status: i.status,
        dueDate: i.dueDate,
        reviewState: i.reviewState,
        applicability: i.applicabilityDecision
          ? {
              decision: i.applicabilityDecision,
              rationale: i.applicabilityRationale,
              confidence: i.applicabilityConfidence,
              source: i.applicabilitySource,
            }
          : null,
        requirement: i.frrRequirement
          ? {
              process: i.frrRequirement.processId,
              key: i.frrRequirement.reqKey,
              statement: i.frrRequirement.statement,
              keyword: i.frrRequirement.primaryKeyWord,
            }
          : null,
        ksi: i.ksiIndicator
          ? {
              id: i.ksiIndicator.indicatorId,
              statement: i.ksiIndicator.statement,
              controls: i.ksiIndicator.controls,
            }
          : null,
        catalog: i.catalogRequirement
          ? {
              frameworkCode:
                i.catalogRequirement.frameworkRelease?.framework?.code ?? null,
              releaseCode: i.catalogRequirement.frameworkRelease?.releaseCode ?? null,
              requirementCode: i.catalogRequirement.requirementCode,
              kind: i.catalogRequirement.kind,
              statement: i.catalogRequirement.statement,
            }
          : null,
        evidence: i.evidence?.map((e) => {
          const meta = e.metadata as Record<string, unknown> | null | undefined;
          const automated = meta?.automated === true;
          return {
            filename: e.filename,
            externalUri: e.externalUri,
            checksum: e.checksum,
            metadata: meta ?? null,
            sourceConnector: e.sourceConnector,
            sourceSystem: e.sourceSystem,
            artifactType: e.artifactType,
            collectionStart: e.collectionStart,
            collectionEnd: e.collectionEnd,
            createdAt: e.createdAt,
            evidenceOrigin: automated ? 'automated' : 'manual',
          };
        }),
      })),
    };
  }

  async exportMarkdown(projectId: string): Promise<string> {
    const data = await this.exportJson(projectId);
    let md = `# SSP draft — ${data.project.name}\n\n`;
    md += `Path: ${data.project.pathType} | Impact: ${data.project.impactLevel}\n\n`;
    for (const row of data.checklist) {
      const title =
        row.requirement?.key || row.ksi?.id || row.id;
      md += `## ${title}\n`;
      md += `${row.requirement?.statement || row.ksi?.statement || ''}\n`;
      md += `**Status:** ${row.status}\n`;
      if (row.applicability?.decision) {
        md += `**Applicability:** ${row.applicability.decision} (${Math.round(((row.applicability.confidence as number) || 0) * 100)}% confidence)\n`;
      }
      if (row.evidence?.length) {
        const auto = row.evidence.filter((e) => {
          const m = e.metadata as { automated?: boolean } | null | undefined;
          return m?.automated === true;
        });
        const manual = row.evidence.length - auto.length;
        md += `**Evidence:** ${row.evidence.length} artifact(s) — ${manual} manual, ${auto.length} automated\n`;
      }
      if (row.ksi?.controls?.length)
        md += `**NIST 800-53:** ${row.ksi.controls.join(', ')}\n`;
      md += '\n';
    }
    return md;
  }

  async exportPoamJson(projectId: string) {
    const project = await this.proj.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const stored = await this.poamRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
    const list = await this.items.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator', 'evidence'],
    });
    const rows =
      stored.length > 0
        ? stored.map((s) => s.rowData as FedrampPoamRow)
        : this.buildPoamRows(list, project.impactLevel);
    return {
      project: {
        id: project.id,
        name: project.name,
        pathType: project.pathType,
        impactLevel: project.impactLevel,
      },
      generatedAt: new Date().toISOString(),
      totalRows: rows.length,
      format: 'fedramp-poam-open',
      poamSource: stored.length > 0 ? 'stored' : 'derived',
      rows,
    };
  }

  /** Ordered POA&M rows derived from current checklist (non-compliant items). */
  async derivePoamRowSources(projectId: string): Promise<
    { checklistItemId: string; row: FedrampPoamRow }[]
  > {
    const project = await this.proj.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const list = await this.items.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator', 'evidence'],
    });
    const filtered = list
      .filter((i) => i.status !== 'compliant')
      .sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    return filtered.map((i, idx) => ({
      checklistItemId: i.id,
      row: this.buildSinglePoamRow(i, idx, project.impactLevel),
    }));
  }

  async exportOscalSspJson(projectId: string) {
    const project = await this.proj.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const list = await this.items.find({
      where: { projectId },
      relations: ['frrRequirement', 'ksiIndicator', 'evidence'],
    });
    const resources = this.buildOscalResources(list);

    return {
      'system-security-plan': {
        uuid: project.id,
        metadata: this.buildOscalMetadata(
          `${project.name} System Security Plan`,
          'OpenGRC OSCAL SSP export',
        ),
        'import-profile': {
          href: `fedramp-${project.pathType}.json`,
        },
        'system-characteristics': {
          'system-name': project.name,
          description: `${project.name} (${project.pathType}) generated from OpenGRC checklist and evidence state.`,
          'security-sensitivity-level': project.impactLevel,
          status: {
            state: 'operational',
          },
          'authorization-boundary': {
            description: `Authorization boundary for ${project.name} has not been explicitly modeled; generated from project metadata.`,
          },
        },
        'control-implementation': {
          description: 'Generated from OpenGRC FRMR/KSI checklist items and associated evidence.',
          'implemented-requirements': list.map((item) => ({
            uuid: item.id,
            'control-id':
              item.ksiIndicator?.controls?.[0] ||
              (item.frrRequirement
                ? `${item.frrRequirement.processId}.${item.frrRequirement.reqKey}`
                : item.ksiIndicator?.indicatorId || item.id),
            title:
              item.frrRequirement?.name ||
              item.ksiIndicator?.name ||
              item.frrRequirement?.primaryKeyWord ||
              'Checklist implementation',
            description:
              item.frrRequirement?.statement ||
              item.ksiIndicator?.statement ||
              'Generated implementation statement',
            props: [
              { name: 'opengrc-project-id', value: project.id },
              { name: 'opengrc-path-type', value: project.pathType },
              { name: 'opengrc-impact-level', value: project.impactLevel },
              ...(item.frrRequirement
                ? [
                    { name: 'frmr-process-id', value: item.frrRequirement.processId },
                    { name: 'frmr-req-key', value: item.frrRequirement.reqKey },
                    { name: 'frmr-layer', value: item.frrRequirement.layer },
                    { name: 'frmr-actor-label', value: item.frrRequirement.actorLabel },
                  ]
                : []),
              ...(item.ksiIndicator
                ? [{ name: 'ksi-indicator-id', value: item.ksiIndicator.indicatorId }]
                : []),
            ],
            statements: [
              {
                uuid: `${item.id}-statement`,
                description:
                  item.applicabilityRationale ||
                  item.frrRequirement?.statement ||
                  item.ksiIndicator?.statement ||
                  'Implementation statement generated from OpenGRC.',
                remarks: [
                  `Status: ${item.status}`,
                  `Review state: ${item.reviewState || 'unreviewed'}`,
                  ...(item.applicabilityDecision
                    ? [`Applicability: ${item.applicabilityDecision}`]
                    : []),
                ].join(' | '),
              },
            ],
            links: (item.evidence || [])
              .map((e) =>
                e.externalUri
                  ? {
                      href: e.externalUri,
                      rel: 'evidence',
                    }
                  : null,
              )
              .filter(Boolean),
            'set-parameters': [],
          })),
        },
        'back-matter': {
          resources,
        },
      },
    };
  }

  async exportOscalAssessmentPlanJson(projectId: string) {
    const project = await this.proj.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const tests = await this.ctr.find({
      where: { projectId },
      relations: ['checklistItem'],
      order: { createdAt: 'DESC' },
      take: 2000,
    });
    return {
      'assessment-plan': {
        uuid: `ap-${project.id}`,
        metadata: this.buildOscalMetadata(
          `${project.name} Assessment Plan`,
          'OpenGRC OSCAL Assessment Plan export (control test schedule)',
        ),
        'reviewed-controls': tests.map((t) => ({
          'control-id': t.checklistItemId,
          uuid: t.id,
          description: `Automated/manual test (${t.testType})`,
          props: [
            { name: 'test-type', value: t.testType },
            { name: 'result', value: t.result },
            ...(t.nextTestDate
              ? [{ name: 'next-test-date', value: t.nextTestDate }]
              : []),
          ],
        })),
      },
    };
  }

  async exportOscalAssessmentResultsJson(projectId: string) {
    const project = await this.proj.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const list = await this.findings
      .createQueryBuilder('f')
      .innerJoinAndSelect('f.checklistItem', 'ci')
      .where('ci.projectId = :projectId', { projectId })
      .orderBy('f.createdAt', 'DESC')
      .take(2000)
      .getMany();
    const tests = await this.ctr.find({
      where: { projectId },
      relations: ['checklistItem'],
      take: 2000,
    });
    return {
      'assessment-results': {
        uuid: `ar-${project.id}`,
        metadata: this.buildOscalMetadata(
          `${project.name} Assessment Results`,
          'OpenGRC OSCAL Assessment Results (observations from findings and tests)',
        ),
        results: [
          ...list.map((f) => ({
            uuid: f.id,
            title: f.title,
            description: f.description,
            'control-id': f.checklistItemId,
            props: [{ name: 'severity', value: f.severity }],
          })),
          ...tests.map((t) => ({
            uuid: `obs-${t.id}`,
            title: `Test result`,
            description: `Result: ${t.result}`,
            'control-id': t.checklistItemId,
            props: [
              { name: 'test-type', value: t.testType },
              { name: 'result', value: t.result },
            ],
          })),
        ],
      },
    };
  }

  async exportOscalPoamJson(projectId: string) {
    const poam = await this.exportPoamJson(projectId);
    return {
      'plan-of-action-and-milestones': {
        uuid: `poam-${poam.project.id}`,
        metadata: this.buildOscalMetadata(
          `${poam.project.name} Plan of Action and Milestones`,
          'OpenGRC OSCAL POA&M export',
        ),
        'import-ssp': {
          href: `/projects/${poam.project.id}/export?format=oscal-ssp`,
        },
        'poam-items': poam.rows.map((row) => ({
          uuid: row.poamId,
          title: row.weaknessName,
          description: row.weaknessDescription,
          props: [
            { name: 'opengrc-source', value: row.source },
            { name: 'weakness-source-identifier', value: row.weaknessSourceIdentifier },
            { name: 'detector-source', value: row.weaknessDetectorSource },
            { name: 'resources-affected', value: row.resourcesAffected },
            { name: 'original-risk-rating', value: row.originalRiskRating },
            { name: 'adjusted-risk-rating', value: row.adjustedRiskRating },
            { name: 'status', value: row.status },
          ],
          remarks: row.comments,
          'associated-risks': [
            {
              title: row.weaknessName,
              statement: row.weaknessDescription,
              status: row.status,
            },
          ],
          'related-observations': [
            {
              title: row.weaknessDetectorSource,
              description: row.weaknessDescription,
              methods: ['EXAMINE'],
              types: [row.source],
            },
          ],
          'risk-response': {
            lifecycle: 'planned',
            description: row.plannedMilestone,
          },
          milestones: [
            {
              uuid: `${row.poamId}-milestone`,
              title: row.plannedMilestone,
              description: row.comments,
              'due-date': row.plannedMilestoneDate || row.scheduledCompletionDate || row.statusDate,
            },
          ],
          links: row.evidenceReferences.map((href) => ({
            href,
            rel: 'evidence',
          })),
        })),
      },
    };
  }

  async exportPoamMarkdown(projectId: string): Promise<string> {
    const data = await this.exportPoamJson(projectId);
    let md = `# POA&M — ${data.project.name}\n\n`;
    md += `Generated: ${data.generatedAt}\n\n`;
    md += `| POAM ID | Weakness Name | Detector Source | Original Risk | Adjusted Risk | RA | FP | OR | VD | Discovery Date | Milestone Date | Completion Date | Status |\n`;
    md += `|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const row of data.rows) {
      md += `| ${row.poamId} | ${this.escapeMd(row.weaknessName)} | ${this.escapeMd(row.weaknessDetectorSource)} | ${row.originalRiskRating} | ${row.adjustedRiskRating} | ${row.riskAdjustment} | ${row.falsePositive} | ${row.operationalRequirement} | ${row.vendorDependency} | ${row.discoveryDate} | ${row.plannedMilestoneDate || '-'} | ${row.scheduledCompletionDate || '-'} | ${row.status} |\n`;
    }
    return md;
  }

  async exportPoamCsv(projectId: string): Promise<string> {
    const data = await this.exportPoamJson(projectId);
    const header = [
      'POAM_ID',
      'Weakness_Name',
      'Weakness_Description',
      'Weakness_Detector_Source',
      'Weakness_Source_Identifier',
      'Resources_Affected',
      'Original_Risk_Rating',
      'Adjusted_Risk_Rating',
      'Risk_Adjustment_(V)',
      'False_Positive_(W)',
      'Operational_Requirement_(X)',
      'Vendor_Dependency_(Q)',
      'Last_Vendor_Check-in_Date_(R)',
      'Vendor_Dependent_Product_Name_(S)',
      'Status',
      'Discovery_Date',
      'Status_Date',
      'Planned_Milestone',
      'Planned_Milestone_Date',
      'Scheduled_Completion_Date',
      'Comments',
      'Evidence_References',
      'Source',
    ];
    const lines = [header.join(',')];
    for (const row of data.rows) {
      const line = [
        row.poamId,
        row.weaknessName,
        row.weaknessDescription,
        row.weaknessDetectorSource,
        row.weaknessSourceIdentifier,
        row.resourcesAffected,
        row.originalRiskRating,
        row.adjustedRiskRating,
        row.riskAdjustment,
        row.falsePositive,
        row.operationalRequirement,
        row.vendorDependency,
        row.lastVendorCheckinDate || '',
        row.vendorDependentProductName || '',
        row.status,
        row.discoveryDate,
        row.statusDate,
        row.plannedMilestone,
        row.plannedMilestoneDate || '',
        row.scheduledCompletionDate || '',
        row.comments,
        row.evidenceReferences.join('; '),
        row.source,
      ].map((v) => this.csvEscape(String(v)));
      lines.push(line.join(','));
    }
    return lines.join('\n');
  }

  private buildPoamRows(
    list: ChecklistItem[],
    impactLevel: 'low' | 'moderate' | 'high',
  ) {
    const filtered = list
      .filter((i) => i.status !== 'compliant')
      .sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return ad - bd;
      });
    return filtered.map((i, idx) => this.buildSinglePoamRow(i, idx, impactLevel));
  }

  private buildSinglePoamRow(
    i: ChecklistItem,
    idx: number,
    impactLevel: 'low' | 'moderate' | 'high',
  ): FedrampPoamRow {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const controlId = i.frrRequirement
      ? `${i.frrRequirement.processId}-${i.frrRequirement.reqKey}`
      : i.ksiIndicator?.indicatorId || i.id;
    const weaknessDescription =
      i.frrRequirement?.statement || i.ksiIndicator?.statement || 'Control gap requiring remediation.';
    const weaknessName = i.frrRequirement
      ? `${i.frrRequirement.primaryKeyWord || 'Control'} implementation gap`
      : 'KSI implementation gap';
    const severity = this.poamSeverity(i.status, i.dueDate, impactLevel);
    const milestoneDate = this.shiftDate(i.dueDate, -14);
    const completionDate = i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : null;
    const discoveryDate = this.estimateDiscoveryDate(completionDate, severity);
    const evidenceReferences = (i.evidence || [])
      .map((e) => e.externalUri || e.filename || '')
      .filter(Boolean);
    const resourcesAffected = i.frrRequirement
      ? `Process ${i.frrRequirement.processId} requirement ${i.frrRequirement.reqKey}`
      : `KSI ${i.ksiIndicator?.indicatorId || i.id}`;
    const detectorSource = i.frrRequirement
      ? 'FRR assessment / control implementation review'
      : 'KSI assessment / control implementation review';

    return {
      poamId: `POAM-${String(idx + 1).padStart(4, '0')}`,
      weaknessName,
      weaknessDescription,
      weaknessDetectorSource: detectorSource,
      weaknessSourceIdentifier: controlId,
      resourcesAffected,
      originalRiskRating: severity,
      adjustedRiskRating: severity,
      riskAdjustment: 'No',
      falsePositive: 'No',
      operationalRequirement: 'No',
      vendorDependency: 'No',
      lastVendorCheckinDate: null,
      vendorDependentProductName: null,
      status: i.status,
      discoveryDate,
      statusDate: today.toISOString().slice(0, 10),
      plannedMilestone: 'Implement control, validate evidence, and re-test effectiveness.',
      plannedMilestoneDate: milestoneDate,
      scheduledCompletionDate: completionDate,
      comments:
        'Generated by OpenGRC from checklist state. Update RA/FP/OR/VD fields and comments during formal review.',
      evidenceReferences,
      source: i.frrRequirement ? 'FRR' : 'KSI',
    };
  }

  private poamSeverity(
    status: string,
    dueDate: Date | null,
    impactLevel: 'low' | 'moderate' | 'high',
  ): 'Low' | 'Moderate' | 'High' {
    const now = Date.now();
    const overdue = dueDate ? new Date(dueDate).getTime() < now : false;
    if (status === 'non_compliant' || overdue) return 'High';
    if (impactLevel === 'high' || status === 'in_progress') return 'Moderate';
    return 'Low';
  }

  private estimateDiscoveryDate(
    completionDate: string | null,
    severity: PoamRisk,
  ): string {
    const completion = completionDate ? new Date(`${completionDate}T00:00:00`) : new Date();
    const discovery = new Date(completion);
    if (severity === 'High') discovery.setDate(discovery.getDate() - 30);
    else if (severity === 'Moderate') discovery.setDate(discovery.getDate() - 90);
    else discovery.setDate(discovery.getDate() - 180);
    return discovery.toISOString().slice(0, 10);
  }

  private shiftDate(date: Date | null, days: number): string | null {
    if (!date) return null;
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private csvEscape(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private escapeMd(value: string): string {
    return value.replace(/\|/g, '\\|');
  }

  private buildOscalMetadata(title: string, description: string) {
    const now = new Date().toISOString();
    return {
      title,
      version: '1.0.0',
      'last-modified': now,
      published: now,
      oscalVersion: '1.1.2',
      roles: [
        {
          id: 'fedramp-team',
          title: 'FedRAMP Review Team',
        },
      ],
      parties: [
        {
          uuid: 'opengrc',
          type: 'organization',
          name: 'OpenGRC',
        },
      ],
      remarks: description,
    };
  }

  private buildOscalResources(list: ChecklistItem[]) {
    return list
      .flatMap((item) => item.evidence || [])
      .map((e) => ({
        uuid: e.id,
        title: e.filename || 'Evidence item',
        description: e.sourceConnector || 'Evidence generated by OpenGRC',
        rlinks: [
          {
            href: e.externalUri || '',
            mediaType: 'text/plain',
          },
        ].filter((link) => link.href),
        props: [
          ...(e.checksum ? [{ name: 'checksum', value: e.checksum }] : []),
          ...(e.sourceConnector ? [{ name: 'source-connector', value: e.sourceConnector }] : []),
        ],
      }));
  }
}
