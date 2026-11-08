const apiBase = () => process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
export const isPayPalConfigured = () => Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && ['live','sandbox'].includes(process.env.PAYPAL_ENV));
export async function paypalRequest(endpoint, {method='GET', body, requestId} = {}) {
  if (!isPayPalConfigured()) throw new Error('PayPal is not configured.');
  const auth = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method:'POST', headers:{Authorization:`Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials', signal:AbortSignal.timeout(15000),
  });
  const token = await auth.json();
  if (!auth.ok || !token.access_token) throw new Error('PayPal connection unavailable. Please try again later.');
  const response = await fetch(`${apiBase()}${endpoint}`, {
    method, headers:{Authorization:`Bearer ${token.access_token}`, 'Content-Type':'application/json', Prefer:'return=representation', ...(requestId ? {'PayPal-Request-Id':requestId} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (!response.ok) {
    // Never log payer data, tokens, or raw provider responses.
    const issue = data.details?.[0]?.issue;
    if (issue === 'INSTRUMENT_DECLINED') throw new Error('PayPal declined this funding source. Try another payment method in PayPal.');
    if (issue === 'PAYER_CANNOT_PAY') throw new Error('PayPal cannot complete this payment for this account.');
    throw new Error('PayPal could not complete the request. Retry safely; do not start a second payment if one is pending.');
  }
  return data;
}
