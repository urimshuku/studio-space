/**
 * Ko-fi payment initiation (PayPal / card).
 *
 * Stores a pending donation, then the frontend sends the donor to Ko-fi.
 * kofi-webhook moves pending → donations when Ko-fi confirms payment.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { upsertUserMarketingOptIn } from "../_shared/upsertUserMarketingOptIn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function kofiPageUrl(): string {
  const username = (Deno.env.get("KOFI_USERNAME") ?? "studiospace").trim().replace(/^@/, "");
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, "") || "studiospace";
  return `https://ko-fi.com/${safe}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase config");
    }

    const body = await req.json() as Record<string, unknown>;
    const {
      category_id,
      donor_name,
      email,
      amount,
      is_anonymous,
      words_of_support,
    } = body;

    const marketingOptIn =
      typeof body.marketingOptIn === "boolean"
        ? body.marketingOptIn
        : typeof body.marketing_opt_in === "boolean"
          ? body.marketing_opt_in
          : false;

    if (!category_id || donor_name == null || amount == null || Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: category_id, donor_name, amount required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return new Response(
        JSON.stringify({ error: "Email address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const orderId = crypto.randomUUID();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingRows, error: existingError } = await supabase
      .from("pending_kofi_donations")
      .select("order_id")
      .ilike("email", normalizedEmail)
      .eq("category_id", category_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingError) {
      console.error("Failed to check existing pending Ko-fi donation:", existingError);
      throw new Error("Failed to check existing pending donation");
    }

    const existingOrder = existingRows?.[0]?.order_id as string | undefined;
    const pendingPayload = {
      order_id: orderId,
      category_id,
      donor_name: body.is_anonymous ? "Anonymous" : donor_name,
      email: normalizedEmail.slice(0, 255),
      amount: Number(amount),
      is_anonymous: Boolean(is_anonymous),
      words_of_support: typeof words_of_support === "string"
        ? words_of_support.trim().slice(0, 150) || null
        : null,
    };

    if (existingOrder) {
      const { error: updateError } = await supabase
        .from("pending_kofi_donations")
        .update({
          donor_name: pendingPayload.donor_name,
          email: pendingPayload.email,
          amount: pendingPayload.amount,
          is_anonymous: pendingPayload.is_anonymous,
          words_of_support: pendingPayload.words_of_support,
        })
        .eq("order_id", existingOrder);
      if (updateError) {
        console.error("Failed to update pending Ko-fi donation:", updateError);
        throw new Error("Failed to update pending donation");
      }
    } else {
      const { error: insertError } = await supabase.from("pending_kofi_donations").insert(pendingPayload);
      if (insertError) {
        console.error("Failed to store pending Ko-fi donation:", insertError);
        throw new Error("Failed to store pending donation");
      }
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
      console.error("kofi-pay-url: pending saved but users marketing_opt_in upsert failed:", userErr);
    }

    const message = existingOrder
      ? "You're already signed up. We updated your previous request."
      : undefined;
    return new Response(
      JSON.stringify({
        payUrl: kofiPageUrl(),
        orderId: existingOrder || orderId,
        alreadySignedUp: Boolean(existingOrder),
        updatedExisting: Boolean(existingOrder),
        message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("kofi-pay-url error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
