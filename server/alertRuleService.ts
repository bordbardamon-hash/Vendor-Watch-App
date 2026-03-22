/**
 * Alert Rule Evaluation Engine
 * - Evaluates all active rules every 2 minutes
 * - Fires actions when all conditions pass AND cooldown has elapsed
 * - Logs every evaluation run
 */

import { db } from './db';
import {
  alertRules, alertConditions, alertActions, alertRuleLogs,
  vendors, incidents, blockchainChains,
  vendorScores,
} from '@shared/schema';
import { eq, and, ne, gte } from 'drizzle-orm';
import { sendEmail } from './emailClient';
import { sendSMS } from './twilioClient';

// ── Condition evaluation ──────────────────────────────────────────────

interface ConditionResult {
  type: string;
  passed: boolean;
  reason: string;
}

async function evalCondition(
  condType: string,
  params: Record<string, any>,
  ctx: EvalContext,
): Promise<ConditionResult> {
  const fail = (reason: string): ConditionResult => ({ type: condType, passed: false, reason });
  const pass = (reason: string): ConditionResult => ({ type: condType, passed: true, reason });

  switch (condType) {
    case 'vendor_status': {
      const v = ctx.vendorMap.get(params.vendorKey);
      if (!v) return fail(`Vendor '${params.vendorKey}' not found`);
      const matches = v.status === params.status ||
        (params.status === 'outage' && (v.status === 'major_outage' || v.status === 'outage')) ||
        (params.status === 'degraded' && (v.status === 'degraded' || v.status === 'degraded_performance' || v.status === 'partial_outage'));
      return matches
        ? pass(`${v.name} is ${v.status}`)
        : fail(`${v.name} is ${v.status}, expected ${params.status}`);
    }

    case 'vendor_incident_severity': {
      const sevMap: Record<string, string[]> = {
        critical: ['critical'],
        major: ['major', 'critical'],
        minor: ['minor', 'major', 'critical'],
      };
      const allowed = sevMap[params.severity] || [params.severity];
      const active = ctx.activeIncidents.filter(
        i => i.vendorKey === params.vendorKey && allowed.includes(i.severity)
      );
      const vName = ctx.vendorMap.get(params.vendorKey)?.name || params.vendorKey;
      return active.length > 0
        ? pass(`${vName} has ${active.length} active ${params.severity}+ incident(s)`)
        : fail(`${vName} has no active ${params.severity}+ incidents`);
    }

    case 'vendor_incident_count': {
      const days = params.days || 30;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const rows = await db.select({ id: incidents.id }).from(incidents).where(
        and(
          eq(incidents.vendorKey, params.vendorKey),
          gte(incidents.createdAt, cutoff),
        )
      );
      const vName = ctx.vendorMap.get(params.vendorKey)?.name || params.vendorKey;
      return rows.length >= params.count
        ? pass(`${vName} had ${rows.length} incidents in last ${days} days (threshold: ${params.count})`)
        : fail(`${vName} had ${rows.length} incidents in last ${days} days (threshold: ${params.count})`);
    }

    case 'multi_vendor_and_degraded': {
      const keys: string[] = params.vendorKeys || [];
      const allDegraded = keys.every(k => {
        const v = ctx.vendorMap.get(k);
        return v && (v.status !== 'operational' && v.status !== 'unknown');
      });
      const names = keys.map(k => ctx.vendorMap.get(k)?.name || k).join(' AND ');
      return allDegraded
        ? pass(`${names} are all degraded/outage simultaneously`)
        : fail(`Not all of ${names} are degraded simultaneously`);
    }

    case 'watchlist_outage': {
      const degraded = ctx.activeIncidents.filter(i => i.severity === 'critical' || i.severity === 'major');
      return degraded.length > 0
        ? pass(`${degraded.length} vendor(s) have active critical/major incidents`)
        : fail('No vendors have active critical/major incidents');
    }

    case 'chain_block_time_exceeds': {
      const c = ctx.chainMap.get(params.chainKey);
      if (!c) return fail(`Chain '${params.chainKey}' not found`);
      if (!c.avgBlockTime) return fail(`${c.name} has no block time data`);
      return c.avgBlockTime > params.seconds
        ? pass(`${c.name} block time ${c.avgBlockTime}s > ${params.seconds}s`)
        : fail(`${c.name} block time ${c.avgBlockTime}s ≤ ${params.seconds}s`);
    }

    case 'chain_no_new_blocks': {
      const c = ctx.chainMap.get(params.chainKey);
      if (!c) return fail(`Chain '${params.chainKey}' not found`);
      if (!c.lastBlockTime) return fail(`${c.name} has no lastBlockTime data`);
      const staleMs = params.minutes * 60 * 1000;
      const elapsed = Date.now() - new Date(c.lastBlockTime).getTime();
      return elapsed > staleMs
        ? pass(`${c.name} last block ${Math.round(elapsed / 60000)}min ago (threshold: ${params.minutes}min)`)
        : fail(`${c.name} last block ${Math.round(elapsed / 60000)}min ago (threshold: ${params.minutes}min)`);
    }

    case 'incident_active_duration': {
      const threshold = params.minutes * 60 * 1000;
      const vendorKey = params.vendorKey;
      const relevant = vendorKey
        ? ctx.activeIncidents.filter(i => i.vendorKey === vendorKey)
        : ctx.activeIncidents;
      const old = relevant.filter(i => {
        const started = new Date(i.startedAt).getTime();
        return Date.now() - started > threshold;
      });
      return old.length > 0
        ? pass(`${old.length} incident(s) active for more than ${params.minutes} minutes`)
        : fail(`No incidents active longer than ${params.minutes} minutes`);
    }

    case 'business_hours': {
      const tz = params.timezone || 'UTC';
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hour: 'numeric', hour12: false,
      });
      const hour = parseInt(formatter.format(now));
      const inHours = hour >= 9 && hour < 18;
      return inHours
        ? pass(`Current time (${tz}) is ${hour}:00, within business hours`)
        : fail(`Current time (${tz}) is ${hour}:00, outside business hours`);
    }

    case 'day_of_week': {
      const day = new Date().getDay(); // 0=Sun, 6=Sat
      const isWeekend = day === 0 || day === 6;
      if (params.days === 'weekends') {
        return isWeekend ? pass('Today is a weekend') : fail('Today is a weekday');
      } else if (params.days === 'weekdays') {
        return !isWeekend ? pass('Today is a weekday') : fail('Today is a weekend');
      }
      return pass('Day condition passes (all)');
    }

    case 'reliability_score_below': {
      const score = ctx.scoreMap.get(params.vendorKey);
      const vName = ctx.vendorMap.get(params.vendorKey)?.name || params.vendorKey;
      if (score === undefined) return fail(`No reliability score for ${vName}`);
      return score < params.score
        ? pass(`${vName} reliability score ${score} < ${params.score}`)
        : fail(`${vName} reliability score ${score} ≥ ${params.score}`);
    }

    default:
      return fail(`Unknown condition type: ${condType}`);
  }
}

