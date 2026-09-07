import { Router } from 'express';
import { z } from 'zod';
import { Webhook } from 'standardwebhooks';
import { prisma } from '../db';
import { authenticate, requireActiveUser, AuthRequest } from '../middleware/auth';

const router = Router();
const MAX_MINUTES = 48 * 60;
const CHECKOUT_LOCK_MINUTES = 5;
const CHECKOUT_LOCK_MESSAGE = 'Someone else is booking this space right now. Please check another board or try again after 5 minutes.';
const BASE_CURRENCY = 'USD';

type P = {
  main_per30_usd: any;
  main_one_day_usd: any;
  wall_per30_usd: any;
  wall_one_day_usd: any;
  corner_per30_usd: any;
  corner_one_day_usd: any;
};

async function getPricing(tx: any) {
  const r = await tx.$queryRaw<P[]>`
    SELECT main_per30_usd, main_one_day_usd,
           wall_per30_usd, wall_one_day_usd,
           corner_per30_usd, corner_one_day_usd
    FROM pricing_settings
    WHERE id = 'default'
  `;
  if (!r[0]) {
    throw Object.assign(new Error('Pricing is not configured.'), { status: 503 });
  }
  return r[0];
}

function priceFor(p: P, type: string, minutes: number) {
  if (minutes <= 0 || minutes % 30 !== 0 || minutes > MAX_MINUTES) {
    throw new Error('Duration must be in 30-minute steps, maximum 2 days');
  }
  const t = String(type || '').trim().toLowerCase();
  const wall = t === 'wall' || t === 'building wall';
  const main = t === 'premium' || t === 'premium road' || t === 'vertical';
  const corner = !wall && !main;
  const per30 = Number(wall ? p.wall_per30_usd : corner ? p.corner_per30_usd : p.main_per30_usd);
  const day = Number(wall ? p.wall_one_day_usd : corner ? p.corner_one_day_usd : p.main_one_day_usd);

  if (minutes < 1440) return Number(((minutes / 30) * per30).toFixed(2));
  const days = Math.floor(minutes / 1440);
  const rem = minutes % 1440;
  return Number((days * day + (rem / 30) * per30).toFixed(2));
}

function dodoBaseUrl() {
  return (process.env.DODO_PAYMENTS_ENVIRONMENT || 'live_mode').toLowerCase() === 'test_mode'
    ? 'https://test.dodopayments.com'
    : 'https://live.dodopayments.com';
}

function dodoHeaders() {
  const key = process.env.DODO_PAYMENTS_API_KEY;
  if (!key) {
    throw Object.assign(new Error('Dodo Payments is not configured. Add DODO_PAYMENTS_API_KEY.'), { status: 503 });
  }
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: 'Bearer ' + key,
  };
}

function providerError(status: number, body: any) {
  return Object.assign(
    new Error(String(body?.message || body?.error || body?.type || 'Payment provider request failed')),
    { status: status >= 400 && status < 600 ? status : 502 },
  );
}

async function country(req: AuthRequest) {
  const h = String(
    req.headers['x-urban-country'] ||
      req.headers['cf-ipcountry'] ||
      req.headers['x-vercel-ip-country'] ||
      '',
  )
    .trim()
    .toUpperCase();
  if (/^[A-Z]{2}$/.test(h)) return h;

  const forced = String(process.env.PAYMENT_DEFAULT_COUNTRY || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(forced)) return forced;
  return 'US';
}

router.get('/country', async (req: AuthRequest, res, next) => {
  try {
    res.json({ country: await country(req) });
  } catch (e) {
    next(e);
  }
});

async function dodoCheckout(sessionId: string) {
  const r = await fetch(dodoBaseUrl() + '/checkouts/' + encodeURIComponent(sessionId), {
    headers: dodoHeaders(),
  });
  const s: any = await r.json().catch(() => ({}));
  if (!r.ok) throw providerError(r.status, s);
  if (s.id && s.id !== sessionId) {
    throw Object.assign(new Error('Dodo checkout session does not match this payment'), { status: 502 });
  }
  return s;
}

