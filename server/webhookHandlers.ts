import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { db } from './db';
import { users, pendingSignups } from '@shared/models/auth';
import { eq, and, isNull, gt } from 'drizzle-orm';

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
    
    // Prioritize environment variable, then fall back to managed webhook secret
    let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
    if (!webhookSecret) {
      webhookSecret = await sync.getManagedWebhookSecret();
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
          const metadata = session.metadata || {};
          
          // Handle mobile signup flow - create user from pending signup
          if (metadata.pendingSignupToken && metadata.platform === 'mobile') {
            // Atomically claim the pending signup to prevent duplicate user creation on retries
            const now = new Date();
            const [claimed] = await db.update(pendingSignups)
              .set({ completedAt: now })
              .where(and(
                eq(pendingSignups.signupToken, metadata.pendingSignupToken),
                isNull(pendingSignups.completedAt),
                gt(pendingSignups.expiresAt, now) // Enforce expiration
              ))
              .returning();
            
            if (claimed) {
              // Create the user account now that payment succeeded and claim was successful
              const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
              
              const [newUser] = await db.insert(users).values({
                email: claimed.email,
                password: claimed.passwordHash,
                firstName: claimed.firstName,
                lastName: claimed.lastName,
                companyName: claimed.companyName,
                phone: claimed.phone,
                subscriptionTier: claimed.tier,
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                profileCompleted: true,
                billingCompleted: true,
                billingStatus: 'trialing',
                trialEndsAt,
              }).returning();
              
              // Update pending signup with created user ID
              await db.update(pendingSignups)
                .set({ createdUserId: newUser.id })
                .where(eq(pendingSignups.id, claimed.id));
              
              console.log(`[stripe] Mobile signup complete: Created user ${newUser.id} (${newUser.email}) after payment`);
            } else {
              console.log(`[stripe] Pending signup not found, already processed, or expired for token: ${metadata.pendingSignupToken}`);
            }
          } else if (session.customer && session.subscription) {
            // Standard flow - link subscription to existing user
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
                // Update subscription info including billing status
                const isCanceled = subscription.status === 'canceled';
                const isActive = ['active', 'trialing'].includes(subscription.status);
                
                await storage.updateUserStripeInfo(user.id, {
                  stripeSubscriptionId: isCanceled ? null : subscription.id,
                  billingStatus: subscription.status,
                  billingCompleted: isActive,
                });
                
                // Update trial end date if available
                if (subscription.trial_end) {
                  await storage.updateUserTrialEnd(user.id, new Date(subscription.trial_end * 1000));
                }
                
                console.log(`[stripe] Updated subscription status for user ${user.id}: ${subscription.status}`);
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
