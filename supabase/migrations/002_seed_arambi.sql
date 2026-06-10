-- Primer beat de prueba: Arambi
-- Ejecutar en Supabase > SQL Editor

insert into beats (
  slug, title, bpm, key, genre,
  cover_url, preview_url,
  price_basic, price_premium, price_exclusive,
  file_basic_path, file_premium_path, file_exclusive_path
) values (
  'arambi',
  'Arambi',
  88,
  'C minor',
  'Arambi',
  'arambi.png',
  null,
  100000,
  200000,
  400000,
  'Arambi2.mp3',
  'Arambi2.mp3',
  'Arambi2.mp3'
);
