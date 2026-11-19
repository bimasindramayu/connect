-- Koreksi kapitalisasi gelar akademik yang tidak tepat setelah normalisasi Title Case.
-- Jalankan setelah 20261119115000_pegawai_nama_title_case.sql.
--
-- Contoh:
--   H. HERIYANTO. S.SOS       -> H. Heriyanto, S.Sos.
--   ANI AMALIYAH INSANI, S.HUM -> Ani Amaliyah Insani, S.Hum.
--   SAPI'I, S.H.I.            -> Sapi'i, S.H.I.
--
-- Migration ini hanya menyentuh singkatan gelar yang dikenali di bagian akhir nama.
-- Gelar yang tidak ada dalam daftar tetap tidak diubah.

begin;

do $$
declare
  g record;
begin
  for g in
    select *
    from (values
      -- Sarjana: pola multi-bagian harus diletakkan sebelum pola yang lebih pendek.
      ('[,[:space:].]+S[.]?Pd[.]?I[.]?$', ', S.Pd.I.'),
      ('[,[:space:].]+S[.]?Pd[.]?SD[.]?$', ', S.Pd.SD.'),
      ('[,[:space:].]+S[.]?Pd[.]?K[.]?$', ', S.Pd.K.'),
      ('[,[:space:].]+S[.]?Pd[.]?BI[.]?$', ', S.Pd.BI.'),
      ('[,[:space:].]+S[.]?H[.]?I[.]?$', ', S.H.I.'),
      ('[,[:space:].]+S[.]?E[.]?I[.]?$', ', S.E.I.'),
      ('[,[:space:].]+S[.]?Sos[.]?$', ', S.Sos.'),
      ('[,[:space:].]+S[.]?Hum[.]?$', ', S.Hum.'),
      ('[,[:space:].]+S[.]?Ag[.]?$', ', S.Ag.'),
      ('[,[:space:].]+S[.]?Pd[.]?$', ', S.Pd.'),
      ('[,[:space:].]+S[.]?H[.]?$', ', S.H.'),
      ('[,[:space:].]+S[.]?E[.]?$', ', S.E.'),
      ('[,[:space:].]+S[.]?Kom[.]?$', ', S.Kom.'),
      ('[,[:space:].]+S[.]?Kep[.]?$', ', S.Kep.'),
      ('[,[:space:].]+S[.]?Farm[.]?$', ', S.Farm.'),
      ('[,[:space:].]+S[.]?Psi[.]?$', ', S.Psi.'),
      ('[,[:space:].]+S[.]?Si[.]?$', ', S.Si.'),
      ('[,[:space:].]+S[.]?T[.]?$', ', S.T.'),
      ('[,[:space:].]+S[.]?P[.]?$', ', S.P.'),
      ('[,[:space:].]+S[.]?Pi[.]?$', ', S.Pi.'),
      ('[,[:space:].]+S[.]?Ked[.]?$', ', S.Ked.'),
      ('[,[:space:].]+S[.]?Gz[.]?$', ', S.Gz.'),
      ('[,[:space:].]+S[.]?Stat[.]?$', ', S.Stat.'),
      ('[,[:space:].]+S[.]?Mat[.]?$', ', S.Mat.'),
      ('[,[:space:].]+S[.]?Hut[.]?$', ', S.Hut.'),
      ('[,[:space:].]+S[.]?Kn[.]?$', ', S.Kn.'),

      -- Magister.
      ('[,[:space:].]+M[.]?Pd[.]?I[.]?$', ', M.Pd.I.'),
      ('[,[:space:].]+M[.]?E[.]?I[.]?$', ', M.E.I.'),
      ('[,[:space:].]+M[.]?Ag[.]?$', ', M.Ag.'),
      ('[,[:space:].]+M[.]?Pd[.]?$', ', M.Pd.'),
      ('[,[:space:].]+M[.]?Si[.]?$', ', M.Si.'),
      ('[,[:space:].]+M[.]?H[.]?$', ', M.H.'),
      ('[,[:space:].]+M[.]?Hum[.]?$', ', M.Hum.'),
      ('[,[:space:].]+M[.]?M[.]?$', ', M.M.'),
      ('[,[:space:].]+M[.]?Kom[.]?$', ', M.Kom.'),
      ('[,[:space:].]+M[.]?T[.]?$', ', M.T.'),
      ('[,[:space:].]+M[.]?Kes[.]?$', ', M.Kes.'),
      ('[,[:space:].]+M[.]?Psi[.]?$', ', M.Psi.'),
      ('[,[:space:].]+M[.]?Sos[.]?$', ', M.Sos.'),
      ('[,[:space:].]+M[.]?E[.]?$', ', M.E.'),
      ('[,[:space:].]+M[.]?Sc[.]?$', ', M.Sc.'),
      ('[,[:space:].]+M[.]?Eng[.]?$', ', M.Eng.'),

      -- Doktor dan gelar internasional yang umum.
      ('[,[:space:].]+Ph[.]?D[.]?$', ', Ph.D.')
    ) as daftar(pattern, pengganti)
  loop
    update public.pegawai
       set nama = regexp_replace(btrim(nama), g.pattern, g.pengganti, 'i')
     where nama is not null
       and nama ~* g.pattern;
  end loop;
end $$;

commit;
