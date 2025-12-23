import puppeteer, { Browser, Page } from 'puppeteer';
import { recordParseResult } from './parserHealthTracker';

interface ScrapedStatus {
  status: 'operational' | 'degraded' | 'outage' | 'unknown';
  incidents: Array<{
    id: string;
    name: string;
    status: string;
    impact: string;
    shortlink: string;
    created_at: string;
    updated_at: string;
  }>;
  maintenances: any[];
  success: boolean;
  httpStatus?: number;
  errorMessage?: string;
}

function generateStableId(vendorKey: string, title: string): string {
  const hash = title.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${vendorKey}-${Math.abs(hash).toString(36)}`;
}

function detectStatusFromBanner(bannerText: string): 'operational' | 'degraded' | 'outage' {
  const lowerText = bannerText.toLowerCase();
  
  if (lowerText.includes('major outage') || 
      lowerText.includes('service disruption') ||
      lowerText.includes('critical outage')) {
    return 'outage';
  }
  
  if (lowerText.includes('degraded performance') || 
      lowerText.includes('currently investigating') ||
      lowerText.includes('partial outage') ||
      lowerText.includes('experiencing issues')) {
    return 'degraded';
  }
  
  if (lowerText.includes('all systems operational') ||
      lowerText.includes('all services operational') ||
      lowerText.includes('no issues') ||
      lowerText.includes('100%')) {
    return 'operational';
  }
  
  return 'operational';
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) {
    }
    browserInstance = null;
  }
  
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,720'
    ]
  });
  
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (e) {
    }
    browserInstance = null;
  }
}

async function scrapeWithPuppeteer(
  url: string, 
  vendorKey: string,
  extractStatus: (page: Page) => Promise<{ status: 'operational' | 'degraded' | 'outage'; incidents: ScrapedStatus['incidents'] }>
): Promise<ScrapedStatus> {
  let page: Page | null = null;
  
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const { status, incidents } = await extractStatus(page);
    
    await recordParseResult(vendorKey, { 
      success: true, 
      httpStatus: 200, 
      incidentsParsed: incidents.length 
    });
    
    return { 
      status, 
      incidents, 
      maintenances: [], 
      success: true, 
      httpStatus: 200 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[puppeteer/${vendorKey}] Scraping failed:`, errorMessage);
    await recordParseResult(vendorKey, { success: false, errorMessage });
    return { 
      status: 'unknown', 
      incidents: [], 
      maintenances: [], 
      success: false, 
      errorMessage 
    };
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

