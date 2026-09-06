"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { FondoDialog } from "@/components/patrimonio/FondoDialog";
import { useT } from "@/components/i18n/I18nProvider";
import type { Fondo } from "@/lib/types";
import type { CurrencyConfig } from "@/lib/currency";

export function FondoMenu({
  fondo,
  currency,
  isFamilyMember,
  tienePosiciones,
  updateAction,
  deleteAction,
}: {
  fondo: Fondo;
  currency: CurrencyConfig;
  isFamilyMember: boolean;
  tienePosiciones?: boolean;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("common.edit")}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy"
      >
        <Pencil size={17} />
      </button>
      <FondoDialog
        open={open}
        onClose={() => setOpen(false)}
        currency={currency}
        fondo={fondo}
        isFamilyMember={isFamilyMember}
        tienePosiciones={tienePosiciones}
        createAction={async () => {}}
        updateAction={updateAction}
        deleteAction={deleteAction}
      />
    </>
  );
}