function currencyMinorUnits(currency: string) {
  const c = String(currency || '').toUpperCase();
  if (['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].includes(c)) return 3;
  if (['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'].includes(c)) return 0;
  return 2;
}

function smallestUnitToAmount(value: any, currency: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n / 10 ** currencyMinorUnits(currency);
}

async function activate(
  id: string,
  providerId?: string | null,
  eventId?: string | null,
  charged?: number,
  currency?: string,
) {
  await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id }, include: { booking: true } });
    if (!p || p.status === 'SUCCEEDED') return;

    if (eventId) {
      const prior = await tx.payment.findUnique({ where: { providerEventId: eventId } });
      if (prior && prior.id !== id) {
        throw Object.assign(new Error('Payment webhook event has already been processed.'), { status: 409 });
      }
    }

    const now = new Date();
    const taken = await tx.booking.findFirst({
      where: {
        billboardId: p.booking.billboardId,
        status: 'ACTIVE',
        endDate: { gt: now },
        id: { not: p.bookingId },
      },
    });

    if (taken) {
      throw Object.assign(new Error('This advertising space was booked by another completed payment.'), { status: 409 });
    }

    const end = new Date(now.getTime() + p.booking.durationMinutes * 60000);

    await tx.payment.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        providerPaymentId: providerId || p.providerPaymentId,
        providerEventId: eventId || p.providerEventId,
        amount: charged ?? p.amount,
        currency: currency || p.currency,
      },
    });

    await tx.booking.update({
      where: { id: p.bookingId },
      data: { status: 'ACTIVE', startDate: now, endDate: end },
    });

    await tx.billboard.update({
      where: { id: p.booking.billboardId },
      data: {
        isAvailable: false,
        currentBid: p.booking.amount,
        currentBidderId: p.userId,
      },
    });

    await tx.checkoutLock.deleteMany({ where: { billboardId: p.booking.billboardId } });
  });
}

async function fail(id: string, status: 'FAILED' | 'CANCELLED') {
  const p = await prisma.payment.findUnique({ where: { id } });
  if (!p || p.status === 'SUCCEEDED') return;

  await prisma.$transaction([
    prisma.payment.update({ where: { id }, data: { status } }),
    prisma.booking.update({
      where: { id: p.bookingId },
      data: { status: status === 'FAILED' ? 'PAYMENT_FAILED' : 'PAYMENT_CANCELLED' },
    }),
    prisma.checkoutLock.deleteMany({ where: { bookingId: p.bookingId } }),
  ]);
}