export async function scrapeOktaWithPuppeteer(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  return scrapeWithPuppeteer('https://status.okta.com', vendor.key, async (page) => {
    const statusData = await page.evaluate(() => {
      const bannerEl = document.querySelector('.status-page, .masthead, [class*="status-banner"], header');
      const bannerText = bannerEl?.textContent || '';
      
      const activeIncidents: { title: string; status: string }[] = [];
      const incidentSections = document.querySelectorAll('[class*="active-incident"], [class*="current-incident"], .incident-item:not(.resolved)');
      incidentSections.forEach(el => {
        const title = el.querySelector('h2, h3, h4, .title')?.textContent?.trim();
        const status = el.querySelector('.status, .badge')?.textContent?.trim() || 'investigating';
        if (title && !title.toLowerCase().includes('history')) {
          activeIncidents.push({ title, status });
        }
      });
      
      return { bannerText, activeIncidents };
    });
    
    const status = statusData.activeIncidents.length > 0 ? 'degraded' : detectStatusFromBanner(statusData.bannerText);
    
    const incidents: ScrapedStatus['incidents'] = statusData.activeIncidents.map(inc => ({
      id: generateStableId(vendor.key, inc.title),
      name: inc.title.substring(0, 200),
      status: inc.status.toLowerCase(),
      impact: 'minor',
      shortlink: 'https://status.okta.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    return { status, incidents };
  });
}

export async function scrapeAuth0WithPuppeteer(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  return scrapeWithPuppeteer('https://status.auth0.com', vendor.key, async (page) => {
    const statusData = await page.evaluate(() => {
      const bannerEl = document.querySelector('header, .status-banner, [class*="overall-status"]');
      const bannerText = bannerEl?.textContent || '';
      
      const activeIncidents: { title: string; status: string }[] = [];
      const mainContent = document.querySelector('main, section, .content');
      if (mainContent) {
        const incidentElements = mainContent.querySelectorAll('[class*="incident"]:not([class*="history"]), .alert:not(.resolved)');
        incidentElements.forEach(el => {
          const title = el.querySelector('h2, h3, h4')?.textContent?.trim();
          const status = el.querySelector('.badge, [class*="status"]')?.textContent?.trim() || 'investigating';
          if (title && title.length > 5 && !title.toLowerCase().includes('history') && !title.toLowerCase().includes('subscribe')) {
            activeIncidents.push({ title, status });
          }
        });
      }
      
      return { bannerText, activeIncidents };
    });
    
    const status = statusData.activeIncidents.length > 0 ? 'degraded' : detectStatusFromBanner(statusData.bannerText);
    
    const incidents: ScrapedStatus['incidents'] = statusData.activeIncidents.slice(0, 5).map(inc => ({
      id: generateStableId(vendor.key, inc.title),
      name: inc.title.substring(0, 200),
      status: inc.status.toLowerCase(),
      impact: 'minor',
      shortlink: 'https://status.auth0.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    return { status, incidents };
  });
}

export async function scrapeFastlyWithPuppeteer(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  return scrapeWithPuppeteer('https://www.fastlystatus.com', vendor.key, async (page) => {
    const statusData = await page.evaluate(() => {
      const bannerEl = document.querySelector('.overall-status, header, .status-banner');
      const bannerText = bannerEl?.textContent || '';
      
      const activeIncidents: { title: string }[] = [];
      const incidentSections = document.querySelectorAll('.active-incident, .incident:not(.resolved), [class*="current-incident"]');
      incidentSections.forEach(el => {
        const title = el.querySelector('h2, h3, .title')?.textContent?.trim() || el.textContent?.trim();
        if (title && title.length > 10 && title.length < 300 && !title.toLowerCase().includes('history')) {
          activeIncidents.push({ title });
        }
      });
      
      return { bannerText, activeIncidents };
    });
    
    const status = statusData.activeIncidents.length > 0 ? 'degraded' : detectStatusFromBanner(statusData.bannerText);
    
    const incidents: ScrapedStatus['incidents'] = statusData.activeIncidents.slice(0, 5).map(inc => ({
      id: generateStableId(vendor.key, inc.title),
      name: inc.title.substring(0, 200),
      status: 'investigating',
      impact: 'minor',
      shortlink: 'https://www.fastlystatus.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    return { status, incidents };
  });
}

export async function scrapeConnectWiseWithPuppeteer(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  return scrapeWithPuppeteer('https://status.connectwise.com', vendor.key, async (page) => {
    const statusData = await page.evaluate(() => {
      const statusEl = document.querySelector('#statusio_overview, .status-summary, .overall_status');
      const bannerText = statusEl?.textContent || '';
      
      const activeIncidents: { title: string }[] = [];
      const incidentBlocks = document.querySelectorAll('.incident_block:not(.resolved), .ongoing-incident');
      incidentBlocks.forEach(el => {
        const title = el.querySelector('.incident_title, h3, h4')?.textContent?.trim();
        if (title && title.length > 5) {
          activeIncidents.push({ title });
        }
      });
      
      return { bannerText, activeIncidents };
    });
    
    const status = statusData.activeIncidents.length > 0 ? 'degraded' : detectStatusFromBanner(statusData.bannerText);
    
    const incidents: ScrapedStatus['incidents'] = statusData.activeIncidents.slice(0, 5).map(inc => ({
      id: generateStableId(vendor.key, inc.title),
      name: inc.title.substring(0, 200),
      status: 'investigating',
      impact: 'minor',
      shortlink: 'https://status.connectwise.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    return { status, incidents };
  });
}

export async function scrapeNableWithPuppeteer(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  return scrapeWithPuppeteer('https://status.n-able.com', vendor.key, async (page) => {
    const statusData = await page.evaluate(() => {
      const statusEl = document.querySelector('#statusio_overview, .status-summary, .overall_status');
      const bannerText = statusEl?.textContent || '';
      const hasActiveIncident = document.querySelector('.incident_block:not(.resolved), .ongoing-incident') !== null;
      return { bannerText, hasActiveIncident };
    });
    
    const status = statusData.hasActiveIncident ? 'degraded' : detectStatusFromBanner(statusData.bannerText);
    return { status, incidents: [] };
  });
}

export async function scrapeSyncroWithPuppeteer(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  return scrapeWithPuppeteer('https://www.syncrostatus.com', vendor.key, async (page) => {
    const statusData = await page.evaluate(() => {
      const bannerEl = document.querySelector('.overall-status, header, [class*="status-banner"]');
      const bannerText = bannerEl?.textContent || '';
      const hasActiveIncident = document.querySelector('.incident:not(.resolved), [class*="active-incident"]') !== null;
      return { bannerText, hasActiveIncident };
    });
    
    const status = statusData.hasActiveIncident ? 'degraded' : detectStatusFromBanner(statusData.bannerText);
    return { status, incidents: [] };
  });
}

export async function scrapeJsVendorStatus(vendor: { key: string; statusUrl: string }): Promise<ScrapedStatus> {
  switch (vendor.key) {
    case 'okta':
      return scrapeOktaWithPuppeteer(vendor);
    case 'auth0':
      return scrapeAuth0WithPuppeteer(vendor);
    case 'fastly':
      return scrapeFastlyWithPuppeteer(vendor);
    case 'connectwise':
      return scrapeConnectWiseWithPuppeteer(vendor);
    case 'nable':
      return scrapeNableWithPuppeteer(vendor);
    case 'syncro':
      return scrapeSyncroWithPuppeteer(vendor);
    default:
      return { 
        status: 'unknown', 
        incidents: [], 
        maintenances: [], 
        success: false, 
        errorMessage: 'Unknown vendor' 
      };
  }
}
