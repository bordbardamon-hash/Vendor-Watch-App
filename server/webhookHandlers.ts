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
    await sync.processWebhook(payload, signature);

    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      (await sync.getManagedWebhookSecret()) || ''
    );

    if (event.type === 'checkout.session.completed') {
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
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
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
    }
  }
}
