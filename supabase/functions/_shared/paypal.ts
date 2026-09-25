const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export function paypalCorsHeaders(): Record<string, string> {
  return { ...corsHeaders };
}

export function paypalApiBase(): string {
  const mode = (Deno.env.get("PAYPAL_MODE") ?? "live").trim().toLowerCase();
  return mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

export function paypalSdkOrigin(): string {
  const mode = (Deno.env.get("PAYPAL_MODE") ?? "live").trim().toLowerCase();
  return mode === "sandbox" ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
}

export function paypalClientId(): string {
  return (Deno.env.get("PAYPAL_CLIENT_ID") ?? "").trim();
}

export async function getPaypalAccessToken(): Promise<{ token: string; apiBase: string; clientId: string }> {
  const clientId = paypalClientId();
  const secret = (Deno.env.get("PAYPAL_CLIENT_SECRET") ?? "").trim();
  if (!clientId || !secret) {
    throw new Error("PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  }
  const apiBase = paypalApiBase();
  const auth = btoa(`${clientId}:${secret}`);
  const res = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json() as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || "PayPal authentication failed");
  }
  return { token: data.access_token, apiBase, clientId };
}

export function formatPaypalAmount(amount: number): string {
  return (Math.round(Number(amount) * 100) / 100).toFixed(2);
}
