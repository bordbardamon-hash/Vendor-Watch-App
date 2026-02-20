import type { Express } from 'express';
import { storage } from './storage';

export function registerEmbedRoutes(app: Express) {

  app.get('/embed/:slug', async (req, res) => {
    try {
      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).send('<html><body><h1>Portal not found</h1></body></html>');
      }

      storage.incrementPortalViewCount(portal.id).catch(() => {});

      const assignments = await storage.getPortalVendorAssignments(portal.id);
      const visibleAssignments = assignments
        .filter(a => a.showOnPortal)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      const vendorData: Array<{
        name: string;
        status: string;
        resourceType: string;
        components: Array<{ name: string; status: string; groupName: string | null }>;
        incidents: Array<{ title: string; status: string; severity: string; startedAt: string }>;
      }> = [];

      for (const assignment of visibleAssignments) {
        if (assignment.resourceType === 'vendor' && assignment.vendorKey) {
          const vendor = await storage.getVendor(assignment.vendorKey);
          if (!vendor) continue;
          const components = await storage.getVendorComponents(assignment.vendorKey);
          const incidents = await storage.getIncidentsByVendor(assignment.vendorKey);
          const activeIncidents = incidents.filter(i => i.status !== 'resolved');
          vendorData.push({
            name: assignment.displayName || vendor.name,
            status: vendor.status || 'operational',
            resourceType: 'vendor',
            components: components.map(c => ({ name: c.name, status: c.status, groupName: c.groupName })),
            incidents: activeIncidents.map(i => ({ title: i.title, status: i.status, severity: i.severity, startedAt: i.startedAt })),
          });
        } else if (assignment.resourceType === 'blockchain' && assignment.chainKey) {
          const chain = await storage.getBlockchainChain(assignment.chainKey);
          if (!chain) continue;
          const incidents = await storage.getBlockchainIncidentsByChain(assignment.chainKey);
          const activeIncidents = incidents.filter(i => i.status !== 'resolved');
          vendorData.push({
            name: assignment.displayName || chain.name,
            status: chain.status || 'operational',
            resourceType: 'blockchain',
            components: [],
            incidents: activeIncidents.map(i => ({ title: i.title, status: i.status, severity: i.severity || 'minor', startedAt: i.startedAt || '' })),
          });
        }
      }

      const tvMode = req.query.tv === 'true';
      const primaryColor = portal.primaryColor || '#3b82f6';
      const bgColor = portal.backgroundColor || '#0f172a';
      const isDark = true;
      const textColor = isDark ? '#e2e8f0' : '#1e293b';
      const cardBg = isDark ? '#1e293b' : '#ffffff';
      const borderColor = isDark ? '#334155' : '#e2e8f0';

      const getStatusColor = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'operational' || s === 'active' || s === 'healthy') return '#22c55e';
        if (s === 'degraded_performance' || s === 'degraded' || s === 'partial_outage' || s === 'warning') return '#eab308';
        if (s === 'major_outage' || s === 'outage' || s === 'down' || s === 'critical') return '#ef4444';
        if (s === 'under_maintenance' || s === 'maintenance') return '#3b82f6';
        return '#22c55e';
      };

      const getStatusLabel = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'operational' || s === 'active' || s === 'healthy') return 'Operational';
        if (s === 'degraded_performance' || s === 'degraded') return 'Degraded';
        if (s === 'partial_outage') return 'Partial Outage';
        if (s === 'major_outage' || s === 'outage' || s === 'down') return 'Major Outage';
        if (s === 'critical') return 'Critical';
        if (s === 'under_maintenance' || s === 'maintenance') return 'Maintenance';
        if (s === 'warning') return 'Warning';
        return status;
      };

      const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const overallStatuses = vendorData.map(v => v.status.toLowerCase());
      const hasOutage = overallStatuses.some(s => ['major_outage', 'outage', 'down', 'critical'].includes(s));
      const hasDegraded = overallStatuses.some(s => ['degraded_performance', 'degraded', 'partial_outage', 'warning'].includes(s));
      const overallStatus = hasOutage ? 'Major Outage' : hasDegraded ? 'Degraded Performance' : 'All Systems Operational';
      const overallColor = hasOutage ? '#ef4444' : hasDegraded ? '#eab308' : '#22c55e';

      const showIncidents = portal.showIncidentHistory !== false;

      const vendorHtml = vendorData.map(v => {
        const color = getStatusColor(v.status);
        const label = getStatusLabel(v.status);

        const componentsHtml = v.components.length > 0 ? `
          <div style="margin-top:8px;padding-left:16px;">
            ${v.components.map(c => `
              <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:${tvMode ? '16px' : '13px'};">
                <span style="width:8px;height:8px;border-radius:50%;background:${getStatusColor(c.status)};display:inline-block;flex-shrink:0;"></span>
                <span style="color:${textColor};opacity:0.8;">${escapeHtml(c.name)}</span>
                <span style="color:${textColor};opacity:0.5;font-size:${tvMode ? '14px' : '11px'};margin-left:auto;">${getStatusLabel(c.status)}</span>
              </div>
            `).join('')}
          </div>
        ` : '';

        const incidentsHtml = showIncidents && v.incidents.length > 0 ? `
          <div style="margin-top:8px;border-top:1px solid ${borderColor};padding-top:8px;">
            ${v.incidents.map(i => `
              <div style="padding:6px 0;font-size:${tvMode ? '15px' : '12px'};">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="color:${getStatusColor(i.severity === 'critical' || i.severity === 'major' ? 'critical' : 'warning')};font-weight:600;">●</span>
                  <span style="color:${textColor};">${escapeHtml(i.title)}</span>
                </div>
                <div style="color:${textColor};opacity:0.5;font-size:${tvMode ? '13px' : '11px'};padding-left:18px;">${escapeHtml(i.status)} · ${escapeHtml(i.startedAt)}</div>
              </div>
            `).join('')}
          </div>
        ` : '';

        return `
          <div style="background:${cardBg};border:1px solid ${borderColor};border-radius:8px;padding:${tvMode ? '20px' : '16px'};margin-bottom:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="width:${tvMode ? '14px' : '10px'};height:${tvMode ? '14px' : '10px'};border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
                <span style="font-weight:600;font-size:${tvMode ? '22px' : '15px'};color:${textColor};">${escapeHtml(v.name)}</span>
              </div>
              <span style="font-size:${tvMode ? '16px' : '12px'};color:${color};font-weight:500;">${label}</span>
            </div>
            ${componentsHtml}
            ${incidentsHtml}
          </div>
        `;
      }).join('');

      const logoHtml = portal.logoUrl
        ? `<img src="${escapeHtml(portal.logoUrl)}" alt="" style="height:${tvMode ? '48px' : '36px'};max-width:200px;object-fit:contain;" />`
        : '';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="60">
  <title>${escapeHtml(portal.name)} - Status</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${portal.fontFamily || 'Inter'}, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${tvMode ? '#000000' : bgColor};
      color: ${textColor};
      min-height: 100vh;
      ${tvMode ? 'overflow: hidden;' : ''}
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: ${tvMode ? '40px 32px' : '24px 16px'};
    }
    a { color: ${primaryColor}; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div style="text-align:center;margin-bottom:${tvMode ? '32px' : '24px'};">
      ${logoHtml}
      <h1 style="font-size:${tvMode ? '32px' : '22px'};font-weight:700;margin-top:8px;color:${textColor};">${escapeHtml(portal.name)}</h1>
      ${portal.headerText ? `<p style="margin-top:6px;font-size:${tvMode ? '18px' : '14px'};color:${textColor};opacity:0.7;">${escapeHtml(portal.headerText)}</p>` : ''}
    </div>

    <div style="text-align:center;padding:${tvMode ? '20px' : '14px'};margin-bottom:${tvMode ? '28px' : '20px'};border-radius:8px;background:${cardBg};border:1px solid ${borderColor};">
      <span style="display:inline-block;width:${tvMode ? '14px' : '10px'};height:${tvMode ? '14px' : '10px'};border-radius:50%;background:${overallColor};margin-right:8px;vertical-align:middle;"></span>
      <span style="font-size:${tvMode ? '22px' : '16px'};font-weight:600;color:${overallColor};vertical-align:middle;">${overallStatus}</span>
    </div>

    ${vendorHtml}

    ${portal.footerText ? `<div style="text-align:center;margin-top:${tvMode ? '28px' : '20px'};font-size:${tvMode ? '14px' : '12px'};color:${textColor};opacity:0.5;">${escapeHtml(portal.footerText)}</div>` : ''}
  </div>
</body>
</html>`;

      res.set('Content-Type', 'text/html');
      res.set('Cache-Control', 'public, max-age=60');
      res.set('X-Frame-Options', 'ALLOWALL');
      res.send(html);
    } catch (err) {
      console.error('Embed page error:', err);
      res.status(500).send('<html><body><h1>Internal Server Error</h1></body></html>');
    }
  });

  app.get('/status/:slug/badge.svg', async (req, res) => {
    try {
      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).send('Not found');
      }

      const assignments = await storage.getPortalVendorAssignments(portal.id);
      const visibleAssignments = assignments.filter(a => a.showOnPortal);

      const statuses: string[] = [];
      for (const assignment of visibleAssignments) {
        if (assignment.resourceType === 'vendor' && assignment.vendorKey) {
          const vendor = await storage.getVendor(assignment.vendorKey);
          if (vendor) statuses.push((vendor.status || 'operational').toLowerCase());
        } else if (assignment.resourceType === 'blockchain' && assignment.chainKey) {
          const chain = await storage.getBlockchainChain(assignment.chainKey);
          if (chain) statuses.push((chain.status || 'operational').toLowerCase());
        }
      }

      const hasOutage = statuses.some(s => ['major_outage', 'outage', 'down', 'critical'].includes(s));
      const hasDegraded = statuses.some(s => ['degraded_performance', 'degraded', 'partial_outage', 'warning'].includes(s));

      let statusText: string;
      let statusColor: string;
      if (hasOutage) {
        statusText = 'outage';
        statusColor = '#e05d44';
      } else if (hasDegraded) {
        statusText = 'degraded';
        statusColor = '#dfb317';
      } else {
        statusText = 'operational';
        statusColor = '#4c1';
      }

      const label = portal.name;
      const labelWidth = Math.max(label.length * 6.5 + 10, 50);
      const valueWidth = Math.max(statusText.length * 6.5 + 10, 50);
      const totalWidth = labelWidth + valueWidth;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${statusColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelWidth / 2}" y="14" fill="#fff">${escapeXml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${statusText}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14" fill="#fff">${statusText}</text>
  </g>
</svg>`;

      res.set('Content-Type', 'image/svg+xml');
      res.set('Cache-Control', 'public, max-age=60');
      res.send(svg);
    } catch (err) {
      console.error('Badge error:', err);
      res.status(500).send('Error');
    }
  });

  app.get('/status/:slug/api', async (req, res) => {
    try {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');

      const portal = await storage.getClientPortalBySlug(req.params.slug);
      if (!portal || !portal.isActive) {
        return res.status(404).json({ error: 'Portal not found' });
      }

      const assignments = await storage.getPortalVendorAssignments(portal.id);
      const visibleAssignments = assignments
        .filter(a => a.showOnPortal)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

      const vendors: Array<{
        key: string;
        name: string;
        status: string;
        resourceType: string;
        components: Array<{ name: string; status: string }>;
        incidents: Array<{ title: string; status: string; severity: string; startedAt: string }>;
      }> = [];

      for (const assignment of visibleAssignments) {
        if (assignment.resourceType === 'vendor' && assignment.vendorKey) {
          const vendor = await storage.getVendor(assignment.vendorKey);
          if (!vendor) continue;
          const components = await storage.getVendorComponents(assignment.vendorKey);
          const incidents = await storage.getIncidentsByVendor(assignment.vendorKey);
          const activeIncidents = incidents.filter(i => i.status !== 'resolved');
          vendors.push({
            key: assignment.vendorKey,
            name: assignment.displayName || vendor.name,
            status: vendor.status || 'operational',
            resourceType: 'vendor',
            components: components.map(c => ({ name: c.name, status: c.status })),
            incidents: activeIncidents.map(i => ({ title: i.title, status: i.status, severity: i.severity, startedAt: i.startedAt })),
          });
        } else if (assignment.resourceType === 'blockchain' && assignment.chainKey) {
          const chain = await storage.getBlockchainChain(assignment.chainKey);
          if (!chain) continue;
          const incidents = await storage.getBlockchainIncidentsByChain(assignment.chainKey);
          const activeIncidents = incidents.filter(i => i.status !== 'resolved');
          vendors.push({
            key: assignment.chainKey,
            name: assignment.displayName || chain.name,
            status: chain.status || 'operational',
            resourceType: 'blockchain',
            components: [],
            incidents: activeIncidents.map(i => ({ title: i.title, status: i.status, severity: i.severity || 'minor', startedAt: i.startedAt || '' })),
          });
        }
      }

      const allStatuses = vendors.map(v => v.status.toLowerCase());
      const hasOutage = allStatuses.some(s => ['major_outage', 'outage', 'down', 'critical'].includes(s));
      const hasDegraded = allStatuses.some(s => ['degraded_performance', 'degraded', 'partial_outage', 'warning'].includes(s));
      const overallStatus = hasOutage ? 'outage' : hasDegraded ? 'degraded' : 'operational';

      res.json({ status: overallStatus, vendors });
    } catch (err) {
      console.error('Status API error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
