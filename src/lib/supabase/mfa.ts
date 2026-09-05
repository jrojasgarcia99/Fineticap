import type { SupabaseClient } from "@supabase/supabase-js";

/** true si la sesión actual necesita completar el desafío de MFA (tiene un
 *  factor TOTP verificado pero todavía está en AAL1) antes de continuar. */
export async function needsMfaChallenge(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.nextLevel !== data.currentLevel;
}
