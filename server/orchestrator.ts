import { db } from './db';
import { 
  automationRules, automationApprovals, automationAuditLog, runbooks, escalationPolicies,
  type AutomationRule, type InsertAutomationRule,
  type AutomationApproval, type InsertAutomationApproval,
  type AutomationAuditLog, type InsertAutomationAuditLog,
  type Runbook, type InsertRunbook,
  type EscalationPolicy, type InsertEscalationPolicy,
  type Incident
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { sendEmail } from './emailClient';

interface AutomationContext {
  incident: Incident;
  vendor?: { name: string; key: string };
  user?: { id: string; email?: string | null; phone?: string | null };
}

export class OrchestratorEngine {
  async getRunbooks(userId: string): Promise<Runbook[]> {
    return db.select().from(runbooks).where(eq(runbooks.userId, userId)).orderBy(desc(runbooks.createdAt));
  }

  async getRunbook(id: string): Promise<Runbook | undefined> {
    const [runbook] = await db.select().from(runbooks).where(eq(runbooks.id, id));
    return runbook || undefined;
  }

  async createRunbook(data: InsertRunbook): Promise<Runbook> {
    const [runbook] = await db.insert(runbooks).values(data).returning();
    return runbook;
  }

  async updateRunbook(id: string, data: Partial<InsertRunbook>): Promise<Runbook | undefined> {
    const [runbook] = await db.update(runbooks).set({ ...data, updatedAt: new Date() }).where(eq(runbooks.id, id)).returning();
    return runbook || undefined;
  }

  async deleteRunbook(id: string): Promise<boolean> {
    const result = await db.delete(runbooks).where(eq(runbooks.id, id)).returning();
    return result.length > 0;
  }

  async getEscalationPolicies(userId: string): Promise<EscalationPolicy[]> {
    return db.select().from(escalationPolicies).where(eq(escalationPolicies.userId, userId)).orderBy(desc(escalationPolicies.createdAt));
  }

  async createEscalationPolicy(data: InsertEscalationPolicy): Promise<EscalationPolicy> {
    const [policy] = await db.insert(escalationPolicies).values(data).returning();
    return policy;
  }

  async deleteEscalationPolicy(id: string): Promise<boolean> {
    const result = await db.delete(escalationPolicies).where(eq(escalationPolicies.id, id)).returning();
    return result.length > 0;
  }

  async getAutomationRules(userId: string): Promise<AutomationRule[]> {
    return db.select().from(automationRules).where(eq(automationRules.userId, userId)).orderBy(desc(automationRules.createdAt));
  }

  async getAutomationRule(id: string): Promise<AutomationRule | undefined> {
    const [rule] = await db.select().from(automationRules).where(eq(automationRules.id, id));
    return rule || undefined;
  }

  async createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule> {
    const [rule] = await db.insert(automationRules).values(data).returning();
    return rule;
  }

  async updateAutomationRule(id: string, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined> {
    const [rule] = await db.update(automationRules).set(data).where(eq(automationRules.id, id)).returning();
    return rule || undefined;
  }

  async deleteAutomationRule(id: string): Promise<boolean> {
    const result = await db.delete(automationRules).where(eq(automationRules.id, id)).returning();
    return result.length > 0;
  }

  async getPendingApprovals(userId: string): Promise<AutomationApproval[]> {
    return db.select().from(automationApprovals)
      .where(and(eq(automationApprovals.userId, userId), eq(automationApprovals.status, 'pending')))
      .orderBy(desc(automationApprovals.createdAt));
  }

  async approveAutomation(approvalId: string, approvedBy: string): Promise<AutomationApproval | undefined> {
    const [approval] = await db.update(automationApprovals)
      .set({ status: 'approved', approvedBy, approvedAt: new Date() })
      .where(eq(automationApprovals.id, approvalId))
      .returning();
    
    if (approval) {
      const payload = JSON.parse(approval.actionPayload);
      await this.executeAction(approval.actionType, payload, approval.ruleId, approval.incidentId, approvedBy);
    }
    
    return approval || undefined;
  }

  async rejectAutomation(approvalId: string, rejectedBy: string): Promise<AutomationApproval | undefined> {
    const [approval] = await db.update(automationApprovals)
      .set({ status: 'rejected', approvedBy: rejectedBy, approvedAt: new Date() })
      .where(eq(automationApprovals.id, approvalId))
      .returning();
    
    await this.logAction(approval?.ruleId || null, approval?.incidentId || null, rejectedBy, approval?.actionType || 'unknown', null, 'rejected', null, 0);
    
    return approval || undefined;
  }

  async getAuditLog(userId?: string, limit: number = 50): Promise<AutomationAuditLog[]> {
    if (userId) {
      return db.select().from(automationAuditLog)
        .where(eq(automationAuditLog.userId, userId))
        .orderBy(desc(automationAuditLog.createdAt))
        .limit(limit);
    }
    return db.select().from(automationAuditLog).orderBy(desc(automationAuditLog.createdAt)).limit(limit);
  }

  async logAction(
    ruleId: string | null,
    incidentId: string | null,
    userId: string | null,
    actionType: string,
    payload: any,
    result: string,
    errorMessage: string | null,
    executionTimeMs: number
  ): Promise<void> {
    await db.insert(automationAuditLog).values({
      ruleId,
      incidentId,
      userId,
      actionType,
      actionPayload: payload ? JSON.stringify(payload) : null,
      result,
      errorMessage,
      executionTimeMs,
    });
  }

  async processIncident(incident: Incident, eventType: string): Promise<void> {
    const activeRules = await db.select().from(automationRules)
      .where(and(eq(automationRules.isActive, true), eq(automationRules.triggerType, eventType)));
    
    for (const rule of activeRules) {
      const conditions = JSON.parse(rule.conditions);
      
      if (!this.matchesConditions(incident, conditions)) continue;
      
      const actionConfig = JSON.parse(rule.actionConfig);
      
      if (rule.requiresApproval) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        
        await db.insert(automationApprovals).values({
          ruleId: rule.id,
          incidentId: incident.id,
          userId: rule.userId,
          actionType: rule.actionType,
          actionPayload: JSON.stringify({ ...actionConfig, incident }),
          status: 'pending',
          expiresAt,
        });
        
        await this.logAction(rule.id, incident.id, rule.userId, rule.actionType, actionConfig, 'pending_approval', null, 0);
      } else {
        await this.executeAction(rule.actionType, { ...actionConfig, incident }, rule.id, incident.id, rule.userId);
      }
      
      await db.update(automationRules)
        .set({ executionCount: rule.executionCount + 1, lastExecutedAt: new Date() })
        .where(eq(automationRules.id, rule.id));
    }
  }

  private matchesConditions(incident: Incident, conditions: any): boolean {
    if (conditions.severity && !conditions.severity.includes(incident.severity)) {
      return false;
    }
    if (conditions.vendors && conditions.vendors.length > 0 && !conditions.vendors.includes(incident.vendorKey)) {
      return false;
    }
    return true;
  }

  private async executeAction(
    actionType: string,
    config: any,
    ruleId: string,
    incidentId: string,
    userId: string
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      switch (actionType) {
        case 'create_ticket':
          await this.createPsaTicket(config);
          break;
        case 'send_slack':
          await this.sendSlackMessage(config);
          break;
        case 'send_teams':
          await this.sendTeamsMessage(config);
          break;
        case 'call_escalation':
          await this.triggerEscalation(config);
          break;
        case 'send_email':
          await this.sendEmailAction(config);
          break;
        case 'webhook':
          await this.callWebhook(config);
          break;
        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
      
      await this.logAction(ruleId, incidentId, userId, actionType, config, 'success', null, Date.now() - startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logAction(ruleId, incidentId, userId, actionType, config, 'failed', errorMessage, Date.now() - startTime);
      console.error(`[orchestrator] Action ${actionType} failed:`, error);
    }
  }

  private async createPsaTicket(config: any): Promise<void> {
    const { incident, webhookUrl, ticketData } = config;
    
    const payload = {
      type: 'incident_ticket',
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        vendor: incident.vendorKey,
        status: incident.status,
        startedAt: incident.startedAt,
      },
      ticketData: {
        summary: `[${incident.severity.toUpperCase()}] ${incident.vendorKey} - ${incident.title}`,
        description: incident.impact || incident.title,
        priority: incident.severity === 'critical' ? 1 : incident.severity === 'major' ? 2 : 3,
        ...ticketData,
      },
    };
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    
    console.log('[orchestrator] Created PSA ticket for incident:', incident.id);
  }

  private async sendSlackMessage(config: any): Promise<void> {
    const { incident, webhookUrl, channel } = config;
    
    const severityEmoji = incident.severity === 'critical' ? '🔴' : incident.severity === 'major' ? '🟠' : '🟡';
    
    const payload = {
      channel,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${severityEmoji} ${incident.vendorKey.toUpperCase()} Incident` },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Title:*\n${incident.title}` },
            { type: 'mrkdwn', text: `*Severity:*\n${incident.severity}` },
            { type: 'mrkdwn', text: `*Status:*\n${incident.status}` },
            { type: 'mrkdwn', text: `*Started:*\n${incident.startedAt}` },
          ],
        },
      ],
    };
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    
    console.log('[orchestrator] Sent Slack message for incident:', incident.id);
  }

  private async sendTeamsMessage(config: any): Promise<void> {
    const { incident, webhookUrl } = config;
    
    const payload = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      themeColor: incident.severity === 'critical' ? 'FF0000' : incident.severity === 'major' ? 'FFA500' : 'FFFF00',
      summary: `${incident.vendorKey} Incident: ${incident.title}`,
      sections: [{
        activityTitle: `${incident.vendorKey.toUpperCase()} Incident`,
        facts: [
          { name: 'Title', value: incident.title },
          { name: 'Severity', value: incident.severity },
          { name: 'Status', value: incident.status },
          { name: 'Started', value: incident.startedAt },
        ],
        markdown: true,
      }],
    };
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    
    console.log('[orchestrator] Sent Teams message for incident:', incident.id);
  }

  private async triggerEscalation(config: any): Promise<void> {
    const { incident, escalationPolicyId } = config;
    
    if (!escalationPolicyId) {
      console.log('[orchestrator] No escalation policy configured, skipping escalation');
      return;
    }
    
    const [policy] = await db.select().from(escalationPolicies).where(eq(escalationPolicies.id, escalationPolicyId));
    if (!policy) {
      console.log('[orchestrator] Escalation policy not found:', escalationPolicyId);
      return;
    }
    
    let levels: any[] = [];
    try {
      levels = JSON.parse(policy.levels);
    } catch (e) {
      console.error('[orchestrator] Failed to parse escalation levels:', e);
      return;
    }
    
    if (levels.length > 0) {
      const firstLevel = levels[0];
      const contacts = firstLevel.contacts || [];
      let contactsNotified = 0;
      
      for (const contact of contacts) {
        if (contact.phone) {
          try {
            const message = `CRITICAL: ${incident.vendorKey} ${incident.title}. Status: ${incident.status}. Requires immediate attention.`;
            await sendSMS(contact.phone, message);
            contactsNotified++;
          } catch (smsError) {
            console.error('[orchestrator] Failed to send escalation SMS to', contact.phone, smsError);
          }
        } else {
          console.log('[orchestrator] Contact missing phone number, skipping SMS');
        }
      }
      
      console.log(`[orchestrator] Escalation triggered for incident ${incident.id}: ${contactsNotified}/${contacts.length} contacts notified`);
    } else {
      console.log('[orchestrator] No escalation levels configured');
    }
  }

  private async sendEmailAction(config: any): Promise<void> {
    const { incident, email, template } = config;
    
    if (!email) {
      console.log('[orchestrator] No email address configured, skipping email action');
      return;
    }
    
    const subject = `[${incident.severity.toUpperCase()}] ${incident.vendorKey} Incident: ${incident.title}`;
    const html = `
      <h2>${incident.vendorKey} Service Incident</h2>
      <p><strong>Title:</strong> ${incident.title}</p>
      <p><strong>Severity:</strong> ${incident.severity}</p>
      <p><strong>Status:</strong> ${incident.status}</p>
      <p><strong>Started:</strong> ${incident.startedAt}</p>
      <p><strong>Impact:</strong> ${incident.impact || 'Not specified'}</p>
    `;
    
    try {
      await sendEmail(email, subject, html);
      console.log('[orchestrator] Sent email for incident:', incident.id);
    } catch (emailError) {
      console.error('[orchestrator] Failed to send email to', email, emailError);
    }
  }

  private async callWebhook(config: any): Promise<void> {
    const { incident, webhookUrl, headers } = config;
    
    const payload = {
      event: 'incident_automation',
      timestamp: new Date().toISOString(),
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        vendor: incident.vendorKey,
        status: incident.status,
        startedAt: incident.startedAt,
        impact: incident.impact,
      },
    };
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      });
    }
    
    console.log('[orchestrator] Called webhook for incident:', incident.id);
  }
}

export const orchestrator = new OrchestratorEngine();
