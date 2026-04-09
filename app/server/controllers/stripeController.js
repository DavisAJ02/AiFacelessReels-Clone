import Stripe from 'stripe';
import { User } from '../models/User.js';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function createCheckoutSession(req, res) {
  try {
    const stripe = getStripe();
    const price = process.env.STRIPE_PRICE_PRO;
    if (!stripe || !price) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }

    const user = await User.findById(req.user.id);
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/subscription?success=1`,
      cancel_url: `${process.env.CLIENT_URL}/subscription?canceled=1`,
      metadata: { userId: user.id },
    });

    return res.json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

export async function stripeWebhook(req, res) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    return res.status(503).send('Stripe webhook not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], whSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          plan: 'pro',
          subscriptionStatus: 'active',
          stripeSubscriptionId: session.subscription || null,
        });
      }
    }
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      await User.findOneAndUpdate(
        { stripeSubscriptionId: sub.id },
        { plan: 'free', subscriptionStatus: 'canceled' }
      );
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  return res.json({ received: true });
}
