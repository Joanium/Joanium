import { tryParseJson } from '../../../../../Shared/Utils/AsyncUtils.js';
import {
  mapCharge,
  mapSubscription,
  mapInvoice,
  mapPaymentIntent,
  mapProduct,
  mapRefund,
  mapPayout,
  mapCoupon,
  mapSubscriptionItem,
  mapInvoiceItem,
  mapShippingRate,
  mapTopup,
  mapReview,
  mapPlan,
} from './Utils.js';

const BASE = 'https://api.stripe.com/v1';

function headers(creds) {
  return {
    Authorization: `Bearer ${creds.token}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

async function stripeFetch(path, creds) {
  const res = await fetch(`${BASE}${path}`, { headers: headers(creds) });
  if (!res.ok) {
    const data = await tryParseJson(res);
    throw new Error(data.error?.message ?? `Stripe API error: ${res.status}`);
  }
  return res.json();
}

// ── Existing ───────────────────────────────────────────────────────────────

export async function getBalance(creds) {
  const b = await stripeFetch('/balance', creds);
  return {
    available: (b.available ?? []).map((a) => ({
      amount: a.amount / 100,
      currency: a.currency.toUpperCase(),
    })),
    pending: (b.pending ?? []).map((p) => ({
      amount: p.amount / 100,
      currency: p.currency.toUpperCase(),
    })),
  };
}

export async function listCustomers(creds, limit = 10) {
  const data = await stripeFetch(`/customers?limit=${limit}`, creds);
  return (data.data ?? []).map((c) => ({
    id: c.id,
    email: c.email ?? null,
    name: c.name ?? null,
    created: c.created,
    currency: c.currency ?? null,
  }));
}

export async function listCharges(creds, limit = 10) {
  const data = await stripeFetch(`/charges?limit=${limit}`, creds);
  return (data.data ?? []).map(mapCharge);
}

export async function listSubscriptions(creds, limit = 10) {
  const data = await stripeFetch(`/subscriptions?limit=${limit}&status=all`, creds);
  return (data.data ?? []).map(mapSubscription);
}

// ── Existing: List endpoints ───────────────────────────────────────────────

export async function listInvoices(creds, limit = 10) {
  const data = await stripeFetch(`/invoices?limit=${limit}`, creds);
  return (data.data ?? []).map(mapInvoice);
}

export async function listPaymentIntents(creds, limit = 10) {
  const data = await stripeFetch(`/payment_intents?limit=${limit}`, creds);
  return (data.data ?? []).map(mapPaymentIntent);
}

export async function listProducts(creds, limit = 10) {
  const data = await stripeFetch(`/products?limit=${limit}`, creds);
  return (data.data ?? []).map(mapProduct);
}

export async function listPrices(creds, limit = 10) {
  const data = await stripeFetch(`/prices?limit=${limit}`, creds);
  return (data.data ?? []).map((p) => ({
    id: p.id,
    productId: p.product,
    unitAmount: p.unit_amount != null ? p.unit_amount / 100 : null,
    currency: p.currency?.toUpperCase() ?? '',
    type: p.type,
    recurring: p.recurring
      ? { interval: p.recurring.interval, intervalCount: p.recurring.interval_count }
      : null,
    active: p.active,
    created: p.created,
  }));
}

export async function listRefunds(creds, limit = 10) {
  const data = await stripeFetch(`/refunds?limit=${limit}`, creds);
  return (data.data ?? []).map(mapRefund);
}

export async function listDisputes(creds, limit = 10) {
  const data = await stripeFetch(`/disputes?limit=${limit}`, creds);
  return (data.data ?? []).map((d) => ({
    id: d.id,
    amount: d.amount / 100,
    currency: d.currency?.toUpperCase() ?? '',
    chargeId: d.charge,
    status: d.status,
    reason: d.reason,
    created: d.created,
  }));
}

export async function listPayouts(creds, limit = 10) {
  const data = await stripeFetch(`/payouts?limit=${limit}`, creds);
  return (data.data ?? []).map(mapPayout);
}

export async function listEvents(creds, limit = 10) {
  const data = await stripeFetch(`/events?limit=${limit}`, creds);
  return (data.data ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    objectId: e.data?.object?.id ?? null,
    created: e.created,
  }));
}

export async function listCoupons(creds, limit = 10) {
  const data = await stripeFetch(`/coupons?limit=${limit}`, creds);
  return (data.data ?? []).map(mapCoupon);
}

export async function listPromotionCodes(creds, limit = 10) {
  const data = await stripeFetch(`/promotion_codes?limit=${limit}`, creds);
  return (data.data ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    couponId: p.coupon?.id ?? null,
    active: p.active,
    timesRedeemed: p.times_redeemed,
    created: p.created,
  }));
}

export async function listTaxRates(creds, limit = 10) {
  const data = await stripeFetch(`/tax_rates?limit=${limit}`, creds);
  return (data.data ?? []).map((t) => ({
    id: t.id,
    displayName: t.display_name,
    percentage: t.percentage,
    inclusive: t.inclusive,
    active: t.active,
    country: t.country ?? null,
    state: t.state ?? null,
    created: t.created,
  }));
}

export async function listCheckoutSessions(creds, limit = 10) {
  const data = await stripeFetch(`/checkout/sessions?limit=${limit}`, creds);
  return (data.data ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    paymentStatus: s.payment_status,
    customerId: s.customer ?? null,
    customerEmail: s.customer_email ?? null,
    amountTotal: s.amount_total != null ? s.amount_total / 100 : null,
    currency: s.currency?.toUpperCase() ?? null,
    created: s.created,
  }));
}

export async function listBalanceTransactions(creds, limit = 10) {
  const data = await stripeFetch(`/balance_transactions?limit=${limit}`, creds);
  return (data.data ?? []).map((t) => ({
    id: t.id,
    amount: t.amount / 100,
    fee: t.fee / 100,
    net: t.net / 100,
    currency: t.currency?.toUpperCase() ?? '',
    type: t.type,
    status: t.status,
    created: t.created,
  }));
}

export async function listTransfers(creds, limit = 10) {
  const data = await stripeFetch(`/transfers?limit=${limit}`, creds);
  return (data.data ?? []).map((t) => ({
    id: t.id,
    amount: t.amount / 100,
    currency: t.currency?.toUpperCase() ?? '',
    destination: t.destination,
    description: t.description ?? null,
    created: t.created,
  }));
}

export async function listSetupIntents(creds, limit = 10) {
  const data = await stripeFetch(`/setup_intents?limit=${limit}`, creds);
  return (data.data ?? []).map((s) => ({
    id: s.id,
    status: s.status,
    customerId: s.customer ?? null,
    paymentMethodId: s.payment_method ?? null,
    created: s.created,
  }));
}

export async function listWebhookEndpoints(creds, limit = 10) {
  const data = await stripeFetch(`/webhook_endpoints?limit=${limit}`, creds);
  return (data.data ?? []).map((w) => ({
    id: w.id,
    url: w.url,
    status: w.status,
    enabledEvents: w.enabled_events,
    created: w.created,
  }));
}

// ── Existing: Get by ID ────────────────────────────────────────────────────

export async function getCustomer(creds, id) {
  const c = await stripeFetch(`/customers/${id}`, creds);
  return {
    id: c.id,
    email: c.email ?? null,
    name: c.name ?? null,
    currency: c.currency ?? null,
    balance: c.balance != null ? c.balance / 100 : null,
    delinquent: c.delinquent,
    created: c.created,
  };
}

export async function getCharge(creds, id) {
  return mapCharge(await stripeFetch(`/charges/${id}`, creds));
}

export async function getSubscription(creds, id) {
  return mapSubscription(await stripeFetch(`/subscriptions/${id}`, creds));
}

export async function getInvoice(creds, id) {
  return mapInvoice(await stripeFetch(`/invoices/${id}`, creds));
}

export async function getPaymentIntent(creds, id) {
  return mapPaymentIntent(await stripeFetch(`/payment_intents/${id}`, creds));
}

export async function getProduct(creds, id) {
  return mapProduct(await stripeFetch(`/products/${id}`, creds));
}

export async function getRefund(creds, id) {
  return mapRefund(await stripeFetch(`/refunds/${id}`, creds));
}

export async function getDispute(creds, id) {
  const d = await stripeFetch(`/disputes/${id}`, creds);
  return {
    id: d.id,
    amount: d.amount / 100,
    currency: d.currency?.toUpperCase() ?? '',
    chargeId: d.charge,
    status: d.status,
    reason: d.reason,
    evidenceDueBy: d.evidence_details?.due_by ?? null,
    created: d.created,
  };
}

export async function getPayout(creds, id) {
  return mapPayout(await stripeFetch(`/payouts/${id}`, creds));
}

export async function getCoupon(creds, id) {
  return mapCoupon(await stripeFetch(`/coupons/${id}`, creds));
}

// ── New: 30 additional tools ───────────────────────────────────────────────

// 1. Get connected Stripe account info
export async function getAccount(creds) {
  const a = await stripeFetch('/account', creds);
  return {
    id: a.id,
    email: a.email ?? null,
    country: a.country ?? null,
    defaultCurrency: a.default_currency?.toUpperCase() ?? null,
    chargesEnabled: a.charges_enabled,
    payoutsEnabled: a.payouts_enabled,
    detailsSubmitted: a.details_submitted,
    businessType: a.business_type ?? null,
    created: a.created,
  };
}

// 2. List subscription items for a subscription
export async function listSubscriptionItems(creds, subscriptionId, limit = 10) {
  const qs = subscriptionId
    ? `/subscription_items?subscription=${subscriptionId}&limit=${limit}`
    : `/subscription_items?limit=${limit}`;
  const data = await stripeFetch(qs, creds);
  return (data.data ?? []).map(mapSubscriptionItem);
}

// 3. Get a single subscription item by ID
export async function getSubscriptionItem(creds, id) {
  return mapSubscriptionItem(await stripeFetch(`/subscription_items/${id}`, creds));
}

// 4. List invoice items (line items added to upcoming invoices)
export async function listInvoiceItems(creds, limit = 10) {
  const data = await stripeFetch(`/invoiceitems?limit=${limit}`, creds);
  return (data.data ?? []).map(mapInvoiceItem);
}

// 5. Get a single invoice item by ID
export async function getInvoiceItem(creds, id) {
  return mapInvoiceItem(await stripeFetch(`/invoiceitems/${id}`, creds));
}

// 6. List credit notes
export async function listCreditNotes(creds, limit = 10) {
  const data = await stripeFetch(`/credit_notes?limit=${limit}`, creds);
  return (data.data ?? []).map((cn) => ({
    id: cn.id,
    invoiceId: cn.invoice,
    customerId: cn.customer,
    amount: cn.amount / 100,
    currency: cn.currency?.toUpperCase() ?? '',
    status: cn.status,
    reason: cn.reason ?? null,
    created: cn.created,
  }));
}

// 7. Get a single credit note by ID
export async function getCreditNote(creds, id) {
  const cn = await stripeFetch(`/credit_notes/${id}`, creds);
  return {
    id: cn.id,
    invoiceId: cn.invoice,
    customerId: cn.customer,
    amount: cn.amount / 100,
    currency: cn.currency?.toUpperCase() ?? '',
    status: cn.status,
    reason: cn.reason ?? null,
    memo: cn.memo ?? null,
    created: cn.created,
  };
}

// 8. List shipping rates
export async function listShippingRates(creds, limit = 10) {
  const data = await stripeFetch(`/shipping_rates?limit=${limit}`, creds);
  return (data.data ?? []).map(mapShippingRate);
}

// 9. Get a single shipping rate by ID
export async function getShippingRate(creds, id) {
  return mapShippingRate(await stripeFetch(`/shipping_rates/${id}`, creds));
}

// 10. List top-ups (adding funds to Stripe balance)
export async function listTopups(creds, limit = 10) {
  const data = await stripeFetch(`/topups?limit=${limit}`, creds);
  return (data.data ?? []).map(mapTopup);
}

// 11. Get a single top-up by ID
export async function getTopup(creds, id) {
  return mapTopup(await stripeFetch(`/topups/${id}`, creds));
}

// 12. List Radar reviews (manual review queue)
export async function listReviews(creds, limit = 10) {
  const data = await stripeFetch(`/reviews?limit=${limit}`, creds);
  return (data.data ?? []).map(mapReview);
}

// 13. Get a single Radar review by ID
export async function getReview(creds, id) {
  return mapReview(await stripeFetch(`/reviews/${id}`, creds));
}

// 14. List Radar early fraud warnings
export async function listEarlyFraudWarnings(creds, limit = 10) {
  const data = await stripeFetch(`/radar/early_fraud_warnings?limit=${limit}`, creds);
  return (data.data ?? []).map((w) => ({
    id: w.id,
    chargeId: w.charge,
    paymentIntentId: w.payment_intent ?? null,
    fraudType: w.fraud_type,
    actionable: w.actionable,
    created: w.created,
  }));
}

// 15. List Radar value lists (block/allow lists)
export async function listRadarValueLists(creds, limit = 10) {
  const data = await stripeFetch(`/radar/value_lists?limit=${limit}`, creds);
  return (data.data ?? []).map((vl) => ({
    id: vl.id,
    name: vl.name,
    alias: vl.alias,
    itemType: vl.item_type,
    itemCount: vl.list_items?.total_count ?? null,
    created: vl.created,
  }));
}

// 16. List plans (classic pricing model, still fully supported)
export async function listPlans(creds, limit = 10) {
  const data = await stripeFetch(`/plans?limit=${limit}`, creds);
  return (data.data ?? []).map(mapPlan);
}

// 17. Get a single plan by ID
export async function getPlan(creds, id) {
  return mapPlan(await stripeFetch(`/plans/${id}`, creds));
}

// 18. Get a single payment method by ID
export async function getPaymentMethod(creds, id) {
  const pm = await stripeFetch(`/payment_methods/${id}`, creds);
  return {
    id: pm.id,
    type: pm.type,
    customerId: pm.customer ?? null,
    card: pm.card
      ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          country: pm.card.country ?? null,
        }
      : null,
    billingEmail: pm.billing_details?.email ?? null,
    billingName: pm.billing_details?.name ?? null,
    created: pm.created,
  };
}

// 19. List payment methods for a specific customer
export async function listCustomerPaymentMethods(creds, customerId, limit = 10) {
  const data = await stripeFetch(`/customers/${customerId}/payment_methods?limit=${limit}`, creds);
  return (data.data ?? []).map((pm) => ({
    id: pm.id,
    type: pm.type,
    card: pm.card
      ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        }
      : null,
    billingEmail: pm.billing_details?.email ?? null,
    billingName: pm.billing_details?.name ?? null,
    created: pm.created,
  }));
}

// 20. Search customers using Stripe's Search API
export async function searchCustomers(creds, query, limit = 10) {
  const data = await stripeFetch(
    `/customers/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    creds,
  );
  return (data.data ?? []).map((c) => ({
    id: c.id,
    email: c.email ?? null,
    name: c.name ?? null,
    currency: c.currency ?? null,
    created: c.created,
  }));
}

