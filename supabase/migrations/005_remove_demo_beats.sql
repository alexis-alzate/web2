-- Elimina los beats de prueba creados por 004_seed_demo_beats.sql
-- Ejecutar en Supabase > SQL Editor cuando ya no se necesiten

delete from beats where slug like 'arambi-%';
