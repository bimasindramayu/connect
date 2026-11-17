-- BIMASATU — Migrasi riwayat bulanan Jaspro Transport
-- Jalankan SATU KALI di Supabase > SQL Editor. Aman dijalankan ulang.
-- Master Rekening tetap berada di public.jaspro_data. Laporan dan pengaturan disimpan per periode.
begin;

create table if not exists public.jaspro_periode (
  id         text primary key check (id ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  tahun      int not null check (tahun between 1900 and 2200),
  bulan      int not null check (bulan between 1 and 12),
  laporan    jsonb,
  settings   jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint jaspro_periode_id_consistent
    check (id = (tahun::text || '-' || lpad(bulan::text, 2, '0'))),
  constraint jaspro_periode_tahun_bulan_unique unique (tahun, bulan)
);

create or replace function public.jaspro_periode_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  e jsonb;
  tg text;
  d date;
  k text;
  who text;
  kua text;
  seen text[] := '{}'::text[];
  tarif jsonb;
  tanggal_tarif text;
  seen_tarif text[] := '{}'::text[];
  nominal numeric;
  field_name text;
begin
  if new.id <> (new.tahun::text || '-' || lpad(new.bulan::text, 2, '0')) then
    raise exception 'ID periode Jaspro tidak sesuai dengan tahun dan bulan.';
  end if;

  if new.laporan is not null then
    if jsonb_typeof(new.laporan) is distinct from 'object'
       or jsonb_typeof(new.laporan -> 'rows') is distinct from 'array' then
      raise exception 'Laporan Nominatif tidak valid.';
    end if;
    if jsonb_array_length(new.laporan -> 'rows') > 5000 then
      raise exception 'Laporan Nominatif maksimal 5000 baris.';
    end if;

    -- Migrasi arsip lama dikecualikan dari pemeriksaan duplikat agar data lama tidak hilang.
    -- Semua upload/perubahan baru tetap dicek di database.
    if coalesce(current_setting('app.jaspro_migration', true), '') <> 'on' then
      for e in select value from jsonb_array_elements(new.laporan -> 'rows') loop
        if jsonb_typeof(e) is distinct from 'object' then
          raise exception 'Baris laporan tidak valid.';
        end if;

        tg := coalesce(nullif(e ->> 'tanggal', ''), 'TANPA-TANGGAL');
        if tg <> 'TANPA-TANGGAL' then
          if tg !~ '^\d{4}-\d{2}-\d{2}$' then
            raise exception 'Tanggal jadwal harus berformat YYYY-MM-DD.';
          end if;
          begin
            d := tg::date;
          exception when others then
            raise exception 'Tanggal jadwal % bukan tanggal yang sah.', tg;
          end;
        end if;

        who := nullif(regexp_replace(coalesce(e ->> 'nip', ''), '[^0-9]', '', 'g'), '');
        if who is null or length(who) < 10 then
          who := upper(regexp_replace(regexp_replace(regexp_replace(btrim(coalesce(e ->> 'nama', '')), ',.*$', ''), '[.]', ' ', 'g'), '\s+', ' ', 'g'));
        end if;
        kua := upper(regexp_replace(regexp_replace(btrim(coalesce(e ->> 'kua', '')), '[.]', ' ', 'g'), '\s+', ' ', 'g'));
        k := coalesce(who, '') || chr(31) || coalesce(kua, '') || chr(31) || tg;

        if k = any(seen) then
          raise exception 'Jadwal duplikat ditemukan untuk % pada tanggal %. Periksa file sebelum menyimpan.', coalesce(e ->> 'nama', 'penghulu'), tg;
        end if;
        seen := seen || k;
      end loop;
    end if;
  end if;

  if jsonb_typeof(new.settings) is distinct from 'object' then
    raise exception 'Pengaturan Jaspro tidak valid.';
  end if;

  -- Validasi riwayat tarif, sama seperti pengaturan tarif pada tabel Jaspro lama.
  if new.settings ? 'tarifRiwayat' then
    if jsonb_typeof(new.settings -> 'tarifRiwayat') is distinct from 'array'
       or jsonb_array_length(new.settings -> 'tarifRiwayat') > 100 then
      raise exception 'Riwayat tarif harus berupa daftar maksimal 100 perubahan.';
    end if;
    for tarif in select value from jsonb_array_elements(new.settings -> 'tarifRiwayat') loop
      if jsonb_typeof(tarif) is distinct from 'object' then
        raise exception 'Perubahan tarif tidak valid.';
      end if;
      tanggal_tarif := tarif ->> 'mulai';
      if tanggal_tarif is null or tanggal_tarif !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'Tanggal perubahan tarif harus berformat YYYY-MM-DD.';
      end if;
      begin
        d := tanggal_tarif::date;
      exception when others then
        raise exception 'Tanggal perubahan tarif % tidak sah.', tanggal_tarif;
      end;
      if tanggal_tarif = any(seen_tarif) then
        raise exception 'Tanggal mulai tarif % dipakai lebih dari sekali.', tanggal_tarif;
      end if;
      seen_tarif := seen_tarif || tanggal_tarif;

      foreach field_name in array array['jaspro', 'transport'] loop
        if tarif ? field_name and jsonb_typeof(tarif -> field_name) is distinct from 'null' then
          if jsonb_typeof(tarif -> field_name) is distinct from 'number' then
            raise exception 'Tarif % harus berupa angka.', field_name;
          end if;
          nominal := (tarif ->> field_name)::numeric;
          if nominal < 0 or nominal > 1000000000 then
            raise exception 'Tarif % harus berada pada 0 sampai 1.000.000.000.', field_name;
          end if;
        end if;
      end loop;
      if (not (tarif ? 'jaspro') or jsonb_typeof(tarif -> 'jaspro') = 'null')
         and (not (tarif ? 'transport') or jsonb_typeof(tarif -> 'transport') = 'null') then
        raise exception 'Isi minimal satu nominal pada perubahan tarif.';
      end if;
    end loop;
  end if;

  if coalesce(new.settings ->> 'tanggalAcuan', '') <> ''
     and (new.settings ->> 'tanggalAcuan') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Tanggal acuan tarif harus berformat YYYY-MM-DD.';
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists jaspro_periode_guard on public.jaspro_periode;
create trigger jaspro_periode_guard
before insert or update on public.jaspro_periode
for each row execute function public.jaspro_periode_guard();

alter table public.jaspro_periode enable row level security;
drop policy if exists jaspro_periode_menu on public.jaspro_periode;
create policy jaspro_periode_menu on public.jaspro_periode
  for all to authenticated
  using ((select public.can_menu('jaspro')))
  with check ((select public.can_menu('jaspro')));

revoke all on public.jaspro_periode from anon;
grant select, insert, update, delete on public.jaspro_periode to authenticated;

-- Pindahkan laporan yang masih tersimpan pada format lama (satu baris id=1).
-- Bulan/tahun diambil dari settings lama; bila kosong, gunakan tanggal update arsip.
select set_config('app.jaspro_migration', 'on', true);

with legacy as (
  select
    case
      when coalesce(settings ->> 'tahun', '') ~ '^\d{4}$'
           and (settings ->> 'tahun')::int between 1900 and 2200
        then (settings ->> 'tahun')::int
      else extract(year from updated_at)::int
    end as y,
    coalesce(
      array_position(
        array['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER']::text[],
        upper(coalesce(settings ->> 'bulan', ''))
      ),
      extract(month from updated_at)::int
    ) as m,
    laporan,
    coalesce(settings, '{}'::jsonb) as settings
  from public.jaspro_data
  where id = 1 and laporan is not null
)
insert into public.jaspro_periode (id, tahun, bulan, laporan, settings)
select y::text || '-' || lpad(m::text, 2, '0'), y, m, laporan, settings
from legacy
where y between 1900 and 2200 and m between 1 and 12
on conflict (id) do nothing;

select set_config('app.jaspro_migration', 'off', true);

commit;