// 21. Search charges using Stripe's Search API
export async function searchCharges(creds, query, limit = 10) {
  const data = await stripeFetch(
    `/charges/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    creds,
  );
  return (data.data ?? []).map(mapCharge);
}

// 22. Search invoices using Stripe's Search API
export async function searchInvoices(creds, query, limit = 10) {
  const data = await stripeFetch(
    `/invoices/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    creds,
  );
  return (data.data ?? []).map(mapInvoice);
}

// 23. Search payment intents using Stripe's Search API
export async function searchPaymentIntents(creds, query, limit = 10) {
  const data = await stripeFetch(
    `/payment_intents/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    creds,
  );
  return (data.data ?? []).map(mapPaymentIntent);
}

// 24. Search subscriptions using Stripe's Search API
export async function searchSubscriptions(creds, query, limit = 10) {
  const data = await stripeFetch(
    `/subscriptions/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    creds,
  );
  return (data.data ?? []).map(mapSubscription);
}

// 25. Search products using Stripe's Search API
export async function searchProducts(creds, query, limit = 10) {
  const data = await stripeFetch(
    `/products/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    creds,
  );
  return (data.data ?? []).map(mapProduct);
}

// 26. List uploaded files (documents, dispute evidence, etc.)
export async function listFiles(creds, limit = 10) {
  const data = await stripeFetch(`/files?limit=${limit}`, creds);
  return (data.data ?? []).map((f) => ({
    id: f.id,
    filename: f.filename ?? null,
    purpose: f.purpose,
    size: f.size,
    type: f.type ?? null,
    url: f.url ?? null,
    created: f.created,
  }));
}

// 27. Get a single file by ID
export async function getFile(creds, id) {
  const f = await stripeFetch(`/files/${id}`, creds);
  return {
    id: f.id,
    filename: f.filename ?? null,
    purpose: f.purpose,
    size: f.size,
    type: f.type ?? null,
    url: f.url ?? null,
    expiresAt: f.expires_at ?? null,
    created: f.created,
  };
}

// 28. List file links (shareable URLs for uploaded files)
export async function listFileLinks(creds, limit = 10) {
  const data = await stripeFetch(`/file_links?limit=${limit}`, creds);
  return (data.data ?? []).map((fl) => ({
    id: fl.id,
    fileId: fl.file,
    url: fl.url,
    expired: fl.expired,
    expiresAt: fl.expires_at ?? null,
    created: fl.created,
  }));
}

// 29. List payment links
export async function listPaymentLinks(creds, limit = 10) {
  const data = await stripeFetch(`/payment_links?limit=${limit}`, creds);
  return (data.data ?? []).map((pl) => ({
    id: pl.id,
    active: pl.active,
    url: pl.url,
    currency: pl.currency?.toUpperCase() ?? null,
    amountTotal: pl.amount != null ? pl.amount / 100 : null,
    created: pl.created,
  }));
}

// 30. Get a single payment link by ID
export async function getPaymentLink(creds, id) {
  const pl = await stripeFetch(`/payment_links/${id}`, creds);
  return {
    id: pl.id,
    active: pl.active,
    url: pl.url,
    currency: pl.currency?.toUpperCase() ?? null,
    amountTotal: pl.amount != null ? pl.amount / 100 : null,
    afterCompletion: pl.after_completion ?? null,
    allowPromotionCodes: pl.allow_promotion_codes,
    created: pl.created,
  };
}