// UrbanCity currently uses Dodo for ALL payments, including Indian users.
// Cashfree is intentionally not selected here until its domain approval is complete.
router.post('/checkout', authenticate, requireActiveUser, async (req: AuthRequest, res, next) => {
  let prepared: any = null;

  try {
    const d = z
      .object({
        billboardId: z.string(),
        durationMinutes: z.number().int().min(30).max(MAX_MINUTES),
        companyName: z.string().min(2).max(80).optional(),
        description: z.string().max(500).optional(),
        advertisementId: z.string().optional(),
        customerPhone: z.string().optional(),
      })
      .parse(req.body);

    if (d.durationMinutes % 30 !== 0) {
      return res.status(400).json({ error: 'Choose time in 30-minute steps' });
    }

    const now = new Date();
    const preparedResult = await prisma.$transaction(async (tx) => {
      await tx.checkoutLock.deleteMany({ where: { expiresAt: { lte: now } } });

      const lock = new Date(now.getTime() + CHECKOUT_LOCK_MINUTES * 60000);
      let b = await tx.billboard.findUnique({ where: { id: d.billboardId } });
      const pricing = await getPricing(tx);

      if (!b) {
        const wall = d.billboardId.startsWith('W');
        b = await tx.billboard.create({
          data: {
            id: d.billboardId,
            name: (wall ? 'Wallboard ' : 'Billboard ') + d.billboardId,
            type: wall ? 'Wall' : 'Premium Road',
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            location: 'UrbanCity',
            isAvailable: true,
            isActive: true,
            minBid: wall ? pricing.wall_per30_usd : pricing.main_per30_usd,
          },
        });
      }

      if (!b) throw Object.assign(new Error('Billboard not found'), { status: 404 });

      if (
        await tx.booking.findFirst({
          where: { billboardId: d.billboardId, status: 'ACTIVE', endDate: { gt: now } },
        })
      ) {
        throw Object.assign(new Error('This advertising space is currently reserved or booked'), { status: 409 });
      }

      const current = await tx.checkoutLock.findUnique({ where: { billboardId: d.billboardId } });
      if (current && current.userId !== req.user!.id) {
        throw Object.assign(new Error(CHECKOUT_LOCK_MESSAGE), { status: 409 });
      }

      const amount = priceFor(pricing, b.type, d.durationMinutes);
      let booking: any;

      if (current?.bookingId) {
        const old = await tx.booking.findFirst({
          where: { id: current.bookingId, userId: req.user!.id, status: 'PAYMENT_PENDING' },
          include: { payment: true },
        });

        if (old) {
          booking = await tx.booking.update({
            where: { id: old.id },
            data: {
              startDate: now,
              endDate: lock,
              durationMinutes: d.durationMinutes,
              amount,
              companyName: d.companyName || req.user!.displayName || req.user!.username,
              description: d.description || null,
              advertisementId: d.advertisementId,
            },
          });
          if (old.payment) await tx.payment.delete({ where: { id: old.payment.id } });
        }
      }

      if (!booking) {
        booking = await tx.booking.create({
          data: {
            userId: req.user!.id,
            billboardId: d.billboardId,
            startDate: now,
            endDate: lock,
            durationMinutes: d.durationMinutes,
            amount,
            companyName: d.companyName || req.user!.displayName || req.user!.username,
            description: d.description || null,
            advertisementId: d.advertisementId,
            status: 'PAYMENT_PENDING',
          },
        });
      }

      if (current) {
        await tx.checkoutLock.update({
          where: { id: current.id },
          data: { userId: req.user!.id, bookingId: booking.id, expiresAt: lock },
        });
      } else {
        await tx.checkoutLock.create({
          data: {
            billboardId: d.billboardId,
            userId: req.user!.id,
            bookingId: booking.id,
            expiresAt: lock,
          },
        });
      }

      const paymentRow = await tx.payment.create({
        data: {
          bookingId: booking.id,
          userId: req.user!.id,
          provider: 'DODO',
          amount,
          currency: BASE_CURRENCY,
          status: 'PENDING',
        },
      });

      return { booking, payment: paymentRow, amount, country: await country(req) };
    });

    prepared = preparedResult;

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    const product = process.env.DODO_PAYMENTS_PRODUCT_ID;
    if (!product) {
      throw Object.assign(new Error('Dodo Payments is not configured. Add DODO_PAYMENTS_PRODUCT_ID.'), { status: 503 });
    }

    const r = await fetch(dodoBaseUrl() + '/checkouts', {
      method: 'POST',
      headers: dodoHeaders(),
      body: JSON.stringify({
        product_cart: [
          {
            product_id: product,
            quantity: 1,
            amount: Math.round(prepared.amount * 100),
          },
        ],
        customer: {
          email: req.user!.email,
          name: req.user!.displayName || req.user!.username,
        },
        billing_address: { country: prepared.country },
        return_url:
          frontend +
          '/?payment=return&booking=' +
          encodeURIComponent(prepared.booking.id),
        cancel_url:
          frontend +
          '/?payment=return&booking=' +
          encodeURIComponent(prepared.booking.id),
        metadata: {
          booking_id: prepared.booking.id,
          payment_id: prepared.payment.id,
        },
      }),
    });

    const s: any = await r.json().catch(() => ({}));
    if (!r.ok) throw providerError(r.status, s);
    if (!s.session_id || !s.checkout_url) {
      throw Object.assign(new Error('Dodo did not return a checkout URL.'), { status: 502 });
    }

    await prisma.payment.update({
      where: { id: prepared.payment.id },
      data: {
        providerPaymentId: s.session_id,
        checkoutSessionId: s.session_id,
        status: 'CHECKOUT_CREATED',
        amount: prepared.amount,
        currency: BASE_CURRENCY,
      },
    });

    return res.status(201).json({
      bookingId: prepared.booking.id,
      paymentId: prepared.payment.id,
      orderId: s.session_id,
      paymentSessionId: 'DODO_URL:' + Buffer.from(s.checkout_url).toString('base64url'),
      checkoutUrl: s.checkout_url,
      paymentProvider: 'DODO',
      amount: prepared.amount,
      currency: BASE_CURRENCY,
      country: prepared.country,
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT || 'live_mode',
    });
  } catch (e) {
    if (prepared?.payment?.id) {
      await fail(prepared.payment.id, 'FAILED').catch(() => undefined);
    }
    next(e);
  }
});

