/**
 * Public PayPal SDK config (client id only, plus an optional client token for card fields).
 */
import {
  getPaypalAccessToken,
  paypalClientId,
  paypalCorsHeaders,
  paypalSdkOrigin,
} from "../_shared/paypal.ts";

Deno.serve(async (req: Request) => {
  const cors = paypalCorsHeaders();
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const clientId = paypalClientId();
  if (!clientId) {
    return new Response(JSON.stringify({ error: "PayPal is not configured" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let clientToken: string | null = null;
  try {
    const { token, apiBase } = await getPaypalAccessToken();
    const tokenRes = await fetch(`${apiBase}/v1/identity/generate-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept-Language": "en_US",
      },
    });
    const tokenData = await tokenRes.json() as { client_token?: string };
    if (tokenRes.ok && tokenData.client_token) {
      clientToken = tokenData.client_token;
    }
  } catch (err) {
    console.error("paypal-config: client token skipped", err);
  }

  const sdkUrl =
    `${paypalSdkOrigin()}/sdk/js?client-id=${encodeURIComponent(clientId)}` +
    "&currency=EUR&intent=capture&components=buttons,card-fields&enable-funding=card&commit=true";

  return new Response(JSON.stringify({ clientId, sdkUrl, clientToken }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
