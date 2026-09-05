"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function verifyMfaChallenge(formData: FormData) {
  const code = String(formData.get("code") || "").trim();
  const supabase = await createClient();

  const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
  const factorId = factorsData?.totp?.[0]?.id;
  if (factorsError || !factorId) {
    redirect("/mfa-challenge?error=1");
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    redirect(`/mfa-challenge?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function useMfaRecoveryCode(formData: FormData) {
  const code = String(formData.get("recoveryCode") || "").trim();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: valid, error: rpcError } = await supabase.rpc("mfa_consume_recovery_code", {
    p_code: code,
  });
  if (rpcError || !valid) {
    redirect("/mfa-challenge?recovery=1&error=1");
  }

  // Un código de recuperación válido no puede "falsear" AAL2 (ese claim lo
  // firma GoTrue, ninguna función de Postgres puede emitirlo) — en su lugar
  // autoriza a desactivar el factor TOTP vía el Admin API (única forma
  // documentada de remover un factor sin ya estar en AAL2). Esto cierra
  // todas las sesiones activas del usuario, así que lo mandamos a
  // loguearse de nuevo.
  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factorId = factorsData?.totp?.[0]?.id;
  if (factorId) {
    const admin = createAdminClient();
    await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId: user.id });
  }

  await supabase.auth.signOut();
  redirect("/login?mfaDisabled=1");
}
