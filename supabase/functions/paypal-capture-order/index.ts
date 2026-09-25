/**
 * Capture a PayPal Checkout order and record the donation from pending_paypal_donations.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaypalAccessToken, paypalCorsHeaders } from "../_shared/paypal.ts";
import { recordConfirmedDonation } from "../_shared/recordDonation.ts";

Deno.serve(async (req: Request) => {
  const cors = paypalCorsHeaders();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as { orderId?: string };
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase config");
    }

    const { token, apiBase } = await getPaypalAccessToken();
    const captureRes = await fetch(`${apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const captured = await captureRes.json() as {
      status?: string;
      message?: string;
      details?: Array<{ issue?: string }>;
    };
    if (!captureRes.ok && captured.details?.[0]?.issue !== "ORDER_ALREADY_CAPTURED") {
      console.error("PayPal capture failed:", captured);
      throw new Error(captured.message || captured.details?.[0]?.issue || "PayPal capture failed");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: pending, error: fetchError } = await supabase
      .from("pending_paypal_donations")
      .select("category_id, donor_name, amount, is_anonymous, words_of_support, email")
      .eq("order_id", orderId)
      .maybeSingle();

    if (fetchError) {
      console.error("Pending PayPal lookup failed:", fetchError);
      throw new Error("Failed to load pending donation");
    }

    if (pending) {
      const { duplicate } = await recordConfirmedDonation(supabase, {
        category_id: pending.category_id,
        donor_name: pending.donor_name,
        amount: Number(pending.amount),
        is_anonymous: pending.is_anonymous,
        words_of_support: pending.words_of_support || undefined,
        email: pending.email || undefined,
        paypal_order_id: orderId,
      });
      if (!duplicate) {
        await supabase.from("pending_paypal_donations").delete().eq("order_id", orderId);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paypal-capture-order error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
