import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tFor } from "@/lib/i18n";
import { needsMfaChallenge } from "@/lib/supabase/mfa";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { BrandMark } from "@/components/ui/BrandMark";
import { verifyMfaChallenge, useMfaRecoveryCode } from "./actions";

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; recovery?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await needsMfaChallenge(supabase))) redirect("/");

  const { error, recovery } = await searchParams;
  const locale = await getRequestLocale();
  const t = tFor(locale);
  const isRecovery = recovery === "1";

  const errorMsg = !error
    ? null
    : error === "1"
      ? t(isRecovery ? "mfa.errInvalidRecovery" : "mfa.errInvalidCode")
      : decodeURIComponent(error);

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandMark size={52} className="mx-auto mb-3" />
          <p className="text-gold-light text-xs tracking-[0.3em] uppercase mb-1">Finéticap</p>
          <h1 className="text-white text-2xl font-semibold">
            {t(isRecovery ? "mfa.recoveryTitle" : "mfa.challengeTitle")}
          </h1>
          <p className="text-white/60 text-sm mt-1">
            {t(isRecovery ? "mfa.recoveryWarning" : "mfa.challengeDesc")}
          </p>
        </div>
        <Card className="bg-white">
          <CardBody>
            {errorMsg && (
              <p className="mb-4 text-sm text-red bg-red/10 rounded-lg px-3 py-2">{errorMsg}</p>
            )}
            {isRecovery ? (
              <form action={useMfaRecoveryCode} className="space-y-4">
                <Field label={t("mfa.recoveryLabel")}>
                  <Input
                    name="recoveryCode"
                    required
                    autoFocus
                    placeholder="XXXXX-XXXXX"
                    autoComplete="off"
                  />
                </Field>
                <Button type="submit" className="w-full">
                  {t("mfa.submit")}
                </Button>
              </form>
            ) : (
              <form action={verifyMfaChallenge} className="space-y-4">
                <Field label={t("mfa.codeLabel")}>
                  <Input
                    name="code"
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </Field>
                <Button type="submit" className="w-full">
                  {t("mfa.submit")}
                </Button>
              </form>
            )}
          </CardBody>
        </Card>
        <p className="text-center text-white/70 text-sm mt-4">
          <Link href={isRecovery ? "/mfa-challenge" : "/mfa-challenge?recovery=1"} className="hover:underline">
            {t(isRecovery ? "mfa.backToCode" : "mfa.useRecovery")}
          </Link>
        </p>
      </div>
    </div>
  );
}