// ── Context object built once per evaluation cycle ────────────────────

interface ActiveIncident {
  vendorKey: string; severity: string; startedAt: string; status: string; title: string;
}

interface EvalContext {
  vendorMap: Map<string, { name: string; status: string }>;
  chainMap: Map<string, { name: string; status: string; avgBlockTime: number | null; lastBlockTime: Date | null }>;
  scoreMap: Map<string, number>;
  activeIncidents: ActiveIncident[];
}

async function buildEvalContext(): Promise<EvalContext> {
  const [allVendors, allChains, allScores, allActiveInc] = await Promise.all([
    db.select({ key: vendors.key, name: vendors.name, status: vendors.status }).from(vendors),
    db.select({ key: blockchainChains.key, name: blockchainChains.name, status: blockchainChains.status, avgBlockTime: blockchainChains.avgBlockTime, lastBlockTime: blockchainChains.lastBlockTime }).from(blockchainChains),
    db.select({ vendorKey: vendorScores.vendorKey, score: vendorScores.score }).from(vendorScores),
    db.select({
      vendorKey: incidents.vendorKey, severity: incidents.severity,
      startedAt: incidents.startedAt, status: incidents.status, title: incidents.title,
    }).from(incidents).where(and(ne(incidents.status, 'resolved'), ne(incidents.status, 'postmortem'))),
  ]);

  return {
    vendorMap: new Map(allVendors.map(v => [v.key, { name: v.name, status: v.status }])),
    chainMap: new Map(allChains.map(c => [c.key, { name: c.name, status: c.status, avgBlockTime: c.avgBlockTime, lastBlockTime: c.lastBlockTime }])),
    scoreMap: new Map(allScores.map(s => [s.vendorKey, s.score])),
    activeIncidents: allActiveInc,
  };
}

