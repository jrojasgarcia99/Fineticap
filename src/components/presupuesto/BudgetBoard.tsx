"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Semaforo";
import { SEMAFORO_COLOR, type CategoriaTipo, type Semaforo } from "@/lib/types";
import { formatoMoneda, formatoPct } from "@/lib/calculations";
import { EditableBudgetRow, type BudgetRowItem } from "@/components/presupuesto/EditableBudgetRow";
import type { FondoOption } from "@/components/presupuesto/BudgetRowDialog";
import { CategoryHeader } from "@/components/presupuesto/CategoryHeader";
import { AddLineForm } from "@/components/presupuesto/AddLineForm";
import { InfoHint } from "@/components/ui/Tooltip";
import { useT } from "@/components/i18n/I18nProvider";
import type { CurrencyConfig } from "@/lib/currency";

export type BudgetSection = {
  categoria: string; // clave
  label: string;
  kind: "estructural" | "dinamica";
  total: number;
  categoriaId?: string;
  tipo?: CategoriaTipo;
  meta?: number; // fracción
  pct?: number;
  semaforo?: Semaforo;
  extraLine?: { label: string; monto: number; href?: string };
  items: BudgetRowItem[];
};

type Lists = Record<string, BudgetRowItem[]>;

const buildLists = (s: BudgetSection[]): Lists =>
  Object.fromEntries(s.map((x) => [x.categoria, x.items]));
const rowSig = (i: BudgetRowItem): string =>
  `${i.id}:${i.concepto}:${i.monto}:${i.moneda}:${i.automatico ? 1 : 0}:${i.recurrente ? 1 : 0}`;
const signature = (s: BudgetSection[]): string =>
  s.map((x) => x.categoria + ":" + x.items.map(rowSig).join(",")).join("|");
const listsSignature = (l: Lists): string =>
  Object.entries(l)
    .map(([k, arr]) => k + ":" + arr.map(rowSig).join(","))
    .join("|");

function DroppableList({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <ul
      ref={setNodeRef}
      className={`divide-y divide-border mb-3 min-h-[2.25rem] rounded transition-colors ${
        isOver ? "bg-navy-light/5" : ""
      }`}
    >
      {children}
    </ul>
  );
}

