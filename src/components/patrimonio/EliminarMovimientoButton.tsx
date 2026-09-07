"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/components/i18n/I18nProvider";

export function EliminarMovimientoButton({
  movimientoId,
  action,
}: {
  movimientoId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        aria-label={t("common.delete")}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-300 hover:bg-red/10 hover:text-red"
      >
        <Trash2 size={14} />
      </button>
      <ConfirmDialog
        open={confirm}
        title={t("fondos.deleteMovement")}
        message={t("fondos.deleteMovementConfirm")}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const fd = new FormData();
          fd.set("id", movimientoId);
          await action(fd);
          setConfirm(false);
        }}
      />
    </>
  );
}
