import Stripe from 'stripe';

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const connectorName = 'stripe';
  const targetEnvironment = 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.secret) {
    throw new Error('Stripe connection not found');
  }

  return connectionSettings.settings.secret;
}

async function createSubscriptionProduct() {
  const secretKey = await getCredentials();
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-11-17.clover',
  });

  console.log('Checking for existing Vendor Watch Pro product...');
  
  const existingProducts = await stripe.products.search({ 
    query: "name:'Vendor Watch Pro'" 
  });

  if (existingProducts.data.length > 0) {
    console.log('Vendor Watch Pro product already exists:', existingProducts.data[0].id);
    
    const prices = await stripe.prices.list({
      product: existingProducts.data[0].id,
      active: true,
    });
    
    if (prices.data.length > 0) {
      console.log('Existing price:', prices.data[0].id, '- $' + (prices.data[0].unit_amount! / 100) + '/month');
    }
    return;
  }

  console.log('Creating Vendor Watch Pro subscription product...');
  
  const product = await stripe.products.create({
    name: 'Vendor Watch Pro',
    description: 'Full access to Vendor Watch monitoring dashboard. Monitor vendor status pages, detect incidents, and receive alerts.',
    metadata: {
      plan_type: 'professional',
      features: 'unlimited_vendors,email_alerts,incident_tracking,api_access'
    }
  });

  console.log('Created product:', product.id);

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 8999,
    currency: 'usd',
    recurring: { 
      interval: 'month',
      trial_period_days: 7
    },
    metadata: {
      plan_name: 'monthly'
    }
  });

  console.log('Created monthly price with 7-day trial:', price.id, '- $89.99/month');
  console.log('\nSubscription product setup complete!');
  console.log('Product ID:', product.id);
  console.log('Price ID:', price.id);
}

createSubscriptionProduct()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
