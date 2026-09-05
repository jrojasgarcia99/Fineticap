import { getPersonalContext, getFamilyBudgetContext, ensurePaymentMethods } from "@/lib/data";
import { tFor } from "@/lib/i18n";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { MonedasCard } from "@/components/config/MonedasCard";
import { FamilyBudgetCard } from "@/components/config/FamilyBudgetCard";
import { LanguageCard } from "@/components/config/LanguageCard";
import { AppearanceCard } from "@/components/config/AppearanceCard";
import { BiometricLockCard } from "@/components/config/BiometricLockCard";
import { AssistantSettingsCard } from "@/components/config/AssistantSettingsCard";
import { PaymentMethodsCard } from "@/components/config/PaymentMethodsCard";
import { RestoreCategoriesCard } from "@/components/config/RestoreCategoriesCard";
import { ResetDebtsCard } from "@/components/config/ResetDebtsCard";
import { NavOrderCard } from "@/components/config/NavOrderCard";
import { ConfigSections } from "@/components/config/ConfigSections";
import { MfaCard } from "@/components/config/MfaCard";
import { resolveNavItems } from "@/components/layout/nav-items";
import { normalizeTema } from "@/lib/theme";
import {
  updateConfig,
  updateMonedas,
  updateSalarioFuente,
  updateIdioma,
  updateTema,
  updateAsistenteInstrucciones,
  activateFamilyBudget,
  joinFamilyBudgetByCode,
  leaveFamilyBudget,
  addPaymentMethod,
  deletePaymentMethod,
  updateNavOrder,
} from "./actions";
import { restoreDefaultCategories } from "@/app/(app)/presupuesto/actions";
import { resetDeudas } from "@/app/(app)/deudas/actions";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, space, currency, user, locale } = await getPersonalContext();
  const t = tFor(locale);

  // Independientes entre sí: en paralelo en vez de uno tras otro.
  const [, family, { error }] = await Promise.all([
    ensurePaymentMethods({ supabase, user }),
    getFamilyBudgetContext({ supabase, user }),
    searchParams,
  ]);

  const { data: paymentMethods } = await supabase
    .from("payment_methods")
    .select("id, nombre")
    .order("orden", { ascending: true });

  return (
    <div>
      <PageHeader title={t("config.title")} description={t("config.desc")} />

      {error && (
        <p className="mb-6 rounded-lg bg-red/10 px-4 py-3 text-sm text-red">
          {decodeURIComponent(error)}
        </p>
      )}

      <ConfigSections
        sections={[
          {
            id: "general",
            label: t("config.section.general"),
            content: (
              <>
                <LanguageCard current={locale} action={updateIdioma} />
                <AppearanceCard current={normalizeTema(space.tema)} action={updateTema} />
                <NavOrderCard
                  items={resolveNavItems(space.nav_order).map((i) => ({
                    href: i.href,
                    labelKey: i.labelKey,
                  }))}
                  action={updateNavOrder}
                />
              </>
            ),
          },
          {
            id: "security",
            label: t("config.section.security"),
            content: (
              <>
                <BiometricLockCard />
                <MfaCard />
              </>
            ),
          },
          {
            id: "budget",
            label: t("config.section.budget"),
            content: (
              <>
                <MonedasCard
                  activas={currency.activas}
                  primaria={currency.primaria}
                  action={updateMonedas}
                />
                <PaymentMethodsCard
                  methods={paymentMethods ?? []}
                  addAction={addPaymentMethod}
                  deleteAction={deletePaymentMethod}
                />
                <RestoreCategoriesCard action={restoreDefaultCategories} />
              </>
            ),
          },
          {
            id: "debts",
            label: t("config.section.debts"),
            content: <ResetDebtsCard action={resetDeudas} />,
          },
          {
            id: "fund",
            label: t("config.section.fund"),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{t("config.goalsParams")}</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-gray-500 mb-4">{t("config.goalsMovedNote")}</p>
                  <form action={updateConfig} className="grid sm:grid-cols-2 gap-4">
                    <Field label={t("config.fundBasicMonths")}>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        name="meses_fondo_basico"
                        defaultValue={space.meses_fondo_basico}
                      />
                    </Field>
                    <Field label={t("config.fundIdealMonths")}>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        name="meses_fondo_ideal"
                        defaultValue={space.meses_fondo_ideal}
                      />
                    </Field>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit">{t("config.saveConfig")}</Button>
                    </div>
                  </form>
                </CardBody>
              </Card>
            ),
          },
          {
            id: "family",
            label: t("config.section.family"),
            content: (
              <FamilyBudgetCard
                linked={family !== null}
                inviteCode={family?.familyBudget.invite_code ?? null}
                members={
                  family?.members.map((m) => ({
                    user_id: m.user_id,
                    display_name: m.display_name,
                    salario_mensual: m.salario_mensual,
                    salario_fuente: m.salario_fuente,
                  })) ?? []
                }
                primaria={family?.currency.primaria ?? currency.primaria}
                myUserId={user.id}
                salarioFuente={space.salario_fuente}
                salarioMensual={space.salario_mensual}
                updateSalarioAction={updateSalarioFuente}
                activateAction={activateFamilyBudget}
                joinAction={joinFamilyBudgetByCode}
                leaveAction={leaveFamilyBudget}
              />
            ),
          },
          {
            id: "assistant",
            label: t("config.section.assistant"),
            content: (
              <AssistantSettingsCard
                current={space.asistente_instrucciones ?? ""}
                action={updateAsistenteInstrucciones}
              />
            ),
          },
          {
            id: "subscription",
            label: t("config.section.subscription"),
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>{t("config.section.subscription")}</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-xs text-gray-500">
                    {t("config.section.subscriptionPlaceholder")}
                  </p>
                </CardBody>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
