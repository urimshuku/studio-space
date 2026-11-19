/**
 * Record a donation for the signed-in admin only.
 * The service role writes the row and updates the category total.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getServiceRoleClient } from "../_shared/supabaseService.ts";
import { recordConfirmedDonation } from "../_shared/recordDonation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
    const adminEmail = Deno.env.get("ADMIN_EMAIL")?.trim().toLowerCase();
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!supabaseUrl || !anonKey || !adminEmail || !authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Not signed in" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const signedInEmail = userData.user?.email?.trim().toLowerCase();
    if (userError || !signedInEmail || signedInEmail !== adminEmail) {
      return json({ error: "Not signed in" }, 401);
    }

    const body = await req.json() as Record<string, unknown>;
    const categoryId = typeof body.category_id === "string" ? body.category_id.trim() : "";
    const amount = Number(body.amount);
    const isAnonymous = body.is_anonymous === true;
    const donorName = isAnonymous
      ? "Anonymous"
      : typeof body.donor_name === "string"
        ? body.donor_name.trim()
        : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const words = typeof body.words_of_support === "string" ? body.words_of_support.trim().slice(0, 150) : "";
    const createdAt = typeof body.created_at === "string" ? body.created_at.trim() : "";

    if (!categoryId || !donorName || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return json({ error: "Category, donor name, and a valid amount are required" }, 400);
    }
    if (email && !isEmail(email)) {
      return json({ error: "Enter a valid email address" }, 400);
    }

    let receivedAt: string | null = null;
    if (createdAt) {
      const parsed = new Date(createdAt);
      const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.parse("2000-01-01") || parsed.getTime() > tomorrow) {
        return json({ error: "Enter the date the transfer arrived" }, 400);
      }
      receivedAt = parsed.toISOString();
    }

    const supabase = getServiceRoleClient();
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .maybeSingle();
    if (categoryError || !category) {
      return json({ error: "Category not found" }, 400);
    }

    await recordConfirmedDonation(supabase, {
      category_id: categoryId,
      donor_name: donorName,
      amount,
      is_anonymous: isAnonymous,
      email: email || null,
      words_of_support: words || null,
      created_at: receivedAt,
    });

    return json({ ok: true }, 200);
  } catch (err) {
    console.error("admin-record-donation error:", err);
    return json({ error: "Could not save the donation" }, 500);
  }
});
