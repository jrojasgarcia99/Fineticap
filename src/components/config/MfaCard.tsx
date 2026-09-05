"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useT } from "@/components/i18n/I18nProvider";
import { createClient } from "@/lib/supabase/client";

type Step = "loading" | "disabled" | "enabled" | "enrolling" | "recoveryCodes" | "disabling";

/** Activar/gestionar 2FA (TOTP) con el SDK nativo de Supabase Auth. El
 *  desafío al iniciar sesión vive aparte, en /mfa-challenge (ver
 *  src/lib/supabase/mfa.ts) — esta tarjeta es solo para activar, regenerar
 *  códigos de recuperación, y desactivar desde una sesión ya iniciada. */
export function MfaCard() {
  const t = useT();
  const supabase = createClient();

  const [step, setStep] = useState<Step>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refreshStatus() {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.[0];
    if (totp) {
      setFactorId(totp.id);
      setStep("enabled");
    } else {
      setFactorId(null);
      setStep("disabled");
    }
  }

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError("");
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? t("mfa.errGeneric"));
      return;
    }
    setFactorId(data.id);
    setQr(`data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`);
    setSecret(data.totp.secret);
    setCode("");
    setStep("enrolling");
  }

  async function confirmEnroll() {
    if (!factorId) return;
    setError("");
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setBusy(false);
      setError(verifyError.message);
      return;
    }
    const { data: codes, error: codesError } = await supabase.rpc("mfa_generate_recovery_codes");
    setBusy(false);
    if (codesError || !codes) {
      setError(codesError?.message ?? t("mfa.errGeneric"));
      setStep("enabled");
      return;
    }
    setCode("");
    setRecoveryCodes(codes as unknown as string[]);
    setStep("recoveryCodes");
  }

  async function regenerateCodes() {
    setError("");
    setBusy(true);
    const { data: codes, error } = await supabase.rpc("mfa_generate_recovery_codes");
    setBusy(false);
    if (error || !codes) {
      setError(error?.message ?? t("mfa.errGeneric"));
      return;
    }
    setRecoveryCodes(codes as unknown as string[]);
    setStep("recoveryCodes");
  }

  async function confirmDisable() {
    if (!factorId) return;
    setError("");
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setBusy(false);
      setError(verifyError.message);
      return;
    }
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (unenrollError) {
      setError(unenrollError.message);
      return;
    }
    setCode("");
    await refreshStatus();
  }

  function cancel() {
    setError("");
    setCode("");
    void refreshStatus();
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // sin permiso de portapapeles — el usuario igual las ve en pantalla
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{t("mfa.title")}</CardTitle>
      </CardHeader>
      <CardBody>
        {error && (
          <p className="mb-4 rounded-lg bg-red/10 px-3 py-2 text-sm text-red">{error}</p>
        )}

        {step === "loading" && <p className="text-sm text-gray-500">…</p>}

        {step === "disabled" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t("mfa.statusDisabledDesc")}</p>
            <Button onClick={startEnroll} disabled={busy}>
              {t("mfa.enableBtn")}
            </Button>
          </div>
        )}

        {step === "enrolling" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{t("mfa.enrollScanTitle")}</p>
            {qr && <img src={qr} alt="QR" className="h-40 w-40" />}
            <p className="text-xs text-gray-500">
              {t("mfa.enrollManualHint")}{" "}
              <span className="select-all font-mono text-xs">{secret}</span>
            </p>
            <Field label={t("mfa.enrollCodeLabel")}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
            </Field>
            <div className="flex gap-2">
              <Button onClick={confirmEnroll} disabled={busy || !code}>
                {t("mfa.confirmBtn")}
              </Button>
              <Button variant="secondary" onClick={cancel} disabled={busy}>
                {t("mfa.cancelBtn")}
              </Button>
            </div>
          </div>
        )}

        {step === "recoveryCodes" && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{t("mfa.recoveryCodesTitle")}</p>
            <p className="text-xs text-gray-500">{t("mfa.recoveryCodesDesc")}</p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={copyAll}>
                {copied ? t("mfa.copied") : t("mfa.copyAll")}
              </Button>
              <Button onClick={() => void refreshStatus()}>{t("mfa.doneBtn")}</Button>
            </div>
          </div>
        )}

        {step === "enabled" && (
          <div className="space-y-3">
            <p className="text-sm text-green">{t("mfa.statusEnabledDesc")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={regenerateCodes} disabled={busy}>
                {t("mfa.regenerateBtn")}
              </Button>
              <Button variant="danger" onClick={() => setStep("disabling")} disabled={busy}>
                {t("mfa.disableBtn")}
              </Button>
            </div>
          </div>
        )}

        {step === "disabling" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t("mfa.disableConfirmDesc")}</p>
            <Field label={t("mfa.enrollCodeLabel")}>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" onClick={confirmDisable} disabled={busy || !code}>
                {t("mfa.disableConfirmBtn")}
              </Button>
              <Button variant="secondary" onClick={cancel} disabled={busy}>
                {t("mfa.cancelBtn")}
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
