"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import { useT } from "@/components/i18n/I18nProvider";

/** Nombres estándar más comunes para diversificar un fondo de inversión.
 *  Índices/ETFs y activos ampliamente conocidos — no se traducen, son los
 *  mismos en cualquier idioma. Los genéricos (Bienes Raíces, Oro, etc.) sí
 *  usan claves de traducción. */
const PRESETS = [
  "S&P 500",
  "Nasdaq 100",
  "Dow Jones",
  "Russell 2000",
  "MSCI World",
  "MSCI Emerging Markets",
  "Bitcoin",
  "Bitcoin Trust",
  "Ethereum",
] as const;

const GENERIC_PRESET_KEYS = [
  "fondos.presetTreasuryBonds",
  "fondos.presetCorporateBonds",
  "fondos.presetRealEstate",
  "fondos.presetGold",
  "fondos.presetMoneyMarket",
] as const;

/** Select con nombres estándar (S&P 500, Nasdaq 100, Bitcoin Trust...) + una
 *  opción "Otro" que revela un campo de texto libre. Deja el valor real en un
 *  input oculto con `name` (uso en un <form>), o lo reporta vía `onChange`
 *  (uso en una lista controlada, como al crear un fondo). */
export function DiversificacionNombreField({
  name,
  defaultValue,
  value: controlledValue,
  onChange,
  required,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  const t = useT();
  const genericLabels = GENERIC_PRESET_KEYS.map((k) => t(k));
  const allPresets: string[] = [...PRESETS, ...genericLabels];

  const initial = controlledValue ?? defaultValue ?? "";
  const [choice, setChoice] = useState(() =>
    initial === "" ? "" : allPresets.includes(initial) ? initial : "otro",
  );
  const [custom, setCustom] = useState(() => (choice === "otro" ? initial : ""));

  const value = choice === "otro" ? custom : choice;

  function emit(next: string) {
    onChange?.(next);
  }

  function handleChoice(v: string) {
    setChoice(v);
    emit(v === "otro" ? custom : v);
  }

  function handleCustom(v: string) {
    setCustom(v);
    emit(v);
  }

  return (
    <div className="space-y-2">
      <Select value={choice} onChange={(e) => handleChoice(e.target.value)} required={required}>
        <option value="">{t("common.choose")}</option>
        {allPresets.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="otro">{t("fondos.presetOther")}</option>
      </Select>
      {choice === "otro" && (
        <Input
          value={custom}
          onChange={(e) => handleCustom(e.target.value)}
          placeholder={t("fondos.positionName")}
          required={required}
          autoFocus
        />
      )}
      {/* Los inputs type=hidden nunca participan en la validación nativa del
          navegador — el `required` real vive en los campos visibles de arriba. */}
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
