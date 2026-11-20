import { createClient } from "npm:@supabase/supabase-js@2.89.0";

// Batch 21: one checkout for plans, tournament entry fees and bills.
// The amount always comes from the database (list_payment_offers / get_checkout_quote), never from the browser.
const origin = "https://localcricket.plateria.in";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

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

    const key = Deno.env.get("RAZORPAY_KEY_ID");
    const secret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!(key?.startsWith("rzp_test_") || key?.startsWith("rzp_live_")) || !secret) {
      return reply({ error: "Checkout is unavailable" }, 503);
    }

    const body = await request.json();
    let amount = 0;
    let description = "";
    const notes: Record<string, string> = { payer_id: user.id };

    if (body.purpose === "registration") {
      if (!uuid.test(body.tournamentId) || !uuid.test(body.teamId)) return reply({ error: "Choose a tournament and team" }, 400);
      const { data, error } = await client.rpc("get_checkout_quote", { p_purpose: "registration", p_ref: body.tournamentId, p_team: body.teamId });
      if (error || !data) return reply({ error: error?.message || "This fee cannot be paid" }, 403);
      amount = data.amount_paise; description = data.description;
      Object.assign(notes, { purpose: "registration", tournament_id: data.tournament_id, team_id: data.team_id });
    } else if (body.billId) {
      if (!uuid.test(body.billId)) return reply({ error: "Bill not found" }, 400);
      const { data, error } = await client.rpc("get_checkout_quote", { p_purpose: "bill", p_ref: body.billId });
      if (error || !data) return reply({ error: error?.message || "This bill cannot be paid" }, 403);
      amount = data.amount_paise; description = data.description;
      Object.assign(notes, { purpose: data.purpose === "ad" ? "ad" : "sponsorship", bill_id: data.bill_id });
      if (data.tournament_id) notes.tournament_id = data.tournament_id;
    } else {
      const { data: offers, error } = await client.rpc("list_payment_offers");
      if (error) return reply({ error: "Paid plans are unavailable" }, 403);
      const offer = offers?.find((row: { id: string }) => row.id === body.offerId);
      if (!offer) return reply({ error: "This plan is unavailable" }, 404);
      amount = offer.amount_paise; description = offer.name;
      Object.assign(notes, { purpose: "membership", offer_id: offer.id });
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) return reply({ error: "Nothing to pay" }, 400);

    const response = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(key + ":" + secret), "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency: "INR", accept_partial: false, description: String(description).slice(0, 200), notes }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return reply({ error: "Could not create checkout" }, 502);
    const { short_url } = await response.json();
    const url = new URL(short_url);
    if (url.protocol !== "https:" || url.hostname !== "rzp.io") return reply({ error: "Invalid checkout link" }, 502);
    return reply({ url: url.href });
  } catch {
    return reply({ error: "Could not create checkout" }, 502);
  }
});
