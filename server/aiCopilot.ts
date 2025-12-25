import OpenAI from 'openai';
import { db } from './db';
import { incidents, vendors, incidentArchive, blockchainIncidents, blockchainChains } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface CopilotOptions {
  audience: 'technical' | 'executive' | 'client';
  tone: 'formal' | 'casual' | 'urgent';
  includeNextSteps: boolean;
}

export async function generateIncidentUpdate(
  incidentId: string,
  options: CopilotOptions = { audience: 'client', tone: 'formal', includeNextSteps: true }
): Promise<{ subject: string; body: string; summary: string }> {
  const allIncidents = await db.select().from(incidents);
  const incident = allIncidents.find(i => i.id === incidentId);
  
  if (!incident) {
    throw new Error('Incident not found');
  }
  
  const allVendors = await db.select().from(vendors);
  const vendor = allVendors.find(v => v.key === incident.vendorKey);
  const vendorName = vendor?.name || incident.vendorKey;
  
  const historicalIncidents = allIncidents
    .filter(i => i.vendorKey === incident.vendorKey && i.id !== incident.id)
    .slice(0, 5);
  
  const audienceContext = {
    technical: 'Include technical details, affected systems, and root cause analysis if available.',
    executive: 'Focus on business impact, timeline, and high-level status. Avoid technical jargon.',
    client: 'Be reassuring and professional. Focus on what the client needs to know and what actions they should take.',
  };
  
  const toneContext = {
    formal: 'Use professional, formal language.',
    casual: 'Use friendly, approachable language.',
    urgent: 'Convey urgency and importance. Be direct and action-oriented.',
  };
  
  const prompt = `You are an experienced IT service manager writing an incident update communication.

Incident Details:
- Vendor: ${vendorName}
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Impact: ${incident.impact || 'Not specified'}
- Started: ${incident.startedAt}
- Last Updated: ${incident.updatedAt}

Historical context: This vendor has had ${historicalIncidents.length} other incidents recently.

Writing requirements:
- Audience: ${options.audience} - ${audienceContext[options.audience]}
- Tone: ${options.tone} - ${toneContext[options.tone]}
- ${options.includeNextSteps ? 'Include recommended next steps for the recipient.' : 'Do not include next steps.'}

Generate a professional incident update with:
1. A subject line (prefixed with severity indicator)
2. A body suitable for email/message
3. A 1-2 sentence summary

Format your response as JSON with keys: subject, body, summary`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    let result: { subject?: string; body?: string; summary?: string };
    
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Copilot] Failed to parse OpenAI response:', parseError);
      result = {};
    }
    
    return {
      subject: typeof result.subject === 'string' ? result.subject : `[${incident.severity.toUpperCase()}] ${vendorName} Incident Update`,
      body: typeof result.body === 'string' ? result.body : 'Unable to generate update. Please try again.',
      summary: typeof result.summary === 'string' ? result.summary : 'Incident update generated.',
    };
  } catch (error) {
    console.error('[AI Copilot] OpenAI API error:', error);
    return {
      subject: `[${incident.severity.toUpperCase()}] ${vendorName} Incident Update`,
      body: 'Unable to generate AI-powered update at this time. Please try again later.',
      summary: 'AI generation temporarily unavailable.',
    };
  }
}

export async function suggestRootCause(incidentId: string): Promise<{
  likelyCauses: string[];
  confidence: string;
  recommendation: string;
  historicalPattern: string | null;
}> {
  const allIncidents = await db.select().from(incidents);
  const incident = allIncidents.find(i => i.id === incidentId);
  
  if (!incident) {
    throw new Error('Incident not found');
  }
  
  const allVendors = await db.select().from(vendors);
  const vendor = allVendors.find(v => v.key === incident.vendorKey);
  const vendorName = vendor?.name || incident.vendorKey;
  
  const historicalIncidents = allIncidents
    .filter(i => i.vendorKey === incident.vendorKey && i.status === 'resolved')
    .slice(0, 10);
  
  const archivedIncidents = await db.select().from(incidentArchive)
    .where(eq(incidentArchive.vendorKey, incident.vendorKey))
    .orderBy(desc(incidentArchive.archivedAt))
    .limit(20);
  
  const historicalContext = [...historicalIncidents, ...archivedIncidents]
    .map(i => `- ${i.title} (${i.severity})`)
    .join('\n');
  
  const prompt = `You are a senior site reliability engineer analyzing a service incident.

Current Incident:
- Vendor: ${vendorName}
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Impact: ${incident.impact || 'Not specified'}
- Started: ${incident.startedAt}

Historical incidents for this vendor:
${historicalContext || 'No historical data available.'}

Based on the incident title, impact description, and historical patterns, analyze:
1. What are the most likely root causes? (list 2-3 possibilities)
2. What is your confidence level in this analysis? (high/medium/low)
3. What immediate action do you recommend?
4. Is there a pattern with historical incidents?

Format your response as JSON with keys: likelyCauses (array), confidence (string), recommendation (string), historicalPattern (string or null)`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    let result: { likelyCauses?: string[]; confidence?: string; recommendation?: string; historicalPattern?: string | null };
    
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Copilot] Failed to parse root cause response:', parseError);
      result = {};
    }
    
    return {
      likelyCauses: Array.isArray(result.likelyCauses) ? result.likelyCauses : ['Unable to determine'],
      confidence: typeof result.confidence === 'string' ? result.confidence : 'low',
      recommendation: typeof result.recommendation === 'string' ? result.recommendation : 'Monitor the situation.',
      historicalPattern: typeof result.historicalPattern === 'string' ? result.historicalPattern : null,
    };
  } catch (error) {
    console.error('[AI Copilot] OpenAI API error in root cause analysis:', error);
    return {
      likelyCauses: ['Unable to determine - AI service temporarily unavailable'],
      confidence: 'low',
      recommendation: 'Monitor the situation and try again later.',
      historicalPattern: null,
    };
  }
}

