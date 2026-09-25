import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface ConfirmedDonation {
  category_id: string;
  donor_name: string;
  amount: number;
  is_anonymous: boolean;
  words_of_support?: string | null;
  email?: string | null;
  paypal_order_id?: string | null;
}

/**
 * Insert a confirmed donation and add the amount to the category total.
 * Duplicate PayPal order ids return { duplicate: true } without updating totals.
 */
export async function recordConfirmedDonation(
  supabase: SupabaseClient,
  donation: ConfirmedDonation,
): Promise<{ duplicate: boolean }> {
  const insert: Record<string, unknown> = {
    category_id: donation.category_id,
    donor_name: donation.donor_name,
    amount: donation.amount,
    is_anonymous: donation.is_anonymous,
    words_of_support: donation.words_of_support || undefined,
    email: donation.email || undefined,
  };
  if (donation.paypal_order_id) {
    insert.paypal_order_id = donation.paypal_order_id;
  }

  const { error: insertError } = await supabase.from("donations").insert(insert);

  if (insertError) {
    if (insertError.code === "23505" && donation.paypal_order_id) {
      return { duplicate: true };
    }
    console.error("Failed to insert donation:", insertError);
    throw new Error("Failed to insert donation");
  }

  const { data: category } = await supabase
    .from("categories")
    .select("current_amount")
    .eq("id", donation.category_id)
    .single();

  if (category) {
    const newAmount = Number(category.current_amount) + Number(donation.amount);
    await supabase
      .from("categories")
      .update({ current_amount: newAmount, updated_at: new Date().toISOString() })
      .eq("id", donation.category_id);
  }

  return { duplicate: false };
}
