import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

export interface ParsedFrmr {
  info: { version: string; last_updated: string };
  frdTerms: Array<{
    stableId: string;
    term: string;
    alts: string[];
    definition: string;
    updated: unknown[];
  }>;
  frrRequirements: Array<{
    processId: string;
    layer: 'both' | '20x' | 'rev5';
    actorLabel: string;
    reqKey: string;
    name?: string;
    statement: string;
    primaryKeyWord?: string;
    affects?: string[];
    terms?: string[];
    timeframeType?: string;
    timeframeNum?: number;
    impactLevel?: string;
    raw: Record<string, unknown>;
  }>;
  ksiIndicators: Array<{
    domainCode: string;
    domainName?: string;
    indicatorId: string;
    name?: string;
    statement: string;
    controls: string[];
    terms: string[];
    raw: Record<string, unknown>;
    isProcessKsi: boolean;
  }>;
  ksiProcessRequirements: Array<{
    domainCode: string;
    indicatorId: string;
    name?: string;
    statement: string;
    primaryKeyWord?: string;
    affects?: string[];
    terms?: string[];
    raw: Record<string, unknown>;
  }>;
  errors: string[];
}

function extractFirstKsiProcessBlock(raw: string): Record<string, unknown> | null {
  const needle = '"KSI": {\n "info":';
  const i = raw.indexOf(needle);
  if (i < 0) return null;
  const start = raw.indexOf('{', i);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < raw.length; j++) {
    const c = raw[j];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\' && inStr) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, j + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

@Injectable()
export class FrmrParserService {
  private readonly log = new Logger(FrmrParserService.name);

  checksum(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  parse(raw: string): ParsedFrmr {
    const errors: string[] = [];
    let doc: Record<string, unknown>;
    try {
      doc = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      errors.push(`JSON parse failed: ${e}`);
      throw e;
    }

    const info = doc.info as { version: string; last_updated: string };
    const frdTerms: ParsedFrmr['frdTerms'] = [];
    const frd = doc.FRD as Record<string, unknown> | undefined;
    const dataBoth = (frd?.data as Record<string, unknown>)?.both as
      | Record<string, Record<string, unknown>>
      | undefined;
    if (dataBoth) {
      for (const [stableId, row] of Object.entries(dataBoth)) {
        if (!row || typeof row !== 'object') continue;
        frdTerms.push({
          stableId,
          term: String(row.term ?? ''),
          alts: Array.isArray(row.alts)
            ? (row.alts as string[])
            : typeof row.alts === 'string'
              ? [row.alts]
              : [],
          definition: String(row.definition ?? ''),
          updated: Array.isArray(row.updated) ? row.updated : [],
        });
      }
    }

    const frrRequirements: ParsedFrmr['frrRequirements'] = [];
    const FRR = doc.FRR as Record<string, unknown> | undefined;
    if (FRR && typeof FRR === 'object') {
      for (const processId of Object.keys(FRR)) {
        const proc = FRR[processId] as Record<string, unknown>;
        if (!proc || typeof proc !== 'object' || !proc.data) continue;
        const pdata = proc.data as Record<string, unknown>;
        for (const layer of ['both', '20x', 'rev5'] as const) {
          const layerObj = pdata[layer] as Record<string, unknown> | undefined;
          if (!layerObj || typeof layerObj !== 'object') continue;
          for (const actorLabel of Object.keys(layerObj)) {
            const bucket = layerObj[actorLabel] as Record<string, unknown>;
            if (!bucket || typeof bucket !== 'object') continue;
            for (const reqKey of Object.keys(bucket)) {
              const val = bucket[reqKey] as Record<string, unknown>;
              if (!val || typeof val !== 'object') continue;
              this.flattenRequirement(
                processId,
                layer,
                actorLabel,
                reqKey,
                val,
                frrRequirements,
              );
            }
          }
        }
      }
    }

    const ksiIndicators: ParsedFrmr['ksiIndicators'] = [];
    const ksiProcessRequirements: ParsedFrmr['ksiProcessRequirements'] = [];
    const KSI = doc.KSI as Record<string, unknown> | undefined;
    if (KSI && typeof KSI === 'object') {
      for (const domainCode of Object.keys(KSI)) {
        const domain = KSI[domainCode] as Record<string, unknown>;
        if (!domain || typeof domain !== 'object') continue;
        if (domain.indicators && typeof domain.indicators === 'object') {
          const name = domain.name as string | undefined;
          const indicators = domain.indicators as Record<string, Record<string, unknown>>;
          for (const indicatorId of Object.keys(indicators)) {
            const ind = indicators[indicatorId];
            if (!ind) continue;
            ksiIndicators.push({
              domainCode,
              domainName: name,
              indicatorId,
              name: ind.name as string | undefined,
              statement: String(ind.statement ?? ind.name ?? ''),
              controls: Array.isArray(ind.controls)
                ? (ind.controls as string[]).map((c) => String(c).toLowerCase())
                : [],
              terms: Array.isArray(ind.terms) ? (ind.terms as string[]) : [],
              raw: ind as Record<string, unknown>,
              isProcessKsi: false,
            });
          }
        }
      }
    }

    const ksiProc = extractFirstKsiProcessBlock(raw);
    if (ksiProc?.data) {
      const data = ksiProc.data as Record<string, unknown>;
      for (const layer of ['both', '20x', 'rev5'] as const) {
        const layerObj = data[layer] as Record<string, unknown> | undefined;
        if (!layerObj) continue;
        for (const actor of Object.keys(layerObj)) {
          const bucket = layerObj[actor] as Record<string, unknown>;
          if (!bucket) continue;
          for (const reqKey of Object.keys(bucket)) {
            const val = bucket[reqKey] as Record<string, unknown>;
            if (!val?.statement && !val?.primary_key_word) continue;
            ksiProcessRequirements.push({
              domainCode: 'KSI',
              indicatorId: reqKey,
              name: val.name as string,
              statement: String(val.statement ?? ''),
              primaryKeyWord: val.primary_key_word as string,
              affects: val.affects as string[],
              terms: val.terms as string[],
              raw: val as Record<string, unknown>,
            });
            ksiIndicators.push({
              domainCode: 'KSI',
              domainName: 'Key Security Indicators (process)',
              indicatorId: reqKey,
              name: val.name as string,
              statement: String(val.statement ?? ''),
              controls: [],
              terms: Array.isArray(val.terms) ? (val.terms as string[]) : [],
              raw: val as Record<string, unknown>,
              isProcessKsi: true,
            });
          }
        }
      }
    }

    return {
      info,
      frdTerms,
      frrRequirements,
      ksiIndicators,
      ksiProcessRequirements,
      errors,
    };
  }

  private flattenRequirement(
    processId: string,
    layer: 'both' | '20x' | 'rev5',
    actorLabel: string,
    reqKey: string,
    val: Record<string, unknown>,
    out: ParsedFrmr['frrRequirements'],
  ) {
    if (val.varies_by_level && typeof val.varies_by_level === 'object') {
      const vb = val.varies_by_level as Record<string, Record<string, unknown>>;
      for (const level of ['low', 'moderate', 'high']) {
        const lv = vb[level];
        if (!lv) continue;
        out.push({
          processId,
          layer,
          actorLabel,
          reqKey: `${reqKey}@${level}`,
          name: val.name as string,
          statement: String(lv.statement ?? val.statement ?? ''),
          primaryKeyWord: (lv.primary_key_word ?? val.primary_key_word) as string,
          affects: val.affects as string[],
          terms: val.terms as string[],
          timeframeType: lv.timeframe_type as string,
          timeframeNum: lv.timeframe_num as number,
          impactLevel: level,
          raw: { ...val, _expanded_level: level },
        });
      }
      return;
    }
    if (!val.statement && !val.primary_key_word && !val.name) return;
    out.push({
      processId,
      layer,
      actorLabel,
      reqKey,
      name: val.name as string,
      statement: String(val.statement ?? ''),
      primaryKeyWord: val.primary_key_word as string,
      affects: val.affects as string[],
      terms: val.terms as string[],
      timeframeType: val.timeframe_type as string,
      timeframeNum: val.timeframe_num as number,
      raw: val as Record<string, unknown>,
    });
  }
}