// ── Action execution ──────────────────────────────────────────────────

async function executeAction(
  actionType: string,
  params: Record<string, any>,
  rule: typeof alertRules.$inferSelect,
  condResults: ConditionResult[],
): Promise<{ type: string; success: boolean; error?: string }> {
  const passedConditions = condResults.filter(r => r.passed).map(r => r.reason).join('; ');
  const subject = `🚨 VendorWatch Alert: ${rule.name}`;
  const body = `Your alert rule "${rule.name}" has fired.\n\nConditions matched:\n${passedConditions}\n\nManage your alerts at vendorwatch.app/settings/alert-rules`;
  const htmlBody = `<p>Your alert rule <strong>${rule.name}</strong> has fired.</p><p><strong>Conditions matched:</strong><br>${passedConditions.replace(/;/g, '<br>')}</p><p><a href="https://vendorwatch.app/settings/alert-rules">Manage your alerts</a></p>`;

  try {
    switch (actionType) {
      case 'email': {
        if (!params.address) throw new Error('Missing email address');
        await sendEmail(params.address, subject, htmlBody, body);
        return { type: 'email', success: true };
      }

      case 'sms': {
        if (!params.phone) throw new Error('Missing phone number');
        const smsText = `VendorWatch Alert: ${rule.name}\n${passedConditions.slice(0, 140)}`;
        await sendSMS(params.phone, smsText);
        return { type: 'sms', success: true };
      }

      case 'slack': {
        if (!params.webhookUrl) throw new Error('Missing Slack webhook URL');
        const payload = {
          text: `🚨 *VendorWatch Alert: ${rule.name}*\n${passedConditions}`,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: `🚨 ${rule.name}` } },
            { type: 'section', text: { type: 'mrkdwn', text: `*Conditions matched:*\n${passedConditions}` } },
          ],
        };
        const res = await fetch(params.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
        return { type: 'slack', success: true };
      }

      case 'webhook': {
        if (!params.url) throw new Error('Missing webhook URL');
        const template = params.payload || '{"rule":"{{rule_name}}","conditions":"{{conditions}}","fired_at":"{{fired_at}}"}';
        const rendered = template
          .replace(/\{\{rule_name\}\}/g, rule.name)
          .replace(/\{\{conditions\}\}/g, passedConditions)
          .replace(/\{\{fired_at\}\}/g, new Date().toISOString());
        const res = await fetch(params.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rendered,
        });
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
        return { type: 'webhook', success: true };
      }

      case 'log':
      default:
        console.log(`[alert-rules] Rule "${rule.name}" fired. Conditions: ${passedConditions}`);
        return { type: 'log', success: true };
    }
  } catch (err: any) {
    return { type: actionType, success: false, error: err.message };
  }
}