export function BudgetBoard({
  sections,
  currency,
  mes,
  anio,
  addAction,
  updateAction,
  deleteAction,
  applyOrder,
  updateCategoryAction,
  deleteCategoryAction,
  fondosDisponibles,
  distribucionMap,
  distribuirAction,
  quitarDistribucionAction,
}: {
  sections: BudgetSection[];
  currency: CurrencyConfig;
  mes: number;
  anio: number;
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  applyOrder: (payload: {
    mes: number;
    anio: number;
    listas: Record<string, string[]>;
  }) => Promise<{ ok: boolean } | void>;
  updateCategoryAction: (formData: FormData) => void | Promise<void>;
  deleteCategoryAction: (formData: FormData) => void | Promise<void>;
  fondosDisponibles?: FondoOption[];
  distribucionMap?: Record<string, string>;
  distribuirAction?: (formData: FormData) => void | Promise<void>;
  quitarDistribucionAction?: (formData: FormData) => void | Promise<void>;
}) {
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [lists, setLists] = useState<Lists>(() => buildLists(sections));
  const [activeId, setActiveId] = useState<string | null>(null);

  const serverSig = signature(sections);
  const [sig, setSig] = useState(serverSig);
  if (sig !== serverSig && !activeId && !isPending) {
    setSig(serverSig);
    setLists(buildLists(sections));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (id: string): string | null => {
    if (id in lists) return id;
    return Object.keys(lists).find((c) => lists[c].some((i) => i.id === id)) ?? null;
  };

  function persist(next: Lists) {
    if (listsSignature(next) === serverSig) return;
    const listas = Object.fromEntries(
      Object.entries(next).map(([c, arr]) => [c, arr.map((i) => i.id)]),
    );
    startTransition(async () => {
      try {
        await applyOrder({ mes, anio, listas });
      } catch {
        /* si falla la persistencia, el próximo refresco vuelve al estado del servidor */
      }
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const from = containerOf(String(active.id));
    const to = containerOf(String(over.id));
    if (!from || !to) return;

    let next: Lists;
    if (from === to) {
      const arr = lists[from];
      const oldI = arr.findIndex((i) => i.id === active.id);
      const newI =
        String(over.id) in lists ? arr.length - 1 : arr.findIndex((i) => i.id === over.id);
      if (oldI < 0 || newI < 0 || oldI === newI) return;
      next = { ...lists, [from]: arrayMove(arr, oldI, newI) };
    } else {
      const moving = lists[from].find((i) => i.id === active.id);
      if (!moving) return;
      const toArr = lists[to];
      const overIdx =
        String(over.id) in lists ? toArr.length : toArr.findIndex((i) => i.id === over.id);
      const insertAt = overIdx < 0 ? toArr.length : overIdx;
      next = {
        ...lists,
        [from]: lists[from].filter((i) => i.id !== active.id),
        [to]: [...toArr.slice(0, insertAt), moving, ...toArr.slice(insertAt)],
      };
    }
    setLists(next);
    persist(next);
  }

  const activeItem = activeId
    ? Object.values(lists).flat().find((i) => i.id === activeId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid md:grid-cols-2 gap-6">
        {sections.map((s) => {
          const items = lists[s.categoria] ?? [];
          const showBar =
            s.kind === "dinamica" && s.meta !== undefined && s.meta > 0 && s.pct !== undefined && s.semaforo;
          const metaLabel =
            s.meta === undefined
              ? undefined
              : s.tipo === "minimo"
                ? t("cat.metaMin", { pct: formatoPct(s.meta) })
                : t("cat.metaMax", { pct: formatoPct(s.meta) });
          return (
            <Card key={s.categoria}>
              <CardHeader>
                {s.kind === "dinamica" && s.categoriaId ? (
                  <CategoryHeader
                    id={s.categoriaId}
                    clave={s.categoria}
                    nombre={s.label}
                    tipo={s.tipo ?? "maximo"}
                    metaPct={(s.meta ?? 0) * 100}
                    totalLabel={formatoMoneda(s.total, currency.primaria)}
                    semaforo={s.semaforo}
                    updateAction={updateCategoryAction}
                    deleteAction={deleteCategoryAction}
                  />
                ) : (
                  <>
                    <CardTitle>{s.label}</CardTitle>
                    <span className="text-sm font-semibold text-navy">
                      {formatoMoneda(s.total, currency.primaria)}
                    </span>
                  </>
                )}
              </CardHeader>
              <CardBody>
                {showBar && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span className="flex items-center gap-1">
                        {t("cat.ofDisposable", { pct: formatoPct(s.pct as number) })}
                        <InfoHint content={t("tip.barraMeta")} />
                      </span>
                      <span>{metaLabel}</span>
                    </div>
                    <ProgressBar
                      value={(s.pct as number) / (s.meta as number)}
                      color={SEMAFORO_COLOR[s.semaforo as Semaforo]}
                    />
                  </div>
                )}

                <SortableContext
                  items={items.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <DroppableList id={s.categoria}>
                    {items.length === 0 && !s.extraLine && (
                      <li className="text-sm text-gray-400 py-2">{t("cat.noMovements")}</li>
                    )}
                    {items.map((item) => (
                      <EditableBudgetRow
                        key={item.id}
                        item={item}
                        currency={currency}
                        updateAction={updateAction}
                        deleteAction={deleteAction}
                        categoria={s.categoria}
                        fondosDisponibles={fondosDisponibles}
                        fondoActualId={distribucionMap?.[item.id] ?? null}
                        distribuirAction={distribuirAction}
                        quitarDistribucionAction={quitarDistribucionAction}
                      />
                    ))}
                    {s.extraLine && (
                      <li className="flex items-center justify-between py-2 text-sm italic">
                        <span className="flex items-center gap-1 text-gray-500">
                          {s.extraLine.href ? (
                            <Link href={s.extraLine.href} className="hover:underline">
                              {s.extraLine.label}
                            </Link>
                          ) : (
                            s.extraLine.label
                          )}
                          <InfoHint content={t("tip.aporteFamiliar")} />
                        </span>
                        <span className="text-gray-500">
                          {formatoMoneda(s.extraLine.monto, currency.primaria)}
                        </span>
                      </li>
                    )}
                  </DroppableList>
                </SortableContext>

                <AddLineForm
                  categoria={s.categoria}
                  mes={mes}
                  anio={anio}
                  currency={currency}
                  addAction={addAction}
                />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-lg border border-navy-light bg-card px-3 py-2 text-sm text-navy shadow-lg">
            {activeItem.concepto}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
