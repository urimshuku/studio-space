/**
 * Ko-fi payment webhook.
 *
 * Ko-fi POSTs application/x-www-form-urlencoded with a `data` field (JSON string)
 * when a payment is made. We verify KOFI_VERIFICATION_TOKEN, match a pending
 * donation when possible, then record it on donations.
 *
 * Must return HTTP 200 on success so Ko-fi stops retrying.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getDefaultDonationCategoryId,
  recordConfirmedDonation,
} from "../_shared/recordDonation.ts";

interface KofiPayload {
  verification_token?: string;
  message_id?: string;
  type?: string;
  is_public?: boolean;
  from_name?: string;
  message?: string | null;
  amount?: string | number;
  email?: string | null;
  currency?: string;
  kofi_transaction_id?: string;
}

const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

function jsonOk(): Response {
  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

async function parseKofiPayload(req: Request): Promise<KofiPayload | null> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json() as Record<string, unknown>;
    if (body && typeof body.data === "string") {
      return JSON.parse(body.data) as KofiPayload;
    }
    return body as KofiPayload;
  }

  const form = await req.formData();
  const data = form.get("data");
  if (typeof data !== "string" || !data.trim()) return null;
  return JSON.parse(data) as KofiPayload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return jsonOk();
  }

  try {
    const expectedToken = (Deno.env.get("KOFI_VERIFICATION_TOKEN") ?? "").trim();
    if (!expectedToken) {
      console.error("KOFI_VERIFICATION_TOKEN not set");
      return new Response("Webhook not configured", { status: 500 });
    }

    let payload: KofiPayload | null = null;
    try {
      payload = await parseKofiPayload(req);
    } catch (parseErr) {
      console.error("Ko-fi webhook: failed to parse body", parseErr);
      return new Response("Invalid payload", { status: 400 });
    }

    if (!payload || payload.verification_token !== expectedToken) {
      console.error("Ko-fi webhook: missing or invalid verification_token");
      return new Response("Forbidden", { status: 403 });
    }

    const transactionId = (payload.kofi_transaction_id ?? payload.message_id ?? "").trim();
    const paidAmount = Number(payload.amount);
    if (!transactionId || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      console.error("Ko-fi webhook: missing transaction id or amount");
      return jsonOk();
    }

    const type = (payload.type ?? "Donation").trim();
    if (type !== "Donation" && type !== "Subscription") {
      console.log("Ko-fi webhook: ignoring type", type);
      return jsonOk();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase config");
      return new Response("Server misconfigured", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const webhookEmail = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const since = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();

    let pending: {
      order_id: string;
      category_id: string;
      donor_name: string;
      amount: number;
      is_anonymous: boolean;
      words_of_support: string | null;
      email: string;
    } | null = null;

    if (webhookEmail) {
      const { data: rows, error: pendingError } = await supabase
        .from("pending_kofi_donations")
        .select("order_id, category_id, donor_name, amount, is_anonymous, words_of_support, email")
        .ilike("email", webhookEmail)
        .gte("created_at", since)
        .order("created_at", { ascending: false });

      if (pendingError) {
        console.error("Ko-fi webhook: pending lookup failed", pendingError);
        return new Response("Lookup failed", { status: 500 });
      }

      const list = rows ?? [];
      const amountMatch = list.find((row) => Math.abs(Number(row.amount) - paidAmount) < 0.05);
      pending = (amountMatch ?? list[0] ?? null) as typeof pending;
    }

    let categoryId = pending?.category_id ?? null;
    if (!categoryId) {
      categoryId = await getDefaultDonationCategoryId(supabase);
    }
    if (!categoryId) {
      console.error("Ko-fi webhook: no donation category available");
      return new Response("No category", { status: 500 });
    }

    const donorName = pending
      ? pending.donor_name
      : (payload.is_public === false || !String(payload.from_name ?? "").trim())
        ? "Anonymous"
        : String(payload.from_name).trim();

    const { duplicate } = await recordConfirmedDonation(supabase, {
      category_id: categoryId,
      donor_name: donorName,
      amount: paidAmount,
      is_anonymous: pending ? pending.is_anonymous : payload.is_public === false,
      words_of_support: pending?.words_of_support || payload.message || undefined,
      email: pending?.email || webhookEmail || undefined,
      kofi_transaction_id: transactionId,
    });

    if (duplicate) {
      if (pending?.order_id) {
        await supabase.from("pending_kofi_donations").delete().eq("order_id", pending.order_id);
      }
      return jsonOk();
    }

    if (pending?.order_id) {
      await supabase.from("pending_kofi_donations").delete().eq("order_id", pending.order_id);
    }

    if (payload.currency && payload.currency.toUpperCase() !== "EUR") {
      console.warn("Ko-fi webhook: non-EUR currency", payload.currency, "amount", paidAmount);
    }

    return jsonOk();
  } catch (err) {
    console.error("kofi-webhook error:", err);
    return new Response("Error", { status: 500 });
  }
});
