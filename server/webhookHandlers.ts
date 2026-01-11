import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    try {
      await sync.processWebhook(payload, signature);
    } catch (syncError: any) {
      console.log('[stripe] Sync webhook processing:', syncError.message);
    }

    const stripe = await getUncachableStripeClient();
    
    // Try managed webhook secret first, then fall back to environment variable
    let webhookSecret = await sync.getManagedWebhookSecret();
    if (!webhookSecret) {
      webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
    }
    
    if (!webhookSecret) {
      console.log('[stripe] No webhook secret configured, skipping event processing');
      return;
    }
    
    console.log('[stripe] Using webhook secret:', webhookSecret.substring(0, 10) + '...');

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[stripe] Webhook signature verification failed:', err.message);
      throw err;
    }

    console.log(`[stripe] Received webhook event: ${event.type}`);

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;
          if (session.customer && session.subscription) {
            const customer = await stripe.customers.retrieve(session.customer as string);
            if (customer && !customer.deleted && customer.email) {
              const user = await storage.getUserByEmail(customer.email);
              if (user) {
                await storage.updateUserStripeInfo(user.id, {
                  stripeCustomerId: session.customer as string,
                  stripeSubscriptionId: session.subscription as string,
                });
                console.log(`[stripe] Linked subscription to user ${user.id}`);
              }
            }
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          if (subscription.customer) {
            const customer = await stripe.customers.retrieve(subscription.customer as string);
            if (customer && !customer.deleted && customer.email) {
              const user = await storage.getUserByEmail(customer.email);
              if (user) {
                await storage.updateUserStripeInfo(user.id, {
                  stripeSubscriptionId: subscription.status === 'canceled' ? null : subscription.id,
                });
                console.log(`[stripe] Updated subscription status for user ${user.id}`);
              }
            }
          }
          break;
        }

        case 'checkout.session.expired':
        case 'checkout.session.async_payment_succeeded':
        case 'checkout.session.async_payment_failed':
        case 'customer.created':
        case 'customer.updated':
        case 'customer.deleted':
        case 'invoice.paid':
        case 'invoice.payment_failed':
        case 'invoice.payment_succeeded':
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
          console.log(`[stripe] Acknowledged event: ${event.type}`);
          break;

        default:
          console.log(`[stripe] Unhandled event type: ${event.type}`);
      }
    } catch (handlerError: any) {
      console.error(`[stripe] Error handling ${event.type}:`, handlerError.message);
    }
  }
}
