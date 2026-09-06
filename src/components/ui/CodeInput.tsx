"use client";

import { useRef, useState } from "react";

/** Input de código (TOTP, recuperación, etc.) como cajitas separadas, una por
 *  caracter, pero que se escriben o pegan seguidas — igual al patrón que usan
 *  la mayoría de apps para códigos de verificación. Soporta dos formas de
 *  usarse: `name` (deja un input oculto para un <form action={...}> normal)
 *  y/o `onChange` (para leer el valor directo en un componente cliente). */
export function CodeInput({
  name,
  length = 6,
  autoFocus,
  onChange,
}: {
  name?: string;
  length?: number;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
}) {
  const [chars, setChars] = useState<string[]>(Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string[]) {
    setChars(next);
    onChange?.(next.join(""));
  }

  function setChar(i: number, raw: string) {
    const clean = raw.replace(/[^0-9]/g, "");
    const next = [...chars];
    next[i] = clean.slice(-1) || "";
    commit(next);
    if (clean && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length);
    if (!text) return;
    e.preventDefault();
    const next = Array(length).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    commit(next);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  }

  return (
    <div className="flex gap-2">
      {name && <input type="hidden" name={name} value={chars.join("")} />}
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={c}
          onChange={(e) => setChar(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          className="h-12 w-10 rounded-lg border border-border text-center text-lg font-mono focus:border-navy focus:outline-none"
        />
      ))}
    </div>
  );
}
