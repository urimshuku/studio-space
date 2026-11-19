/**
 * Sign in the donation-hub admin.
 * Username is checked here. The password is checked by Supabase Auth.
 * ADMIN_EMAIL and ADMIN_USERNAME live in Edge secrets, not in the website.
 */
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
    const expectedUsername = Deno.env.get("ADMIN_USERNAME")?.trim();
    const adminEmail = Deno.env.get("ADMIN_EMAIL")?.trim();
    if (!supabaseUrl || !anonKey || !expectedUsername || !adminEmail) {
      return json({ error: "Admin login is not configured" }, 500);
    }

    const body = await req.json() as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || username !== expectedUsername) {
      return json({ error: "Invalid username or password" }, 401);
    }

    const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const token = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      expires_at?: number;
      token_type?: string;
    };
    if (!tokenRes.ok || !token.access_token || !token.refresh_token) {
      return json({ error: "Invalid username or password" }, 401);
    }

    return json({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_in: token.expires_in ?? null,
      expires_at: token.expires_at ?? null,
      token_type: token.token_type ?? "bearer",
    }, 200);
  } catch (err) {
    console.error("admin-login error:", err);
    return json({ error: "Could not sign in" }, 500);
  }
});
