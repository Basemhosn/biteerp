// ── BiteERP Payment Gateway Integration ──────────────────────
// Supports: Tap Payments, Paymob UAE, Network International (N-Genius)
// Physical terminal integration via webhook callback

// ── Gateway config (stored in Supabase settings) ─────────────
export const GATEWAYS = [
  {
    id:          'tap',
    name:        'Tap Payments',
    logo:        '💳',
    region:      'GCC',
    docs:        'https://developers.tap.company',
    fields:      ['secret_key', 'publishable_key'],
    supportsQR:  true,
    supportsApplePay: true,
  },
  {
    id:          'paymob',
    name:        'Paymob UAE',
    logo:        '💳',
    region:      'UAE / MENA',
    docs:        'https://developers.paymob.com/uae',
    fields:      ['api_key', 'integration_id', 'hmac_secret'],
    supportsQR:  false,
    supportsApplePay: false,
  },
  {
    id:          'ngenius',
    name:        'Network International (N-Genius)',
    logo:        '💳',
    region:      'UAE',
    docs:        'https://developer.network.global',
    fields:      ['api_key', 'outlet_ref', 'realm'],
    supportsQR:  true,
    supportsApplePay: true,
  },
  {
    id:          'checkout',
    name:        'Checkout.com',
    logo:        '💳',
    region:      'Global',
    docs:        'https://api-reference.checkout.com',
    fields:      ['secret_key', 'publishable_key'],
    supportsQR:  false,
    supportsApplePay: true,
  },
]

// ── Tap Payments ─────────────────────────────────────────────
// https://developers.tap.company/docs
export async function createTapCharge(publishableKey, amount, currency = 'AED', orderId, customer = {}) {
  // Tap uses a hosted payment page / iframe
  // We create a charge server-side and return the payment URL
  // In production this should go through a Supabase Edge Function to keep secret_key safe
  const response = await fetch('https://api.tap.company/v2/charges', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publishableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      currency,
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: `Order ${orderId}`,
      reference: { transaction: orderId, order: orderId },
      customer: { first_name: customer.name?.split(' ')[0] ?? '', email: customer.email ?? '', phone: { country_code: '971', number: customer.phone?.replace(/\D/g,'') ?? '' } },
      source: { id: 'src_all' },
      post: { url: window.location.origin + '/api/payment-webhook' },
      redirect: { url: window.location.origin + '/pos?payment=complete' },
    }),
  })
  const data = await response.json()
  if (data.transaction?.url) return { url: data.transaction.url, chargeId: data.id }
  throw new Error(data.errors?.[0]?.description ?? 'Tap payment creation failed')
}

// ── N-Genius (Network International) ─────────────────────────
// https://developer.network.global/home
export async function createNGeniusOrder(apiKey, outletRef, realm, amount, currency = 'AED', orderId) {
  // Step 1: Get access token
  const tokenRes = await fetch(`https://api-gateway.sandbox.ngenius-payments.com/identity/auth/access-token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${btoa(apiKey + ':')}`, 'Content-Type': 'application/vnd.ni-identity.v1+json' },
    body: JSON.stringify({ realmName: realm }),
  })
  const { access_token } = await tokenRes.json()
  if (!access_token) throw new Error('N-Genius auth failed')

  // Step 2: Create order
  const orderRes = await fetch(`https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/${outletRef}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/vnd.ni-payment.v2+json',
      'Accept': 'application/vnd.ni-payment.v2+json',
    },
    body: JSON.stringify({
      action: 'SALE',
      amount: { currencyCode: currency, value: Math.round(amount * 100) },
      merchantAttributes: { redirectUrl: window.location.origin + '/pos?payment=complete' },
      billingAddress: {},
    }),
  })
  const order = await orderRes.json()
  const payUrl = order._links?.payment?.href
  if (!payUrl) throw new Error('N-Genius order creation failed')
  return { url: payUrl, orderId: order.reference }
}

// ── Paymob UAE ────────────────────────────────────────────────
// https://developers.paymob.com/uae
export async function createPaymobIntention(apiKey, integrationId, amount, currency = 'AED', orderId) {
  // Paymob Unified Intention API
  const res = await fetch('https://uae.paymob.com/v1/intention/', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency,
      payment_methods: [parseInt(integrationId)],
      items: [{ name: `Order ${orderId}`, amount: Math.round(amount * 100), description: 'POS Sale', quantity: 1 }],
      billing_data: { first_name: 'Guest', last_name: 'Customer', email: 'NA', phone_number: 'NA' },
      special_reference: orderId,
      notification_url: window.location.origin + '/api/paymob-webhook',
      redirection_url: window.location.origin + '/pos?payment=complete',
    }),
  })
  const data = await res.json()
  if (data.client_secret) {
    const payUrl = `https://uae.paymob.com/unifiedcheckout/?publicKey=${data.public_key}&clientSecret=${data.client_secret}`
    return { url: payUrl, intentionId: data.id }
  }
  throw new Error('Paymob intention creation failed')
}

// ── QR Payment (generic) ─────────────────────────────────────
// Generates a QR code payment link for any gateway
export function openPaymentWindow(url, onSuccess, onError) {
  const width  = Math.min(500, window.screen.width - 40)
  const height = Math.min(700, window.screen.height - 40)
  const left   = (window.screen.width - width) / 2
  const top    = (window.screen.height - height) / 2
  const popup  = window.open(url, 'payment', `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no`)

  // Poll for completion
  const timer = setInterval(() => {
    try {
      if (popup?.closed) {
        clearInterval(timer)
        // Check URL for success params
        onSuccess?.()
      }
    } catch (e) {
      clearInterval(timer)
      onError?.(e)
    }
  }, 500)

  return popup
}

// ── Physical terminal integration ────────────────────────────
// For physical card machines (Verifone, Ingenico, PAX via N-Genius)
// The terminal is triggered via a local API bridge running on the POS device
export async function triggerPhysicalTerminal(bridgeUrl, amount, currency = 'AED', orderId) {
  // The bridge is a small local service (Node.js or Go) running on the POS tablet/PC
  // It communicates with the physical card terminal via serial/USB
  try {
    const res = await fetch(`${bridgeUrl}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, reference: orderId }),
      signal: AbortSignal.timeout(120000), // 2 min timeout for card insertion
    })
    const data = await res.json()
    return data // { success: true, receiptData: {...}, authCode: 'XXXXXX' }
  } catch (e) {
    throw new Error('Terminal connection failed: ' + e.message)
  }
}

// ── Simulation mode ───────────────────────────────────────────
export async function simulatePayment(amount, method = 'card') {
  await new Promise(r => setTimeout(r, 2000)) // simulate 2s processing
  return {
    success:    true,
    authCode:   Math.random().toString(36).slice(2,8).toUpperCase(),
    reference:  'SIM-' + Date.now(),
    amount,
    method,
    timestamp:  new Date().toISOString(),
  }
}
