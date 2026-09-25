/**
 * Paysera callback (IPN): GET request with encoded data + ss1 signature.
 *
 * Paysera calls this URL after the user completes or cancels payment.
 * We must validate the signature before trusting the payload, then:
 * - On status=1 (success): move pending_paysera_donations → donations, update category, return "OK"
 * - Otherwise: return "OK" anyway (Paysera expects OK to stop retries); do not confirm order
 *
 * We store only non-sensitive data: amount, status, order reference, donor name, email.
 * No card or bank details are ever stored.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import md5 from "npm:md5@2.3.0";
import { recordConfirmedDonation } from "../_shared/recordDonation.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "GET") {
    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  try {
    const signPassword = (Deno.env.get("PAYSERA_SIGN_PASSWORD") ?? "").trim();
    if (!signPassword) {
      console.error("PAYSERA_SIGN_PASSWORD not set");
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const url = new URL(req.url);
    const dataParam = url.searchParams.get("data");
    const ss1Param = url.searchParams.get("ss1");

    if (!dataParam || !ss1Param) {
      console.error("Paysera callback missing data or ss1");
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // Validate callback signature: ss1 = MD5(data + sign_password)
    const expectedSs1 = (md5 as (s: string) => string)(dataParam + signPassword);
    if (expectedSs1.toLowerCase() !== ss1Param.toLowerCase()) {
      console.error("Paysera callback invalid ss1");
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // Decode payload: base64 with -_ → +/, then parse query string
    const decoded = atob(dataParam.replace(/-/g, "+").replace(/_/g, "/"));
    const params = new URLSearchParams(decoded);
    const orderid = params.get("orderid");
    const status = params.get("status");

    // Only status 1 = successful payment; do not confirm on cancel/failure
    if (status !== "1" || !orderid) {
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase config");
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: pending, error: fetchError } = await supabase
      .from("pending_paysera_donations")
      .select("category_id, donor_name, amount, is_anonymous, words_of_support, email")
      .eq("order_id", orderid)
      .single();

    if (fetchError || !pending) {
      console.error("Pending Paysera donation not found:", orderid, fetchError);
      return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const amountEur = Number(pending.amount);
    await recordConfirmedDonation(supabase, {
      category_id: pending.category_id,
      donor_name: pending.donor_name,
      amount: amountEur,
      is_anonymous: pending.is_anonymous,
      words_of_support: pending.words_of_support || undefined,
      email: pending.email || undefined,
    });

    await supabase.from("pending_paysera_donations").delete().eq("order_id", orderid);

    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (err) {
    console.error("paysera-callback error:", err);
    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
});
