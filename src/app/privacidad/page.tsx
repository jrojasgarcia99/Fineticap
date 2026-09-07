import Link from "next/link";
import { getRequestLocale } from "@/lib/i18n/locale";
import { tFor } from "@/lib/i18n";
import { BrandMark } from "@/components/ui/BrandMark";

const LAST_UPDATED = "4 de septiembre de 2026";

export const metadata = {
  title: "Política de privacidad — Finéticap",
};

export default async function PrivacidadPage() {
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
          {es ? "Política de privacidad" : "Privacy Policy"}
        </h1>
        <p className="mb-8 text-xs text-gray-400">
          {es ? `Última actualización: ${LAST_UPDATED}` : `Last updated: ${LAST_UPDATED}`}
        </p>

        {es ? <ContentEs /> : <ContentEn />}

        <p className="mt-10 flex gap-4 text-xs text-gray-400">
          <Link href="/terminos" className="text-navy-light hover:underline">
            {t("legal.terms")}
          </Link>
          <Link href="/seguridad" className="text-navy-light hover:underline">
            {t("legal.security")}
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
        Esta política explica qué datos recolecta <strong>Finéticap</strong> (&ldquo;la
        App&rdquo;, &ldquo;nosotros&rdquo;), quién los ve y qué podés hacer al respecto. Finéticap
        es operada por <strong>Jesús Rojas García</strong>, persona individual, con domicilio en
        Costa Rica.
      </p>

      <H2>1. Qué es Finéticap</H2>
      <p>
        Finéticap es una herramienta para llevar tu presupuesto personal y, opcionalmente, el de tu
        familia: gastos, deudas, patrimonio, sobres de ahorro y un asistente de inteligencia
        artificial que te ayuda a interpretar tus propios números.
      </p>

      <H2>2. Qué datos recolectamos</H2>
      <p>Solo recolectamos lo que hace falta para que la App funcione:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Cuenta:</strong> tu correo electrónico (para iniciar sesión), y si elegís entrar
          con Google, el nombre y correo de esa cuenta.
        </li>
        <li>
          <strong>Perfil:</strong> nombre, apellidos, género, fecha de nacimiento, profesión, y una
          foto si elegís subir una.
        </li>
        <li>
          <strong>Datos financieros que vos ingresás:</strong> presupuesto, deudas, activos,
          fondos de inversión/ahorro y sus movimientos, sobres de ahorro y sus movimientos,
          salario, tipo de cambio, categorías y métodos de pago.
        </li>
        <li>
          <strong>Presupuesto Familiar (si lo activás):</strong> los demás miembros del grupo ven tu
          nombre, tu ingreso disponible o salario fijo (según cómo lo configurés) y las líneas de
          gasto compartidas — nunca tus datos personales ni tu presupuesto privado.
        </li>
        <li>
          <strong>Preferencias:</strong> idioma, tema y paleta de colores, orden de las secciones.
        </li>
        <li>
          <strong>Asistente de IA (si lo usás):</strong> tus mensajes y un resumen de tu situación
          financiera se envían a OpenAI para generar la respuesta. No guardamos el historial de esa
          conversación en nuestros servidores — se reinicia cada vez que recargás la página.
        </li>
        <li>
          <strong>Huella digital / Face ID (solo en la app instalada):</strong> se procesa
          enteramente en tu teléfono, por el sistema operativo — Finéticap nunca recibe ni almacena
          tu huella ni tu rostro.
        </li>
      </ul>

      <H2>3. Para qué usamos tus datos</H2>
      <p>
        Únicamente para operar la App: mostrar tu presupuesto, hacer los cálculos, generar las
        respuestas del asistente y recordar tus preferencias. No vendemos tus datos ni los usamos
        con fines publicitarios.
      </p>

      <H2>4. Con quién se comparte</H2>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Supabase</strong> — aloja la base de datos y gestiona el inicio de sesión.
        </li>
        <li>
          <strong>Vercel</strong> — aloja la aplicación.
        </li>
        <li>
          <strong>OpenAI</strong> — procesa los mensajes del asistente de IA, solo si lo usás.
        </li>
        <li>
          <strong>Google</strong> — solo si elegís iniciar sesión con tu cuenta de Google.
        </li>
      </ul>
      <p>No compartimos tus datos con nadie más.</p>

      <H2>5. Cuánto tiempo se conservan</H2>
      <p>
        Mientras tu cuenta exista. Si eliminás tu cuenta desde la App, tus datos financieros y de
        perfil se borran de forma permanente e inmediata.
      </p>

      <H2>6. Tus derechos</H2>
      <p>
        Podés ver y corregir tus datos en cualquier momento desde Perfil y Configuración, exportar
        tu presupuesto a Excel, y eliminar tu cuenta y todos tus datos desde Perfil → Eliminar
        cuenta. También podés escribirnos a{" "}
        <a href="mailto:contacto@fineticap.com" className="text-navy-light hover:underline">
          contacto@fineticap.com
        </a>{" "}
        para cualquier consulta sobre tus datos.
      </p>

      <H2>7. Cambios a esta política</H2>
      <p>
        Si cambiamos esta política de forma importante, te lo vamos a avisar dentro de la App. La
        fecha de arriba siempre indica la última actualización.
      </p>

      <H2>8. Contacto</H2>
      <p>
        Jesús Rojas García —{" "}
        <a href="mailto:contacto@fineticap.com" className="text-navy-light hover:underline">
          contacto@fineticap.com
        </a>
      </p>
    </div>
  );
}

