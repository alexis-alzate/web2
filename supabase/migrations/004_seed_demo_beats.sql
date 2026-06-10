-- TEMPORAL: duplica el beat "Arambi" varias veces para probar la vista
-- del catálogo lleno (visual). Borrar con 005_remove_demo_beats.sql
-- cuando ya no se necesite.
-- Ejecutar en Supabase > SQL Editor

insert into beats (
  slug, title, bpm, key, genre, tags,
  cover_url, preview_url,
  price_basic, price_premium, price_exclusive,
  file_basic_path, file_premium_path, file_exclusive_path
)
select
  'arambi-' || n,
  'Arambi ' || n,
  80 + (n * 3) % 60,
  (array['C minor','A minor','G minor','F# minor','D minor'])[1 + (n % 5)],
  (array['Afrobeat','Reggaeton','Dancehall','Trap','Afro Pop'])[1 + (n % 5)],
  array[
    (array['afro dancehall','reggaeton sad','type beat','afro pop','trap latino'])[1 + (n % 5)],
    (array['Beele Type Beat','Omah Lay Type Beat','Sech Type Beat','Karol G Type Beat','Feid Type Beat'])[1 + (n % 5)]
  ],
  'arambi.png',
  null,
  100000,
  200000,
  400000,
  'Arambi2.mp3',
  'Arambi2.mp3',
  'Arambi2.mp3'
from generate_series(2, 20) as n;
