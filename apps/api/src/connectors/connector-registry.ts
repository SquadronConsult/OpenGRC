import { Injectable, OnModuleInit } from '@nestjs/common';
import type { EvidenceConnector } from './connector.types';
import { SyntheticConnector } from './impl/synthetic.connector';
import { GithubConnector } from './impl/github.connector';
import { GitlabConnector } from './impl/gitlab.connector';
import { AwsCloudTrailConnector } from './impl/aws-cloudtrail.connector';
import { AwsConfigConnector } from './impl/aws-config.connector';
import { OktaConnector } from './impl/okta.connector';
import { EntraConnector } from './impl/entra.connector';
import { JiraConnector } from './impl/jira.connector';
import { LinearConnector } from './impl/linear.connector';
import { SlackConnector } from './impl/slack.connector';
import { TeamsConnector } from './impl/teams.connector';

@Injectable()
export class ConnectorRegistry implements OnModuleInit {
  private readonly map = new Map<string, EvidenceConnector>();

  constructor(
    private readonly synthetic: SyntheticConnector,
    private readonly github: GithubConnector,
    private readonly gitlab: GitlabConnector,
    private readonly awsTrail: AwsCloudTrailConnector,
    private readonly awsConfig: AwsConfigConnector,
    private readonly okta: OktaConnector,
    private readonly entra: EntraConnector,
    private readonly jira: JiraConnector,
    private readonly linear: LinearConnector,
    private readonly slack: SlackConnector,
    private readonly teams: TeamsConnector,
  ) {}

  onModuleInit() {
    for (const c of [
      this.synthetic,
      this.github,
      this.gitlab,
      this.awsTrail,
      this.awsConfig,
      this.okta,
      this.entra,
      this.jira,
      this.linear,
      this.slack,
      this.teams,
    ]) {
      this.map.set(c.id, c);
    }
  }

  get(id: string): EvidenceConnector | undefined {
    return this.map.get(id);
  }

  listMeta() {
    return [...this.map.values()].map((c) => ({ id: c.id, version: c.version }));
  }
}
