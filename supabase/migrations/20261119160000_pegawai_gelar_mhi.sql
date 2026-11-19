-- Koreksi gelar S.Ag., M.Pd., dan M.H.I. pada nama pegawai.
-- Migration ini aman dijalankan berulang.
--
-- Contoh:
--   ABDUL KARIM, S.AG, M.PD.      -> Abdul Karim, S.Ag., M.Pd.
--   DRS. H. HASBULLAH, M.HI       -> Drs. H. Hasbullah, M.H.I.
--   MUHAMMAD AMINUDIN, M.H.I.     -> Muhammad Aminudin, M.H.I.
--
-- Berbeda dari migration sebelumnya, pola gelar di sini juga mengenali gelar
-- yang berada sebelum gelar lain (misalnya S.Ag., M.Pd.), bukan hanya gelar paling akhir.

begin;

do $$
declare
  g record;
  nama_baru text;
begin
  for g in
    select *
    from (values
      ('(^|[,[:space:]])S[.]?Ag[.]?([,[:space:]]|$)', E'\\1S.Ag.\\2'),
      ('(^|[,[:space:]])M[.]?Pd[.]?([,[:space:]]|$)', E'\\1M.Pd.\\2'),
      -- M.Hi dan M.H.I. sama-sama dinormalisasi menjadi M.H.I.
      ('(^|[,[:space:]])M[.]?H[.]?I[.]?([,[:space:]]|$)', E'\\1M.H.I.\\2')
    ) as daftar(pattern, pengganti)
  loop
    update public.pegawai
       set nama = regexp_replace(btrim(nama), g.pattern, g.pengganti, 'gi')
     where nama is not null
       and nama ~* g.pattern;
  end loop;
end $$;

commit;