// ── Main evaluation loop ──────────────────────────────────────────────

export async function evaluateAllRules(): Promise<void> {
  const activeRules = await db.select().from(alertRules).where(eq(alertRules.status, 'active'));
  if (activeRules.length === 0) return;

  const ctx = await buildEvalContext();

  for (const rule of activeRules) {
    try {
      // Check cooldown
      if (rule.lastFiredAt) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (Date.now() - new Date(rule.lastFiredAt).getTime() < cooldownMs) {
          continue; // still in cooldown, skip
        }
      }

      const conditions = await db.select().from(alertConditions)
        .where(eq(alertConditions.ruleId, rule.id))
        .orderBy(alertConditions.position);

      const actions = await db.select().from(alertActions)
        .where(eq(alertActions.ruleId, rule.id))
        .orderBy(alertActions.position);

      // Evaluate all conditions
      const results: ConditionResult[] = await Promise.all(
        conditions.map(c => evalCondition(c.conditionType, JSON.parse(c.params || '{}'), ctx))
      );

      const allPassed = results.length > 0 && results.every(r => r.passed);

      if (allPassed) {
        // Fire all actions
        const actionResults = await Promise.all(
          actions.map(a => executeAction(a.actionType, JSON.parse(a.params || '{}'), rule, results))
        );

        // Update lastFiredAt
        await db.update(alertRules)
          .set({ lastFiredAt: new Date(), updatedAt: new Date() })
          .where(eq(alertRules.id, rule.id));

        // Log
        await db.insert(alertRuleLogs).values({
          ruleId: rule.id,
          fired: true,
          conditionsResult: JSON.stringify(results),
          actionsTriggered: JSON.stringify(actionResults),
        });
      } else {
        // Log non-fire
        await db.insert(alertRuleLogs).values({
          ruleId: rule.id,
          fired: false,
          conditionsResult: JSON.stringify(results),
          actionsTriggered: '[]',
        });
      }
    } catch (err: any) {
      console.error(`[alert-rules] Error evaluating rule "${rule.name}":`, err);
      await db.insert(alertRuleLogs).values({
        ruleId: rule.id,
        fired: false,
        conditionsResult: '[]',
        actionsTriggered: '[]',
        error: err.message,
      }).catch(() => {});
    }
  }
}

// ── Test fire (manual trigger) ────────────────────────────────────────

export async function testFireRule(ruleId: string): Promise<{ success: boolean; results: any[] }> {
  const [rule] = await db.select().from(alertRules).where(eq(alertRules.id, ruleId)).limit(1);
  if (!rule) throw new Error('Rule not found');

  const actions = await db.select().from(alertActions)
    .where(eq(alertActions.ruleId, ruleId))
    .orderBy(alertActions.position);

  const testConditions: ConditionResult[] = [{ type: 'test', passed: true, reason: 'Manual test fire triggered' }];

  const results = await Promise.all(
    actions.map(a => executeAction(a.actionType, JSON.parse(a.params || '{}'), rule, testConditions))
  );

  await db.insert(alertRuleLogs).values({
    ruleId,
    fired: true,
    conditionsResult: JSON.stringify(testConditions),
    actionsTriggered: JSON.stringify([...results, { type: 'test', success: true }]),
  });

  return { success: results.every(r => r.success), results };
}

// ── Full rule with conditions and actions (for API) ───────────────────

export async function getRuleWithDetails(ruleId: string) {
  const [rule] = await db.select().from(alertRules).where(eq(alertRules.id, ruleId)).limit(1);
  if (!rule) return null;
  const [conditions, actions] = await Promise.all([
    db.select().from(alertConditions).where(eq(alertConditions.ruleId, ruleId)).orderBy(alertConditions.position),
    db.select().from(alertActions).where(eq(alertActions.ruleId, ruleId)).orderBy(alertActions.position),
  ]);
  return { ...rule, conditions, actions };
}
