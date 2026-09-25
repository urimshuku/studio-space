/**
 * Create a PayPal Checkout order for a one-time donation.
 * Amount, name, email, and message stay on Studio Space; PayPal only takes payment.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { formatPaypalAmount, getPaypalAccessToken, paypalCorsHeaders } from "../_shared/paypal.ts";
import { upsertUserMarketingOptIn } from "../_shared/upsertUserMarketingOptIn.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase config");
    }

    const body = await req.json() as Record<string, unknown>;
    const { category_id, donor_name, email, amount, is_anonymous, words_of_support } = body;
    const marketingOptIn =
      typeof body.marketingOptIn === "boolean"
        ? body.marketingOptIn
        : typeof body.marketing_opt_in === "boolean"
          ? body.marketing_opt_in
          : false;

    if (!category_id || donor_name == null || amount == null || Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: category_id, donor_name, amount required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "Email address is required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const amountValue = formatPaypalAmount(Number(amount));
    const normalizedEmail = String(email).trim().toLowerCase();
    const { token, apiBase } = await getPaypalAccessToken();

    const orderRes = await fetch(`${apiBase}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        payer: {
          email_address: normalizedEmail,
        },
        purchase_units: [
          {
            description: "Donation to Studio Space",
            soft_descriptor: "STUDIO SPACE",
            items: [
              {
                name: "Donation",
                quantity: "1",
                category: "DONATION",
                unit_amount: { currency_code: "EUR", value: amountValue },
              },
            ],
            amount: {
              currency_code: "EUR",
              value: amountValue,
              breakdown: {
                item_total: { currency_code: "EUR", value: amountValue },
              },
            },
          },
        ],
        application_context: {
          brand_name: "Studio Space",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          landing_page: "NO_PREFERENCE",
        },
      }),
    });
    const order = await orderRes.json() as { id?: string; message?: string; details?: Array<{ issue?: string }> };
    if (!orderRes.ok || !order.id) {
      console.error("PayPal create order failed:", order);
      throw new Error(order.message || order.details?.[0]?.issue || "Failed to start PayPal checkout");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const pendingPayload = {
      order_id: order.id,
      category_id,
      donor_name: body.is_anonymous ? "Anonymous" : donor_name,
      email: normalizedEmail.slice(0, 255),
      amount: Number(amountValue),
      is_anonymous: Boolean(is_anonymous),
      words_of_support: typeof words_of_support === "string"
        ? words_of_support.trim().slice(0, 150) || null
        : null,
    };

    const { error: insertError } = await supabase.from("pending_paypal_donations").insert(pendingPayload);
    if (insertError) {
      console.error("Failed to store pending PayPal donation:", insertError);
      throw new Error("Failed to store pending donation");
    }

    const donationDisplayName =
      Boolean(is_anonymous) || !String(donor_name ?? "").trim()
        ? undefined
        : String(donor_name).trim();

    try {
      await upsertUserMarketingOptIn(normalizedEmail, marketingOptIn, {
        supabaseClient: supabase,
        displayName: donationDisplayName,
      });
    } catch (userErr) {
      console.error("paypal-create-order: pending saved but marketing opt-in failed:", userErr);
    }

    return new Response(JSON.stringify({ orderId: order.id }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("paypal-create-order error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
