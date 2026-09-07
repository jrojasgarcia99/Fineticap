-- Activos: categorías + detalles opcionales por categoría.
alter table activos add column if not exists categoria text not null default 'otro';
alter table activos add column if not exists detalles jsonb;
alter table activos drop constraint if exists activos_categoria_check;
alter table activos add constraint activos_categoria_check check (categoria in (
  'efectivo_bancos','inversion_otra','bienes_raices','vehiculo','negocio_propio','objetos_valor','otro'
));

-- Pasivos: la sección se elimina de la app (las deudas ya cubren ese rol).
-- DROP TABLE se lleva de encargo sus políticas RLS e índices.
drop table if exists pasivos;
