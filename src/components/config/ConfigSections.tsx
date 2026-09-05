"use client";

import { useState, type ReactNode } from "react";

export type ConfigSection = {
  id: string;
  label: string;
  content: ReactNode;
};

/** Navegación por categorías de Configuración: una fila de pestañas (con
 *  scroll horizontal en celular) y el contenido de la categoría activa
 *  debajo. Mismo patrón visual que el selector de mes (píldora gris con
 *  la opción activa en blanco). Puramente de organización — no cambia el
 *  comportamiento de ninguna tarjeta, solo su agrupación. */
export function ConfigSections({ sections }: { sections: ConfigSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              s.id === active?.id
                ? "bg-white text-navy shadow-[var(--shadow-soft)]"
                : "text-navy/60 hover:text-navy"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {active?.content}
    </div>
  );
}
