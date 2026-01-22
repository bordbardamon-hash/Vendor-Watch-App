import Stripe from 'stripe';

async function createSeatPrices() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('STRIPE_SECRET_KEY not found');
    process.exit(1);
  }
  
  const stripe = new Stripe(secretKey);
  
  console.log('Creating Growth additional seat price ($20/mo)...');
  const growthSeatPrice = await stripe.prices.create({
    unit_amount: 2000,
    currency: 'usd',
    recurring: { interval: 'month' },
    product_data: {
      name: 'Growth Plan - Additional Seat',
      metadata: { tier: 'growth', type: 'seat_addon' }
    },
    metadata: { tier: 'growth', type: 'seat_addon' }
  });
  console.log('Growth seat price created:', growthSeatPrice.id);
  
  console.log('Creating Enterprise additional seat price ($25/mo)...');
  const enterpriseSeatPrice = await stripe.prices.create({
    unit_amount: 2500,
    currency: 'usd',
    recurring: { interval: 'month' },
    product_data: {
      name: 'Enterprise Plan - Additional Seat',
      metadata: { tier: 'enterprise', type: 'seat_addon' }
    },
    metadata: { tier: 'enterprise', type: 'seat_addon' }
  });
  console.log('Enterprise seat price created:', enterpriseSeatPrice.id);
  
  console.log('\n=== ADD THESE TO YOUR ENVIRONMENT ===');
  console.log('STRIPE_PRICE_GROWTH_SEAT=' + growthSeatPrice.id);
  console.log('STRIPE_PRICE_ENTERPRISE_SEAT=' + enterpriseSeatPrice.id);
}

createSeatPrices().catch(console.error);
