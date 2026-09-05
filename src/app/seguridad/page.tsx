import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tFor } from "@/lib/i18n";
import { BrandMark } from "@/components/ui/BrandMark";

const LAST_UPDATED = "5 de septiembre de 2026";

export const metadata = {
  title: "Seguridad — Finéticap",
};

export default async function SeguridadPage() {
  const locale = await getRequestLocale();
  const t = tFor(locale);
  const es = locale !== "en";

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Link href="/login" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="text-sm font-semibold text-navy">Finéticap</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-relaxed text-foreground">
        <h1 className="mb-1 text-2xl font-semibold text-navy">
          {es ? "Seguridad" : "Security"}
        </h1>
        <p className="mb-8 text-xs text-gray-400">
          {es ? `Última actualización: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
        </p>

        {es ? <ContentEs /> : <ContentEn />}

        <p className="mt-10 flex gap-4 text-xs text-gray-400">
          <Link href="/privacidad" className="text-navy-light hover:underline">
            {t("legal.privacy")}
          </Link>
          <Link href="/terminos" className="text-navy-light hover:underline">
            {t("legal.terms")}
          </Link>
        </p>
      </main>
    </div>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-8 text-base font-semibold text-navy first:mt-0">{children}</h2>;
}

function ContentEs() {
  return (
    <div className="space-y-4">
      <p>
        Esta página explica, en términos concretos y verificables, cómo protegemos tus datos
        financieros dentro de <strong>Finéticap</strong>. Preferimos ser precisos sobre lo que
        realmente está implementado antes que usar frases genéricas de marketing.
      </p>

      <H2>1. Aislamiento de datos por cuenta</H2>
      <p>
        Cada cuenta tiene su propio espacio privado (presupuesto, deudas, patrimonio, sobres de
        ahorro). Ese aislamiento no depende únicamente del código de la aplicación: está impuesto
        directamente en la base de datos mediante{" "}
        <strong>Row Level Security (RLS)</strong> de PostgreSQL — cada consulta a la base de datos
        se filtra automáticamente para que una cuenta solo pueda leer o modificar sus propias
        filas, sin importar qué pida el cliente. Si activás el Presupuesto Familiar, los demás
        miembros ven únicamente las líneas de gasto compartidas y el nombre/ingreso que vos
        configurés mostrar — nunca tu presupuesto privado ni tus datos personales.
      </p>

      <H2>2. Cifrado</H2>
      <p>
        Toda la comunicación entre tu dispositivo y nuestros servidores viaja cifrada por{" "}
        <strong>TLS</strong> (el candado del navegador). Los datos en reposo (la base de datos)
        están cifrados por la infraestructura de Supabase, nuestro proveedor de base de datos.
      </p>

      <H2>3. Infraestructura</H2>
      <p>
        Usamos <strong>Supabase</strong> (base de datos y autenticación) y{" "}
        <strong>Vercel</strong> (hospedaje de la aplicación), dos proveedores especializados en
        seguridad de infraestructura. Supabase mantiene certificación{" "}
        <strong>SOC 2 Tipo II</strong>, una auditoría independiente sobre sus controles de
        seguridad — es una certificación de Supabase como proveedor de infraestructura, no una
        certificación propia de Finéticap como producto. Nosotros no operamos servidores propios
        ni almacenamos copias de tus datos fuera de estos proveedores.
      </p>

      <H2>4. Autenticación</H2>
      <p>
        Podés iniciar sesión con correo y contraseña o con tu cuenta de Google. En la app instalada
        (Android/iOS) podés además activar un bloqueo adicional con huella digital o Face ID —
        ese dato lo procesa exclusivamente el sistema operativo de tu teléfono; Finéticap nunca lo
        recibe ni lo almacena.
      </p>

      <H2>5. Qué no hacemos</H2>
      <p>
        No vendemos tus datos financieros ni los compartimos con terceros con fines comerciales o
        publicitarios. El detalle completo de qué recolectamos y con quién lo compartimos (para
        operar la App, no para venderlo) está en nuestra{" "}
        <Link href="/privacidad" className="text-navy-light hover:underline">
          Política de privacidad
        </Link>
        .
      </p>

      <H2>6. Reportar un problema de seguridad</H2>
      <p>
        Si encontrás una vulnerabilidad o algo que te parezca un riesgo de seguridad, escribinos a{" "}
        <a href="mailto:contacto@fineticap.com" className="text-navy-light hover:underline">
          contacto@fineticap.com
        </a>{" "}
        — lo vamos a atender directamente.
      </p>
    </div>
  );
}

function ContentEn() {
  return (
    <div className="space-y-4">
      <p>
        This page explains, in concrete and verifiable terms, how we protect your financial data
        inside <strong>Finéticap</strong>. We&apos;d rather be precise about what&apos;s actually
        implemented than use generic marketing language.
      </p>

      <H2>1. Per-account data isolation</H2>
      <p>
        Each account has its own private space (budget, debts, net worth, savings envelopes). That
        isolation doesn&apos;t rely on the application code alone — it&apos;s enforced directly at
        the database level via PostgreSQL <strong>Row Level Security (RLS)</strong>: every database
        query is automatically filtered so an account can only read or modify its own rows,
        regardless of what the client requests. If you enable the Family Budget, other members only
        see the shared expense lines and whatever name/income you choose to show — never your
        private budget or personal data.
      </p>

      <H2>2. Encryption</H2>
      <p>
        All communication between your device and our servers travels encrypted over{" "}
        <strong>TLS</strong> (the browser&apos;s lock icon). Data at rest (the database) is
        encrypted by Supabase&apos;s infrastructure, our database provider.
      </p>

      <H2>3. Infrastructure</H2>
      <p>
        We use <strong>Supabase</strong> (database and authentication) and <strong>Vercel</strong>{" "}
        (application hosting), two providers specialized in infrastructure security. Supabase
        maintains <strong>SOC 2 Type II</strong> certification, an independent audit of its
        security controls — that certification belongs to Supabase as an infrastructure provider,
        not to Finéticap as a product. We don&apos;t run our own servers or keep copies of your
        data outside these providers.
      </p>

      <H2>4. Authentication</H2>
      <p>
        You can sign in with email and password or with your Google account. In the installed app
        (Android/iOS) you can also enable an additional lock with fingerprint or Face ID — that
        data is processed exclusively by your phone&apos;s operating system; Finéticap never
        receives or stores it.
      </p>

      <H2>5. What we don&apos;t do</H2>
      <p>
        We don&apos;t sell your financial data or share it with third parties for commercial or
        advertising purposes. The full detail of what we collect and who we share it with (to run
        the App, not to sell it) is in our{" "}
        <Link href="/privacidad" className="text-navy-light hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <H2>6. Reporting a security issue</H2>
      <p>
        If you find a vulnerability or anything that looks like a security risk, write to us at{" "}
        <a href="mailto:contacto@fineticap.com" className="text-navy-light hover:underline">
          contacto@fineticap.com
        </a>{" "}
        — we&apos;ll address it directly.
      </p>
    </div>
  );
}