function ContentEn() {
  return (
    <div className="space-y-4">
      <p>
        This policy explains what data <strong>Finéticap</strong> (&ldquo;the App&rdquo;,
        &ldquo;we&rdquo;) collects, who sees it, and what you can do about it. Finéticap is
        operated by <strong>Jesús Rojas García</strong>, an individual, based in Costa Rica.
      </p>

      <H2>1. What Finéticap is</H2>
      <p>
        Finéticap is a tool for tracking your personal budget and, optionally, your family&apos;s:
        expenses, debts, net worth, savings envelopes, and an AI assistant that helps you make
        sense of your own numbers.
      </p>

      <H2>2. What we collect</H2>
      <p>We only collect what the App needs to work:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Account:</strong> your email (to sign in), and if you choose to sign in with
          Google, that account&apos;s name and email.
        </li>
        <li>
          <strong>Profile:</strong> name, last names, gender, date of birth, profession, and a
          photo if you choose to upload one.
        </li>
        <li>
          <strong>Financial data you enter:</strong> budget, debts, assets and liabilities, savings
          envelopes and their transactions, salary, exchange rate, categories, and payment methods.
        </li>
        <li>
          <strong>Family Budget (if you enable it):</strong> other members of the group see your
          name, your available income or fixed salary (depending on how you configure it), and the
          shared budget lines — never your personal data or your private budget.
        </li>
        <li>
          <strong>Preferences:</strong> language, theme and color palette, section order.
        </li>
        <li>
          <strong>AI assistant (if you use it):</strong> your messages and a summary of your
          financial situation are sent to OpenAI to generate the reply. We don&apos;t store that
          conversation&apos;s history on our servers — it resets every time you reload the page.
        </li>
        <li>
          <strong>Fingerprint / Face ID (installed app only):</strong> processed entirely on your
          phone, by the operating system — Finéticap never receives or stores your fingerprint or
          face.
        </li>
      </ul>

      <H2>3. What we use it for</H2>
      <p>
        Only to run the App: showing your budget, doing the calculations, generating the
        assistant&apos;s replies, and remembering your preferences. We don&apos;t sell your data or
        use it for advertising.
      </p>

      <H2>4. Who we share it with</H2>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <strong>Supabase</strong> — hosts the database and handles sign-in.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the application.
        </li>
        <li>
          <strong>OpenAI</strong> — processes the AI assistant&apos;s messages, only if you use it.
        </li>
        <li>
          <strong>Google</strong> — only if you choose to sign in with your Google account.
        </li>
      </ul>
      <p>We don&apos;t share your data with anyone else.</p>

      <H2>5. How long we keep it</H2>
      <p>
        For as long as your account exists. If you delete your account from the App, your
        financial and profile data is permanently and immediately erased.
      </p>

      <H2>6. Your rights</H2>
      <p>
        You can view and correct your data anytime from Profile and Settings, export your budget
        to Excel, and delete your account and all your data from Profile → Delete account. You can
        also reach us at{" "}
        <a href="mailto:contacto@fineticap.com" className="text-navy-light hover:underline">
          contacto@fineticap.com
        </a>{" "}
        with any question about your data.
      </p>

      <H2>7. Changes to this policy</H2>
      <p>
        If we make a material change to this policy, we&apos;ll let you know inside the App. The
        date above always reflects the last update.
      </p>

      <H2>8. Contact</H2>
      <p>
        Jesús Rojas García —{" "}
        <a href="mailto:contacto@fineticap.com" className="text-navy-light hover:underline">
          contacto@fineticap.com
        </a>
      </p>
    </div>
  );
}
