import { createClient } from "npm:@supabase/supabase-js@2.89.0";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const apiSecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!secret || !keyId?.startsWith("rzp_test_") || !apiSecret) return new Response(null, { status: 503 });

  const signature = request.headers.get("x-razorpay-signature") || "";
  if (!/^[a-f0-9]{64}$/i.test(signature)) return new Response(null, { status: 401 });
  const body = await request.arrayBuffer();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signatureBytes = Uint8Array.from(signature.match(/../g)!, part => parseInt(part, 16));
  if (!await crypto.subtle.verify("HMAC", key, signatureBytes, body)) return new Response(null, { status: 401 });

  try {
    const event = JSON.parse(new TextDecoder().decode(body));
    if (event.event !== "payment_link.paid") return new Response(null, { status: 204 });
    const link = event.payload?.payment_link?.entity;
    const paymentId = event.payload?.payment?.entity?.id;
    const payer = link?.notes?.payer_id;
    const offerId = link?.notes?.offer_id;
    const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
    if (!uuid.test(payer) || !uuid.test(offerId)) return new Response(null, { status: 204 });
    if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId) || link.status !== "paid"
        || link.currency !== "INR" || !Number.isSafeInteger(link.amount)
        || link.amount <= 0 || link.amount_paid !== link.amount || !link.order_id) {
      return new Response(null, { status: 422 });
    }

    const check = await fetch("https://api.razorpay.com/v1/payments/" + paymentId, {
      headers: { Authorization: "Basic " + btoa(keyId + ":" + apiSecret) },
      signal: AbortSignal.timeout(10000),
    });
    if (!check.ok) return new Response(null, { status: 502 });
    const payment = await check.json();
    if (payment.id !== paymentId || payment.order_id !== link.order_id || payment.status !== "captured"
        || payment.amount !== link.amount || payment.currency !== "INR") {
      return new Response(null, { status: 422 });
    }

    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await client.rpc("record_razorpay_test_payment", {
      p_payer: payer, p_payment: paymentId, p_description: String(link.description || "Paid plan").slice(0, 100),
      p_amount: payment.amount, p_captured_at: new Date(event.created_at * 1000).toISOString(),
    });
    return new Response(null, { status: error ? 500 : 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
});
