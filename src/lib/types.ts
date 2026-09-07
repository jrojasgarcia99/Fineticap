export type Locale = "es" | "en";

export type Genero = "masculino" | "femenino" | "otro" | "no_decir";
export const GENEROS: Genero[] = ["masculino", "femenino", "otro", "no_decir"];

/** Lista de profesiones generales para el Perfil. Ampliá agregando la clave
 *  aquí y su traducción `profesion.<clave>` en es/en. */
export const PROFESIONES = [
  "admin_negocios",
  "ingenieria",
  "tecnologia",
  "salud",
  "educacion",
  "derecho",
  "finanzas",
  "ventas_marketing",
  "arte_diseno",
  "construccion_oficios",
  "servicios",
  "ciencias",
  "agro",
  "sector_publico",
  "comunicacion",
  "transporte",
  "estudiante",
  "jubilado",
  "hogar",
  "independiente",
  "otra",
  "no_decir",
] as const;
export type Profesion = (typeof PROFESIONES)[number];

export type Moneda = "CRC" | "USD";

export const MONEDAS: { code: Moneda; symbol: string; label: string }[] = [
  { code: "CRC", symbol: "₡", label: "Colones" },
  { code: "USD", symbol: "$", label: "Dólares" },
];

/** Una `clave` de categoría: estructural ('ingresos'/'rebajos') o una de
 *  personal_budget_categories. Es texto libre porque la lista es editable. */
export type Categoria = string;

/** Categorías estructurales del presupuesto personal: no se renombran ni borran
 *  (definen el Ingreso Disponible). El resto vive en personal_budget_categories. */
export const CATEGORIA_ESTRUCTURALES = ["ingresos", "rebajos"] as const;
export type CategoriaEstructural = (typeof CATEGORIA_ESTRUCTURALES)[number];

export type CategoriaTipo = "maximo" | "minimo";

export type PersonalBudgetCategory = {
  id: string;
  space_id: string;
  clave: string;
  nombre: string;
  tipo: CategoriaTipo;
  meta: number; // fracción del ingreso disponible
  orden: number;
  created_at: string;
};

/**
 * Espacio personal privado de una cuenta. Reemplaza al viejo `households`
 * compartido: 1 fila por usuario, con su perfil (nombre + salario) y toda la
 * configuración (monedas, metas, fondo, tipo de cambio…).
 */
export type PersonalSpace = {
  id: string;
  owner_id: string;
  display_name: string;
  salario_mensual: number;
  salario_fuente: "disponible" | "fijo";
  created_at: string;
  segundo_nombre: string | null;
  apellidos: string | null;
  profesion: string | null;
  genero: Genero | null;
  fecha_nacimiento: string | null;
  avatar_path: string | null;
  tipo_cambio: number;
  moneda_primaria: Moneda;
  monedas_activas: Moneda[];
  meta_deuda: number;
  meses_fondo_basico: number;
  meses_fondo_ideal: number;
  fondo_acumulado: number;
  pago_extra_base: number;
  idioma: Locale;
  tema: Tema;
  asistente_instrucciones: string | null;
  nav_order: string[] | null;
};

/** Temas de color. Cada uno tiene su versión clara y oscura. */
export const TEMAS = ["clasico", "rosa", "lavanda", "menta", "cielo", "arena"] as const;
export type Tema = (typeof TEMAS)[number];
export const DEFAULT_TEMA: Tema = "clasico";

/** Presupuesto Familiar compartido (opcional). Tiene su propia config de monedas. */
export type FamilyBudget = {
  id: string;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  tipo_cambio: number;
  moneda_primaria: Moneda;
  monedas_activas: Moneda[];
};

/** Miembro de un Presupuesto Familiar, con datos de perfil traídos de su espacio personal. */
export type FamilyBudgetMember = {
  id: string;
  family_budget_id: string;
  user_id: string;
  joined_at: string;
  display_name: string;
  salario_mensual: number;
  salario_fuente: "disponible" | "fijo";
};

export type FamilyBudgetCategory = {
  id: string;
  family_budget_id: string;
  nombre: string;
  orden: number;
  created_at: string;
};

export type FamilyBudgetItem = {
  id: string;
  family_budget_id: string;
  categoria: string;
  concepto: string;
  monto: number;
  moneda: Moneda;
  automatico: boolean;
  recurrente: boolean;
  orden: number;
  mes: number;
  anio: number;
  created_by: string | null;
  created_at: string;
};

export type BudgetItem = {
  id: string;
  space_id: string;
  categoria: Categoria;
  concepto: string;
  monto: number;
  moneda: Moneda;
  automatico: boolean;
  recurrente: boolean;
  orden: number;
  mes: number;
  anio: number;
  created_by: string | null;
  created_at: string;
};

export type ActivoCategoria =
  | "efectivo_bancos"
  | "inversion_otra"
  | "bienes_raices"
  | "vehiculo"
  | "negocio_propio"
  | "objetos_valor"
  | "otro";