export async function generateClientPersona(
  incidentId: string,
  clientType: 'enterprise' | 'smb' | 'startup'
): Promise<{ greeting: string; update: string; closing: string }> {
  const allIncidents = await db.select().from(incidents);
  const incident = allIncidents.find(i => i.id === incidentId);
  
  if (!incident) {
    throw new Error('Incident not found');
  }
  
  const allVendors = await db.select().from(vendors);
  const vendor = allVendors.find(v => v.key === incident.vendorKey);
  const vendorName = vendor?.name || incident.vendorKey;
  
  const clientContext = {
    enterprise: 'Large enterprise client with formal communication expectations. They have dedicated account managers and SLAs.',
    smb: 'Small-to-medium business client who values direct, practical communication. They need actionable information quickly.',
    startup: 'Startup client who prefers casual, transparent communication. They appreciate honesty and quick updates.',
  };
  
  const prompt = `You are an MSP account manager crafting a personalized incident update.

Incident Details:
- Vendor: ${vendorName}
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Impact: ${incident.impact || 'Not specified'}

Client Type: ${clientType} - ${clientContext[clientType]}

Generate a personalized update with:
1. An appropriate greeting for this client type
2. The incident update tailored to their communication style
3. A professional closing

Format your response as JSON with keys: greeting, update, closing`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    let result: { greeting?: string; update?: string; closing?: string };
    
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Copilot] Failed to parse client persona response:', parseError);
      result = {};
    }
    
    return {
      greeting: typeof result.greeting === 'string' ? result.greeting : 'Hello,',
      update: typeof result.update === 'string' ? result.update : 'Unable to generate update.',
      closing: typeof result.closing === 'string' ? result.closing : 'Best regards,\nYour IT Team',
    };
  } catch (error) {
    console.error('[AI Copilot] OpenAI API error in client persona generation:', error);
    return {
      greeting: 'Hello,',
      update: 'Unable to generate AI-powered update at this time. Please try again later.',
      closing: 'Best regards,\nYour IT Team',
    };
  }
}

// ============ BLOCKCHAIN-SPECIFIC AI COPILOT FUNCTIONS ============

