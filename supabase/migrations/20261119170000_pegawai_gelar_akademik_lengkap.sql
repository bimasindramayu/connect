-- Normalisasi singkatan gelar akademik/profesi yang umum dipakai di Indonesia.
-- Aman dijalankan berulang dan dapat dijalankan setelah migration koreksi gelar sebelumnya.
--
-- Contoh:
--   Ma'Rup Ali Qomaini, S.i.kom.     -> Ma'Rup Ali Qomaini, S.I.Kom.
--   Abdul Karim, S.ag, M.Pd.         -> Abdul Karim, S.Ag., M.Pd.
--   Drs. H. Hasbullah, M.hi          -> Drs. H. Hasbullah, M.H.I.
--   Ani Amaliyah Insani, S.hum       -> Ani Amaliyah Insani, S.Hum.
--
-- Pola dicocokkan sebagai akhiran gelar setelah nama/koma, bukan sebagai bagian kata nama.
-- Variasi titik, huruf besar/kecil, dan sebagian spasi antarbagian singkatan dinormalisasi.

begin;

do $$
declare
  g record;
begin
  for g in
    select *
    from (values
      -- Sarjana: bentuk majemuk harus lebih dahulu daripada bentuk pendek.
      ('([,[:space:]]+)(S[.]?[[:space:]]*I[.]?[[:space:]]*Kom[.]?)([,[:space:]]|$)', E', S.I.Kom.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Tr[.]?[[:space:]]*A[.]?[[:space:]]*P[.]?)([,[:space:]]|$)', E', S.Tr.A.P.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Tr[.]?[[:space:]]*Kes[.]?)([,[:space:]]|$)', E', S.Tr.Kes.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Tr[.]?[[:space:]]*Kom[.]?)([,[:space:]]|$)', E', S.Tr.Kom.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Tr[.]?[[:space:]]*Par[.]?)([,[:space:]]|$)', E', S.Tr.Par.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Tr[.]?[[:space:]]*IP[.]?)([,[:space:]]|$)', E', S.Tr.IP.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Tr[.]?[[:space:]]*Sos[.]?)([,[:space:]]|$)', E', S.Tr.Sos.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Pd[.]?[[:space:]]*SD[.]?)([,[:space:]]|$)', E', S.Pd.SD.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Pd[.]?[[:space:]]*BI[.]?)([,[:space:]]|$)', E', S.Pd.BI.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Pd[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', S.Pd.I.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Pd[.]?[[:space:]]*K[.]?)([,[:space:]]|$)', E', S.Pd.K.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*E[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', S.E.I.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*H[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', S.H.I.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*A[.]?[[:space:]]*P[.]?)([,[:space:]]|$)', E', S.A.P.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*I[.]?[[:space:]]*P[.]?)([,[:space:]]|$)', E', S.IP.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*I[.]?[[:space:]]*Pust[.]?)([,[:space:]]|$)', E', S.I.Pust.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*H[.]?[[:space:]]*um[.]?)([,[:space:]]|$)', E', S.Hum.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Sos[.]?)([,[:space:]]|$)', E', S.Sos.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*A[.]?[[:space:]]*g[.]?)([,[:space:]]|$)', E', S.Ag.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*P[.]?[[:space:]]*d[.]?)([,[:space:]]|$)', E', S.Pd.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*H[.]?)([,[:space:]]|$)', E', S.H.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*E[.]?)([,[:space:]]|$)', E', S.E.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*A[.]?[[:space:]]*k[.]?)([,[:space:]]|$)', E', S.Ak.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*om[.]?)([,[:space:]]|$)', E', S.Kom.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*ep[.]?)([,[:space:]]|$)', E', S.Kep.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*F[.]?[[:space:]]*arm[.]?)([,[:space:]]|$)', E', S.Farm.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*P[.]?[[:space:]]*si[.]?)([,[:space:]]|$)', E', S.Psi.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*S[.]?[[:space:]]*i[.]?)([,[:space:]]|$)', E', S.Si.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*T[.]?)([,[:space:]]|$)', E', S.T.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*P[.]?[[:space:]]*i[.]?)([,[:space:]]|$)', E', S.Pi.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*P[.]?[[:space:]]*t[.]?)([,[:space:]]|$)', E', S.Pt.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*ed[.]?)([,[:space:]]|$)', E', S.Ked.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*G[.]?[[:space:]]*z[.]?)([,[:space:]]|$)', E', S.Gz.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Stat[.]?)([,[:space:]]|$)', E', S.Stat.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Mat[.]?)([,[:space:]]|$)', E', S.Mat.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*H[.]?[[:space:]]*ut[.]?)([,[:space:]]|$)', E', S.Hut.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*n[.]?)([,[:space:]]|$)', E', S.Kn.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*el[.]?)([,[:space:]]|$)', E', S.Kel.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*N[.]?[[:space:]]*i[.]?)([,[:space:]]|$)', E', S.Ni.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*A[.]?[[:space:]]*rs[.]?)([,[:space:]]|$)', E', S.Ars.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*D[.]?[[:space:]]*s[.]?)([,[:space:]]|$)', E', S.Ds.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*S[.]?[[:space:]]*n[.]?)([,[:space:]]|$)', E', S.Sn.\\3'),

      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*M[.]?)([,[:space:]]|$)', E', S.K.M.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*K[.]?[[:space:]]*G[.]?)([,[:space:]]|$)', E', S.KG.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*F[.]?[[:space:]]*il[.]?)([,[:space:]]|$)', E', S.Fil.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Th[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', S.Th.I.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Th[.]?)([,[:space:]]|$)', E', S.Th.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Pak[.]?)([,[:space:]]|$)', E', S.Pak.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*Ar[.]?)([,[:space:]]|$)', E', S.Ar.\\3'),
      ('([,[:space:]]+)(S[.]?[[:space:]]*A[.]?[[:space:]]*dm[.]?)([,[:space:]]|$)', E', S.Adm.\\3'),

      -- Diploma / vokasi.
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*K[.]?[[:space:]]*om[.]?)([,[:space:]]|$)', E', A.Md.Kom.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*K[.]?[[:space:]]*ep[.]?)([,[:space:]]|$)', E', A.Md.Kep.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*F[.]?[[:space:]]*arm[.]?)([,[:space:]]|$)', E', A.Md.Farm.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*K[.]?[[:space:]]*es[.]?)([,[:space:]]|$)', E', A.Md.Kes.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*B[.]?[[:space:]]*id[.]?)([,[:space:]]|$)', E', A.Md.Bid.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*P[.]?[[:space:]]*ar[.]?)([,[:space:]]|$)', E', A.Md.Par.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*A[.]?[[:space:]]*k[.]?)([,[:space:]]|$)', E', A.Md.Ak.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?[[:space:]]*K[.]?[[:space:]]*eb[.]?)([,[:space:]]|$)', E', A.Md.Keb.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*Md[.]?)([,[:space:]]|$)', E', A.Md.\\3'),

      -- Magister: pola majemuk didahulukan.
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*d[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', M.Pd.I.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*H[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', M.H.I.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*E[.]?[[:space:]]*I[.]?)([,[:space:]]|$)', E', M.E.I.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*H[.]?)([,[:space:]]|$)', E', M.P.H.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*A[.]?)([,[:space:]]|$)', E', M.P.A.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*S[.]?[[:space:]]*Ak[.]?)([,[:space:]]|$)', E', M.S.Ak.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*si[.]?[[:space:]]*T[.]?)([,[:space:]]|$)', E', M.Psi.T.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*A[.]?[[:space:]]*g[.]?)([,[:space:]]|$)', E', M.Ag.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*d[.]?)([,[:space:]]|$)', E', M.Pd.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*H[.]?[[:space:]]*um[.]?)([,[:space:]]|$)', E', M.Hum.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*S[.]?[[:space:]]*i[.]?)([,[:space:]]|$)', E', M.Si.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*K[.]?[[:space:]]*om[.]?)([,[:space:]]|$)', E', M.Kom.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*T[.]?)([,[:space:]]|$)', E', M.T.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*E[.]?)([,[:space:]]|$)', E', M.E.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*M[.]?)([,[:space:]]|$)', E', M.M.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*H[.]?)([,[:space:]]|$)', E', M.H.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*K[.]?[[:space:]]*es[.]?)([,[:space:]]|$)', E', M.Kes.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*K[.]?[[:space:]]*n[.]?)([,[:space:]]|$)', E', M.Kn.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*A[.]?[[:space:]]*k[.]?)([,[:space:]]|$)', E', M.Ak.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*S[.]?[[:space:]]*os[.]?)([,[:space:]]|$)', E', M.Sos.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*si[.]?)([,[:space:]]|$)', E', M.Psi.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*S[.]?[[:space:]]*c[.]?)([,[:space:]]|$)', E', M.Sc.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*E[.]?[[:space:]]*ng[.]?)([,[:space:]]|$)', E', M.Eng.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*E[.]?[[:space:]]*d[.]?)([,[:space:]]|$)', E', M.Ed.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*A[.]?)([,[:space:]]|$)', E', M.A.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?)([,[:space:]]|$)', E', M.P.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*S[.]?[[:space:]]*tat[.]?)([,[:space:]]|$)', E', M.Stat.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*t[.]?)([,[:space:]]|$)', E', M.Pt.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*i[.]?)([,[:space:]]|$)', E', M.Pi.\\3'),

      ('([,[:space:]]+)(M[.]?[[:space:]]*P[.]?[[:space:]]*d[.]?[[:space:]]*K[.]?)([,[:space:]]|$)', E', M.Pd.K.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*A[.]?[[:space:]]*P[.]?)([,[:space:]]|$)', E', M.A.P.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*F[.]?[[:space:]]*arm[.]?)([,[:space:]]|$)', E', M.Farm.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*L[.]?[[:space:]]*ing[.]?)([,[:space:]]|$)', E', M.Ling.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*A[.]?[[:space:]]*rs[.]?)([,[:space:]]|$)', E', M.Ars.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*A[.]?[[:space:]]*rch[.]?)([,[:space:]]|$)', E', M.Arch.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*K[.]?[[:space:]]*M[.]?)([,[:space:]]|$)', E', M.K.M.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*S[.]?[[:space:]]*H[.]?)([,[:space:]]|$)', E', M.S.H.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*G[.]?[[:space:]]*z[.]?)([,[:space:]]|$)', E', M.Gz.\\3'),
      ('([,[:space:]]+)(D[.]?[[:space:]]*S[.]?[[:space:]]*c[.]?)([,[:space:]]|$)', E', D.Sc.\\3'),
      ('([,[:space:]]+)(D[.]?[[:space:]]*E[.]?[[:space:]]*ng[.]?)([,[:space:]]|$)', E', D.Eng.\\3'),
      ('([,[:space:]]+)(E[.]?[[:space:]]*d[.]?[[:space:]]*D[.]?)([,[:space:]]|$)', E', Ed.D.\\3'),
      -- Gelar profesi/doctorate yang lazim ditulis di belakang nama.
      ('([,[:space:]]+)(P[.]?[[:space:]]*h[.]?[[:space:]]*D[.]?)([,[:space:]]|$)', E', Ph.D.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*p[.]?[[:space:]]*t[.]?)([,[:space:]]|$)', E', Apt.\\3'),
      ('([,[:space:]]+)(A[.]?[[:space:]]*k[.]?)([,[:space:]]|$)', E', Ak.\\3'),
      ('([,[:space:]]+)(C[.]?[[:space:]]*P[.]?[[:space:]]*A[.]?)([,[:space:]]|$)', E', CPA.\\3'),
      ('([,[:space:]]+)(M[.]?[[:space:]]*B[.]?[[:space:]]*A[.]?)([,[:space:]]|$)', E', M.B.A.\\3')
    ) as daftar(pattern, pengganti)
  loop
    update public.pegawai
       set nama = btrim(regexp_replace(nama, g.pattern, g.pengganti, 'gi'))
     where nama is not null
       and nama ~* g.pattern;
  end loop;
end $$;

commit;
