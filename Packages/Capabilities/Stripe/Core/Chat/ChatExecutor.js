import * as StripeAPI from '../API/StripeAPI.js';
import { getStripeCredentials, notConnected } from '../Shared/Common.js';
import { runCredentialedChatTool } from '../../../Core/ConnectorUtils.js';

export async function executeStripeChatTool(ctx, toolName, params) {
  return runCredentialedChatTool(ctx, getStripeCredentials, notConnected, async (creds) => {
    // ── Existing ────────────────────────────────────────────────────────────
    if (toolName === 'stripe_get_balance') {
      const balance = await StripeAPI.getBalance(creds);
      return { ok: true, balance };
    }

    if (toolName === 'stripe_list_charges') {
      const charges = await StripeAPI.listCharges(creds, params?.limit ?? 10);
      return { ok: true, charges };
    }

    // ── Existing: List tools ─────────────────────────────────────────────────
    if (toolName === 'stripe_list_customers') {
      const customers = await StripeAPI.listCustomers(creds, params?.limit ?? 10);
      return { ok: true, customers };
    }

    if (toolName === 'stripe_list_subscriptions') {
      const subscriptions = await StripeAPI.listSubscriptions(creds, params?.limit ?? 10);
      return { ok: true, subscriptions };
    }

    if (toolName === 'stripe_list_invoices') {
      const invoices = await StripeAPI.listInvoices(creds, params?.limit ?? 10);
      return { ok: true, invoices };
    }

    if (toolName === 'stripe_list_payment_intents') {
      const paymentIntents = await StripeAPI.listPaymentIntents(creds, params?.limit ?? 10);
      return { ok: true, paymentIntents };
    }

    if (toolName === 'stripe_list_products') {
      const products = await StripeAPI.listProducts(creds, params?.limit ?? 10);
      return { ok: true, products };
    }

    if (toolName === 'stripe_list_prices') {
      const prices = await StripeAPI.listPrices(creds, params?.limit ?? 10);
      return { ok: true, prices };
    }

    if (toolName === 'stripe_list_refunds') {
      const refunds = await StripeAPI.listRefunds(creds, params?.limit ?? 10);
      return { ok: true, refunds };
    }

    if (toolName === 'stripe_list_disputes') {
      const disputes = await StripeAPI.listDisputes(creds, params?.limit ?? 10);
      return { ok: true, disputes };
    }

    if (toolName === 'stripe_list_payouts') {
      const payouts = await StripeAPI.listPayouts(creds, params?.limit ?? 10);
      return { ok: true, payouts };
    }

    if (toolName === 'stripe_list_events') {
      const events = await StripeAPI.listEvents(creds, params?.limit ?? 10);
      return { ok: true, events };
    }

    if (toolName === 'stripe_list_coupons') {
      const coupons = await StripeAPI.listCoupons(creds, params?.limit ?? 10);
      return { ok: true, coupons };
    }

    if (toolName === 'stripe_list_promotion_codes') {
      const promotionCodes = await StripeAPI.listPromotionCodes(creds, params?.limit ?? 10);
      return { ok: true, promotionCodes };
    }

    if (toolName === 'stripe_list_tax_rates') {
      const taxRates = await StripeAPI.listTaxRates(creds, params?.limit ?? 10);
      return { ok: true, taxRates };
    }

    if (toolName === 'stripe_list_checkout_sessions') {
      const checkoutSessions = await StripeAPI.listCheckoutSessions(creds, params?.limit ?? 10);
      return { ok: true, checkoutSessions };
    }

    if (toolName === 'stripe_list_balance_transactions') {
      const balanceTransactions = await StripeAPI.listBalanceTransactions(
        creds,
        params?.limit ?? 10,
      );
      return { ok: true, balanceTransactions };
    }

    if (toolName === 'stripe_list_transfers') {
      const transfers = await StripeAPI.listTransfers(creds, params?.limit ?? 10);
      return { ok: true, transfers };
    }

    if (toolName === 'stripe_list_setup_intents') {
      const setupIntents = await StripeAPI.listSetupIntents(creds, params?.limit ?? 10);
      return { ok: true, setupIntents };
    }

    if (toolName === 'stripe_list_webhook_endpoints') {
      const webhookEndpoints = await StripeAPI.listWebhookEndpoints(creds, params?.limit ?? 10);
      return { ok: true, webhookEndpoints };
    }

    // ── Existing: Get by ID tools ────────────────────────────────────────────
    if (toolName === 'stripe_get_customer') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const customer = await StripeAPI.getCustomer(creds, params.id);
      return { ok: true, customer };
    }

    if (toolName === 'stripe_get_charge') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const charge = await StripeAPI.getCharge(creds, params.id);
      return { ok: true, charge };
    }

    if (toolName === 'stripe_get_subscription') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const subscription = await StripeAPI.getSubscription(creds, params.id);
      return { ok: true, subscription };
    }

    if (toolName === 'stripe_get_invoice') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const invoice = await StripeAPI.getInvoice(creds, params.id);
      return { ok: true, invoice };
    }

    if (toolName === 'stripe_get_payment_intent') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const paymentIntent = await StripeAPI.getPaymentIntent(creds, params.id);
      return { ok: true, paymentIntent };
    }

    if (toolName === 'stripe_get_product') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const product = await StripeAPI.getProduct(creds, params.id);
      return { ok: true, product };
    }

    if (toolName === 'stripe_get_refund') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const refund = await StripeAPI.getRefund(creds, params.id);
      return { ok: true, refund };
    }

    if (toolName === 'stripe_get_dispute') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const dispute = await StripeAPI.getDispute(creds, params.id);
      return { ok: true, dispute };
    }

    if (toolName === 'stripe_get_payout') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const payout = await StripeAPI.getPayout(creds, params.id);
      return { ok: true, payout };
    }

    if (toolName === 'stripe_get_coupon') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const coupon = await StripeAPI.getCoupon(creds, params.id);
      return { ok: true, coupon };
    }

    // ── New: 30 additional tools ─────────────────────────────────────────────

    // 1. Get account
    if (toolName === 'stripe_get_account') {
      const account = await StripeAPI.getAccount(creds);
      return { ok: true, account };
    }

    // 2. List subscription items
    if (toolName === 'stripe_list_subscription_items') {
      const subscriptionItems = await StripeAPI.listSubscriptionItems(
        creds,
        params?.subscriptionId ?? null,
        params?.limit ?? 10,
      );
      return { ok: true, subscriptionItems };
    }

    // 3. Get subscription item
    if (toolName === 'stripe_get_subscription_item') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const subscriptionItem = await StripeAPI.getSubscriptionItem(creds, params.id);
      return { ok: true, subscriptionItem };
    }

    // 4. List invoice items
    if (toolName === 'stripe_list_invoice_items') {
      const invoiceItems = await StripeAPI.listInvoiceItems(creds, params?.limit ?? 10);
      return { ok: true, invoiceItems };
    }

    // 5. Get invoice item
    if (toolName === 'stripe_get_invoice_item') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const invoiceItem = await StripeAPI.getInvoiceItem(creds, params.id);
      return { ok: true, invoiceItem };
    }

    // 6. List credit notes
    if (toolName === 'stripe_list_credit_notes') {
      const creditNotes = await StripeAPI.listCreditNotes(creds, params?.limit ?? 10);
      return { ok: true, creditNotes };
    }

    // 7. Get credit note
    if (toolName === 'stripe_get_credit_note') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const creditNote = await StripeAPI.getCreditNote(creds, params.id);
      return { ok: true, creditNote };
    }

    // 8. List shipping rates
    if (toolName === 'stripe_list_shipping_rates') {
      const shippingRates = await StripeAPI.listShippingRates(creds, params?.limit ?? 10);
      return { ok: true, shippingRates };
    }

    // 9. Get shipping rate
    if (toolName === 'stripe_get_shipping_rate') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const shippingRate = await StripeAPI.getShippingRate(creds, params.id);
      return { ok: true, shippingRate };
    }

    // 10. List top-ups
    if (toolName === 'stripe_list_topups') {
      const topups = await StripeAPI.listTopups(creds, params?.limit ?? 10);
      return { ok: true, topups };
    }

    // 11. Get top-up
    if (toolName === 'stripe_get_topup') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const topup = await StripeAPI.getTopup(creds, params.id);
      return { ok: true, topup };
    }

    // 12. List Radar reviews
    if (toolName === 'stripe_list_reviews') {
      const reviews = await StripeAPI.listReviews(creds, params?.limit ?? 10);
      return { ok: true, reviews };
    }

    // 13. Get Radar review
    if (toolName === 'stripe_get_review') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const review = await StripeAPI.getReview(creds, params.id);
      return { ok: true, review };
    }

    // 14. List early fraud warnings
    if (toolName === 'stripe_list_early_fraud_warnings') {
      const earlyFraudWarnings = await StripeAPI.listEarlyFraudWarnings(creds, params?.limit ?? 10);
      return { ok: true, earlyFraudWarnings };
    }

    // 15. List Radar value lists
    if (toolName === 'stripe_list_radar_value_lists') {
      const valueLists = await StripeAPI.listRadarValueLists(creds, params?.limit ?? 10);
      return { ok: true, valueLists };
    }

    // 16. List plans
    if (toolName === 'stripe_list_plans') {
      const plans = await StripeAPI.listPlans(creds, params?.limit ?? 10);
      return { ok: true, plans };
    }

    // 17. Get plan
    if (toolName === 'stripe_get_plan') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const plan = await StripeAPI.getPlan(creds, params.id);
      return { ok: true, plan };
    }

    // 18. Get payment method
    if (toolName === 'stripe_get_payment_method') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const paymentMethod = await StripeAPI.getPaymentMethod(creds, params.id);
      return { ok: true, paymentMethod };
    }

    // 19. List customer payment methods
    if (toolName === 'stripe_list_customer_payment_methods') {
      if (!params?.customerId)
        return { ok: false, error: 'Missing required parameter: customerId' };
      const paymentMethods = await StripeAPI.listCustomerPaymentMethods(
        creds,
        params.customerId,
        params?.limit ?? 10,
      );
      return { ok: true, paymentMethods };
    }

    // 20. Search customers
    if (toolName === 'stripe_search_customers') {
      if (!params?.query) return { ok: false, error: 'Missing required parameter: query' };
      const customers = await StripeAPI.searchCustomers(creds, params.query, params?.limit ?? 10);
      return { ok: true, customers };
    }

    // 21. Search charges
    if (toolName === 'stripe_search_charges') {
      if (!params?.query) return { ok: false, error: 'Missing required parameter: query' };
      const charges = await StripeAPI.searchCharges(creds, params.query, params?.limit ?? 10);
      return { ok: true, charges };
    }

    // 22. Search invoices
    if (toolName === 'stripe_search_invoices') {
      if (!params?.query) return { ok: false, error: 'Missing required parameter: query' };
      const invoices = await StripeAPI.searchInvoices(creds, params.query, params?.limit ?? 10);
      return { ok: true, invoices };
    }

    // 23. Search payment intents
    if (toolName === 'stripe_search_payment_intents') {
      if (!params?.query) return { ok: false, error: 'Missing required parameter: query' };
      const paymentIntents = await StripeAPI.searchPaymentIntents(
        creds,
        params.query,
        params?.limit ?? 10,
      );
      return { ok: true, paymentIntents };
    }

    // 24. Search subscriptions
    if (toolName === 'stripe_search_subscriptions') {
      if (!params?.query) return { ok: false, error: 'Missing required parameter: query' };
      const subscriptions = await StripeAPI.searchSubscriptions(
        creds,
        params.query,
        params?.limit ?? 10,
      );
      return { ok: true, subscriptions };
    }

    // 25. Search products
    if (toolName === 'stripe_search_products') {
      if (!params?.query) return { ok: false, error: 'Missing required parameter: query' };
      const products = await StripeAPI.searchProducts(creds, params.query, params?.limit ?? 10);
      return { ok: true, products };
    }

    // 26. List files
    if (toolName === 'stripe_list_files') {
      const files = await StripeAPI.listFiles(creds, params?.limit ?? 10);
      return { ok: true, files };
    }

    // 27. Get file
    if (toolName === 'stripe_get_file') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const file = await StripeAPI.getFile(creds, params.id);
      return { ok: true, file };
    }

    // 28. List file links
    if (toolName === 'stripe_list_file_links') {
      const fileLinks = await StripeAPI.listFileLinks(creds, params?.limit ?? 10);
      return { ok: true, fileLinks };
    }

    // 29. List payment links
    if (toolName === 'stripe_list_payment_links') {
      const paymentLinks = await StripeAPI.listPaymentLinks(creds, params?.limit ?? 10);
      return { ok: true, paymentLinks };
    }

    // 30. Get payment link
    if (toolName === 'stripe_get_payment_link') {
      if (!params?.id) return { ok: false, error: 'Missing required parameter: id' };
      const paymentLink = await StripeAPI.getPaymentLink(creds, params.id);
      return { ok: true, paymentLink };
    }

    return null;
  });
}