router.get('/:bookingId/verify', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const p = await prisma.payment.findFirst({
      where: { bookingId: req.params.bookingId, userId: req.user!.id },
      include: { booking: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!p) return res.status(404).json({ error: 'Payment not found' });

    if (p.status === 'SUCCEEDED') {
      return res.json({
        paid: true,
        paymentStatus: 'SUCCEEDED',
        bookingStatus: 'ACTIVE',
        amount: Number(p.booking.amount),
        currency: 'USD',
        chargedAmount: Number(p.amount),
        chargedCurrency: p.currency,
      });
    }

    const checkoutSessionId = p.checkoutSessionId || p.providerPaymentId;
    if (!checkoutSessionId) {
      return res.status(400).json({ error: 'Dodo checkout session is missing for this payment' });
    }

    const s: any = await dodoCheckout(checkoutSessionId);
    const providerStatus = String(s.payment_status || '').toLowerCase();

    // Dodo's checkout-session API is the authoritative return-path status.
    // The webhook is still processed separately and is the primary async path.
    if (providerStatus === 'succeeded') {
      await activate(
        p.id,
        s.payment_id || p.providerPaymentId,
        undefined,
        Number(p.amount),
        p.currency || BASE_CURRENCY,
      );
      return res.json({
        paid: true,
        paymentStatus: 'SUCCEEDED',
        bookingStatus: 'ACTIVE',
        providerStatus,
        amount: Number(p.booking.amount),
        currency: 'USD',
        chargedAmount: Number(p.amount),
        chargedCurrency: p.currency,
      });
    }

    if (providerStatus === 'failed') await fail(p.id, 'FAILED');
    if (providerStatus === 'cancelled') await fail(p.id, 'CANCELLED');

    return res.json({
      paid: false,
      paymentStatus: p.status,
      bookingStatus: p.booking.status,
      providerStatus: providerStatus || 'UNKNOWN',
      amount: Number(p.booking.amount),
      currency: 'USD',
      chargedAmount: Number(p.amount),
      chargedCurrency: p.currency,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/webhook/dodo', async (req, res) => {
  try {
    const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    if (!secret) return res.status(503).json({ error: 'Dodo webhook secret is not configured' });

    const raw = (req as any).rawBody || JSON.stringify(req.body);
    const webhookHeaders = {
      'webhook-id': String(req.headers['webhook-id'] || ''),
      'webhook-signature': String(req.headers['webhook-signature'] || ''),
      'webhook-timestamp': String(req.headers['webhook-timestamp'] || ''),
    };

    await new Webhook(secret).verify(raw, webhookHeaders);

    const e: any = JSON.parse(raw);
    const type = String(e?.type || '');
    const d: any = e?.data || {};

    if (!['payment.succeeded', 'payment.failed', 'payment.cancelled'].includes(type)) {
      return res.status(200).json({ received: true });
    }

    const providerPaymentId = String(d?.payment_id || '');
    const checkoutSessionId = String(d?.checkout_session_id || '');
    const metadata = d?.metadata && typeof d.metadata === 'object' ? d.metadata : {};
    const internalPaymentId = String(metadata?.payment_id || '');

    let p: any = null;

    if (internalPaymentId) {
      p = await prisma.payment.findUnique({
        where: { id: internalPaymentId },
        include: { booking: true },
      });
    }

    if (!p && checkoutSessionId) {
      p = await prisma.payment.findFirst({
        where: { provider: 'DODO', checkoutSessionId },
        include: { booking: true },
      });
    }

    if (!p && providerPaymentId) {
      p = await prisma.payment.findFirst({
        where: { provider: 'DODO', providerPaymentId },
        include: { booking: true },
      });
    }

    if (!p) return res.status(200).json({ received: true });

    const eventId = String(req.headers['webhook-id'] || '');
    if (eventId) {
      const prior = await prisma.payment.findUnique({ where: { providerEventId: eventId } });
      if (prior) return res.status(200).json({ received: true, duplicate: true });
    }

    if (type === 'payment.failed') {
      await fail(p.id, 'FAILED');
      return res.status(200).json({ received: true });
    }

    if (type === 'payment.cancelled') {
      await fail(p.id, 'CANCELLED');
      return res.status(200).json({ received: true });
    }

    // payment.succeeded is already cryptographically verified by Standard Webhooks.
    // Do not reject it just because Dodo's adaptive pricing changes USD into INR.
    // Dodo documents total_amount as the smallest currency unit and currency as the
    // actual payment currency, so store the actual charged amount/currency when present.
    const providerCurrency = String(d?.currency || d?.settlement_currency || '').toUpperCase() || p.currency || BASE_CURRENCY;
    const providerAmount = smallestUnitToAmount(d?.total_amount, providerCurrency);
    const chargedAmount = providerAmount == null ? Number(p.amount) : providerAmount;
    const paymentId = providerPaymentId || p.providerPaymentId;

    await activate(
      p.id,
      paymentId,
      eventId || undefined,
      chargedAmount,
      providerCurrency,
    );

    return res.status(200).json({ received: true });
  } catch (e: any) {
    console.error('Dodo webhook processing failed:', e?.message || e);
    return res.status(400).json({ error: 'Dodo webhook processing failed' });
  }
});

export { router as paymentRouter };
