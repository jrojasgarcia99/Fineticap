import Link from "next/link";
import { login } from "./actions";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tFor } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";
import { AuthLangFlags } from "@/components/auth/AuthLangFlags";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { BrandMark } from "@/components/ui/BrandMark";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; deleted?: string; mfaDisabled?: string }>;
}) {
  const { error, deleted, mfaDisabled } = await searchParams;
  const locale = await getRequestLocale();
  const t = tFor(locale);
  const errorMsg =
    error === "confirm" ? t("err.confirmLink") : error ? decodeURIComponent(error) : null;

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-navy px-4 py-10">
      <AuthLangFlags current={locale} />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandMark size={52} className="mx-auto mb-3" />
          <p className="text-gold-light text-xs tracking-[0.3em] uppercase mb-1">Finéticap</p>
          <h1 className="text-white text-2xl font-semibold">{t("nav.presupuesto")}</h1>
          <p className="text-white/60 text-sm mt-1">{t("auth.tagline")}</p>
        </div>
        <Card className="bg-white">
          <CardBody>
            {deleted && (
              <p className="mb-4 text-sm text-green bg-green/10 rounded-lg px-3 py-2">
                {t("auth.accountDeleted")}
              </p>
            )}
            {mfaDisabled && (
              <p className="mb-4 text-sm text-green bg-green/10 rounded-lg px-3 py-2">
                {t("auth.mfaDisabledNotice")}
              </p>
            )}
            <form action={login} className="space-y-4">
              <Field label={t("auth.email")}>
                <Input type="email" name="email" required autoComplete="email" />
              </Field>
              <Field label={t("auth.password")}>
                <Input type="password" name="password" required autoComplete="current-password" />
              </Field>
              {errorMsg && (
                <p className="text-sm text-red bg-red/10 rounded-lg px-3 py-2">{errorMsg}</p>
              )}
              <Button type="submit" className="w-full">
                {t("auth.login")}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-border" />
              {t("auth.orDivider")}
              <span className="h-px flex-1 bg-border" />
            </div>
            <GoogleButton label={t("auth.google")} />
          </CardBody>
        </Card>
        <p className="text-center text-white/70 text-sm mt-4">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="text-gold-light font-medium hover:underline">
            {t("auth.createAccount")}
          </Link>
        </p>
        <p className="text-center text-white/40 text-xs mt-6">
          <Link href="/privacidad" className="hover:underline hover:text-white/60">
            {t("legal.privacy")}
          </Link>
          {" · "}
          <Link href="/terminos" className="hover:underline hover:text-white/60">
            {t("legal.terms")}
          </Link>
        </p>
      </div>
    </div>
  );
}
