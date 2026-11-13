import { createClient } from "npm:@supabase/supabase-js@2.89.0";

const origin = "https://localcricket.plateria.in";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  const reply = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return reply({ error: "Sign in first" }, 401);

  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return reply({ error: "Sign in first" }, 401);

    const { offerId } = await request.json();
    const { data: offers, error } = await client.rpc("list_payment_offers");
    if (error) return reply({ error: "Paid plans are unavailable" }, 403);
    const offer = offers?.find((row: { id: string }) => row.id === offerId);
    if (!offer) return reply({ error: "This plan is unavailable" }, 404);

    const key = Deno.env.get("RAZORPAY_KEY_ID");
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!key?.startsWith("rzp_test_") || !secret) {
      return reply({ error: "Test checkout is unavailable" }, 503);
    }

    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(key + ":" + secret), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: offer.amount_paise,
        currency: "INR",
        accept_partial: false,
        description: offer.name,
        notes: { payer_id: user.id, offer_id: offer.id },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return reply({ error: "Could not create test checkout" }, 502);
    const { short_url } = await response.json();
    const url = new URL(short_url);
    if (url.protocol !== "https:" || url.hostname !== "rzp.io") {
      return reply({ error: "Invalid checkout link" }, 502);
    }
    return reply({ url: url.href });
  } catch {
    return reply({ error: "Could not create test checkout" }, 502);
  }
});