export const ACTIVO_CATEGORIAS: ActivoCategoria[] = [
  "efectivo_bancos",
  "inversion_otra",
  "bienes_raices",
  "vehiculo",
  "negocio_propio",
  "objetos_valor",
  "otro",
];

export type Activo = {
  id: string;
  space_id: string;
  concepto: string;
  valor: number;
  moneda: Moneda;
  categoria: ActivoCategoria;
  /** Detalles opcionales, distintos según la categoría (p. ej. tipo de
   *  inmueble, marca/modelo de vehículo) — pares clave/valor libres. */
  detalles: Record<string, string> | null;
  created_at: string;
};

export type EstadoDeuda = "Activa" | "Pagada";

export type Deuda = {
  id: string;
  space_id: string;
  nombre: string;
  institucion: string | null;
  monto_original: number;
  saldo_actual: number;
  tasa_interes_anual: number;
  cuota_minima: number;
  moneda: Moneda;
  fecha_inicio: string | null;
  estado: EstadoDeuda;
  created_at: string;
};

/** Categorías por defecto de un Presupuesto Familiar nuevo. */
export const FAMILY_CATEGORIAS_DEFAULT = [
  "Vivienda",
  "Servicios Públicos",
  "Supermercado",
  "Transporte del Hogar",
  "Mantenimiento",
  "Seguros del Hogar",
  "Otros",
] as const;

// --- Sobres (envelope budgeting) -------------------------------------------

export type EnvelopeScope = "personal" | "family";

/** Íconos disponibles para un sobre (nombres de lucide-react). Fácil de ampliar. */
export const ENVELOPE_ICON_NAMES = [
  "Fuel", "ShoppingCart", "Home", "Car", "Utensils", "HeartPulse",
  "Gift", "Plane", "Smartphone", "GraduationCap", "PawPrint", "Wrench",
  "Tv", "Droplet", "Zap", "Wallet",
] as const;

export type EnvelopeIconName = (typeof ENVELOPE_ICON_NAMES)[number];

export type PaymentMethod = {
  id: string;
  user_id: string;
  nombre: string;
  orden: number;
  created_at: string;
};

export type Envelope = {
  id: string;
  scope_type: EnvelopeScope;
  space_id: string | null;
  family_budget_id: string | null;
  nombre: string;
  categoria: string;
  moneda: Moneda;
  limite_mensual: number;
  limite_ilimitado: boolean;
  icono: string;
  reinicio_dia: number | null;
  sin_reinicio: boolean;
  ciclo_inicio: string;
  orden: number;
  source_budget_item_id: string | null;
  source_family_budget_item_id: string | null;
  created_by: string | null;
  created_at: string;
};

export type EnvelopeMovimientoTipo = "income" | "expense";

export type EnvelopeMovement = {
  id: string;
  envelope_id: string;
  tipo: EnvelopeMovimientoTipo;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  fecha: string;
  metodo_pago: string | null;
  created_by: string | null;
  created_at: string;
};

export type FondoTipo = "inversion" | "ahorro" | "gasto_anual";
export const FONDO_TIPOS: FondoTipo[] = ["inversion", "ahorro", "gasto_anual"];
export const FONDO_PLAZOS = [10, 15, 20, 25, 30] as const;

export type Fondo = {
  id: string;
  scope_type: EnvelopeScope;
  space_id: string | null;
  family_budget_id: string | null;
  nombre: string;
  tipo: FondoTipo;
  moneda: Moneda;
  tasa_retorno_estimada: number | null;
  plazo_proyeccion_anios: number | null;
  /** Años que ya llevan corriendo la inversión — la proyección solo mira
   *  hacia adelante los que faltan (plazo - transcurridos), no el plazo
   *  completo desde cero. */
  anios_transcurridos: number;
  /** Comisión/costo anual (seguro, administración) que se resta de la tasa
   *  bruta antes de proyectar. */
  comision_anual_pct: number | null;
  orden: number;
  created_by: string | null;
  created_at: string;
};

export type FondoPosicion = {
  id: string;
  fondo_id: string;
  nombre: string;
  porcentaje: number;
  tasa_retorno_estimada: number | null;
  plazo_proyeccion_anios: number | null;
  anios_transcurridos: number;
  comision_anual_pct: number | null;
  orden: number;
  created_at: string;
};

export type FondoMovimientoTipo = "aporte_presupuesto" | "rendimiento" | "saldo_inicial";

export type FondoMovimiento = {
  id: string;
  fondo_id: string;
  tipo: FondoMovimientoTipo;
  monto: number;
  moneda: Moneda;
  anio: number;
  mes: number;
  budget_item_id: string | null;
  posicion_id: string | null;
  descripcion: string | null;
  created_by: string | null;
  created_at: string;
};

export type Semaforo = "verde" | "amarillo" | "naranja" | "rojo";

export const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: "#2E7D32",
  amarillo: "#C9A227",
  naranja: "#C0703A",
  rojo: "#B3261E",
};