export async function generateBlockchainIncidentUpdate(
  incidentId: string,
  options: CopilotOptions = { audience: 'client', tone: 'formal', includeNextSteps: true }
): Promise<{ subject: string; body: string; summary: string }> {
  const allIncidents = await db.select().from(blockchainIncidents);
  const incident = allIncidents.find(i => i.id === incidentId);
  
  if (!incident) {
    throw new Error('Blockchain incident not found');
  }
  
  const allChains = await db.select().from(blockchainChains);
  const chain = allChains.find(c => c.key === incident.chainKey);
  const chainName = chain?.name || incident.chainKey;
  
  const historicalIncidents = allIncidents
    .filter(i => i.chainKey === incident.chainKey && i.id !== incident.id)
    .slice(0, 5);
  
  const audienceContext = {
    technical: 'Include technical blockchain details, affected services, RPC endpoints, and any on-chain implications.',
    executive: 'Focus on business impact, affected operations, and high-level status. Avoid blockchain-specific jargon.',
    client: 'Be reassuring and explain in simple terms. Focus on what services are affected and when they will be restored.',
  };
  
  const toneContext = {
    formal: 'Use professional, formal language.',
    casual: 'Use friendly, approachable language.',
    urgent: 'Convey urgency and importance. Be direct and action-oriented.',
  };
  
  const prompt = `You are an experienced blockchain infrastructure manager writing an incident update communication.

Blockchain Incident Details:
- Chain/Platform: ${chainName}
- Title: ${incident.title}
- Severity: ${incident.severity}
- Status: ${incident.status}
- Type: ${incident.incidentType}
- Description: ${incident.description || 'Not specified'}
- Started: ${incident.startedAt}
- Last Updated: ${incident.updatedAt}

Historical context: This chain/platform has had ${historicalIncidents.length} other incidents recently.

Writing requirements:
- Audience: ${options.audience} - ${audienceContext[options.audience]}
- Tone: ${options.tone} - ${toneContext[options.tone]}
- ${options.includeNextSteps ? 'Include recommended next steps for the recipient.' : 'Do not include next steps.'}

Generate a professional incident update with:
1. A subject line (prefixed with severity indicator)
2. A body suitable for email/message
3. A 1-2 sentence summary

Format your response as JSON with keys: subject, body, summary`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    let result: { subject?: string; body?: string; summary?: string };
    
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Copilot] Failed to parse blockchain response:', parseError);
      result = {};
    }
    
    return {
      subject: typeof result.subject === 'string' ? result.subject : `[${incident.severity.toUpperCase()}] ${chainName} Blockchain Incident`,
      body: typeof result.body === 'string' ? result.body : 'Unable to generate update. Please try again.',
      summary: typeof result.summary === 'string' ? result.summary : 'Blockchain incident update generated.',
    };
  } catch (error) {
    console.error('[AI Copilot] OpenAI API error for blockchain:', error);
    return {
      subject: `[${incident.severity.toUpperCase()}] ${chainName} Blockchain Incident`,
      body: 'Unable to generate AI-powered update at this time. Please try again later.',
      summary: 'AI generation temporarily unavailable.',
    };
  }
}

export async function suggestBlockchainRootCause(incidentId: string): Promise<{
  likelyCauses: string[];
  confidence: string;
  recommendation: string;
  historicalPattern: string | null;
}> {
  const allIncidents = await db.select().from(blockchainIncidents);
  const incident = allIncidents.find(i => i.id === incidentId);
  
  if (!incident) {
    throw new Error('Blockchain incident not found');
  }
  
  const allChains = await db.select().from(blockchainChains);
  const chain = allChains.find(c => c.key === incident.chainKey);
  const chainName = chain?.name || incident.chainKey;
  
  const historicalIncidents = allIncidents
    .filter(i => i.chainKey === incident.chainKey && i.status === 'resolved')
    .slice(0, 10);
  
  const prompt = `You are a blockchain infrastructure expert analyzing a service incident.

Current Incident:
- Chain/Platform: ${chainName}
- Title: ${incident.title}
- Severity: ${incident.severity}
- Type: ${incident.incidentType}
- Description: ${incident.description || 'Not specified'}

Historical incidents for this chain (${historicalIncidents.length} resolved):
${historicalIncidents.map(i => `- ${i.title} (${i.incidentType}, ${i.severity})`).join('\n')}

Analyze this blockchain incident and provide:
1. Likely root causes (up to 3)
2. Confidence level (low, medium, high)
3. Recommended actions for the infrastructure team
4. Any patterns from historical incidents

Consider common blockchain issues like:
- Network congestion or validator issues
- RPC endpoint failures
- Consensus problems
- Smart contract issues
- Bridge or wallet service outages

Format your response as JSON with keys: likelyCauses (array), confidence, recommendation, historicalPattern`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    let result: { likelyCauses?: string[]; confidence?: string; recommendation?: string; historicalPattern?: string };
    
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('[AI Copilot] Failed to parse blockchain root cause response:', parseError);
      result = {};
    }
    
    return {
      likelyCauses: Array.isArray(result.likelyCauses) ? result.likelyCauses : ['Unable to determine'],
      confidence: typeof result.confidence === 'string' ? result.confidence : 'low',
      recommendation: typeof result.recommendation === 'string' ? result.recommendation : 'Monitor the situation.',
      historicalPattern: typeof result.historicalPattern === 'string' ? result.historicalPattern : null,
    };
  } catch (error) {
    console.error('[AI Copilot] OpenAI API error in blockchain root cause analysis:', error);
    return {
      likelyCauses: ['Unable to determine - AI service temporarily unavailable'],
      confidence: 'low',
      recommendation: 'Monitor the situation and try again later.',
      historicalPattern: null,
    };
  }
}
