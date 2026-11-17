/* =====================================================================================
   jaspro.js: menu Jaspro Transport (menu 'jaspro': admin dan, bawaan, PNBP NR; diatur di Hak Akses Menu)
   JX = logika Jaspro (pencocokan nama, golongan, workbook ExcelJS, CSV) + tarif menurut tanggal; J/jp* = tampilan dan penyimpanan di
   Supabase (tabel jaspro_data).
   Tarif Jasa Profesi dan Transport boleh berubah pada tanggal tertentu dan berbeda-beda (settings.tarifRiwayat, lihat JX.tarifPada).
   ===================================================================================== */

/* ---- Logika Jaspro (disalin apa adanya dari jaspro.html: pencocokan nama, golongan, workbook ExcelJS, CSV) ---- */
const JX = (() => {
            /*
 * PNBP NR Tool - Core business logic (pure functions, no DOM/Node dependency)
 * Works identically in Node (for automated testing) and in the browser.
 */

            // ---------- Name normalization & matching ----------

            function normalizeCoreName(raw) {
                if (!raw)
                    return '';
                let s = String(raw).trim();
                const idx = s.indexOf(',');
                if (idx !== -1)
                    s = s.slice(0, idx);
                s = s.toUpperCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
                return s;
            }

            var HONORIFIC_TOKENS = ['H', 'HJ', 'DR', 'DRS', 'DRA', 'IR', 'PROF', 'K', 'KH', 'TH', 'HAJI', 'HAJJAH', 'R', 'RA', 'RD'];
            var HONORIFIC_SET = (function(arr) {
                var s = {};
                for (var i = 0; i < arr.length; i++)
                    s[arr[i]] = true;
                return s;
            }
            )(HONORIFIC_TOKENS);

            function stripHonorifics(normName) {
                var tokens = normName.split(' ').filter(function(t) {
                    return t && !HONORIFIC_SET[t];
                });
                return tokens.join(' ');
            }

            function levenshtein(a, b) {
                var m = a.length
                  , n = b.length;
                if (m === 0)
                    return n;
                if (n === 0)
                    return m;
                var dp = new Array(n + 1);
                for (var j = 0; j <= n; j++)
                    dp[j] = j;
                for (var i = 1; i <= m; i++) {
                    var prev = dp[0];
                    dp[0] = i;
                    for (j = 1; j <= n; j++) {
                        var tmp = dp[j];
                        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
                        prev = tmp;
                    }
                }
                return dp[n];
            }

            function similarity(a, b) {
                if (!a && !b)
                    return 1;
                if (!a || !b)
                    return 0;
                var dist = levenshtein(a, b);
                var maxLen = Math.max(a.length, b.length);
                return maxLen === 0 ? 1 : 1 - dist / maxLen;
            }

            // Build an index: normalized core name -> [master entries]
            function buildMasterIndex(masterList) {
                var exactMap = {};
                masterList.forEach(function(entry) {
                    var norm = normalizeCoreName(entry.nama);
                    if (!exactMap[norm])
                        exactMap[norm] = [];
                    exactMap[norm].push(entry);
                });
                return exactMap;
            }

            // Match a single input name against the master list.
            // Returns { status, entry, candidates, score }
            // status: 'OTOMATIS' | 'OTOMATIS_FUZZY' | 'AMBIGU' | 'TIDAK_DITEMUKAN'
            function matchPenghulu(inputName, masterList, exactMap) {
                var norm = normalizeCoreName(inputName);

                if (exactMap[norm] && exactMap[norm].length) {
                    var arr = exactMap[norm];
                    return {
                        status: arr.length > 1 ? 'AMBIGU' : 'OTOMATIS',
                        entry: arr[0],
                        candidates: arr,
                        score: 1
                    };
                }

                var stripped = stripHonorifics(norm);
                if (stripped) {
                    for (var key in exactMap) {
                        if (!Object.prototype.hasOwnProperty.call(exactMap, key))
                            continue;
                        if (stripHonorifics(key) === stripped) {
                            var arr2 = exactMap[key];
                            return {
                                status: arr2.length > 1 ? 'AMBIGU' : 'OTOMATIS',
                                entry: arr2[0],
                                candidates: arr2,
                                score: 0.99
                            };
                        }
                    }
                }

                var scored = masterList.map(function(entry) {
                    return {
                        entry: entry,
                        score: similarity(norm, normalizeCoreName(entry.nama))
                    };
                }).sort(function(a, b) {
                    return b.score - a.score;
                });

                var best = scored[0];
                if (best && best.score >= 0.85) {
                    return {
                        status: 'OTOMATIS_FUZZY',
                        entry: best.entry,
                        candidates: scored.slice(0, 3).map(function(s) {
                            return s.entry;
                        }),
                        score: best.score
                    };
                }
                return {
                    status: 'TIDAK_DITEMUKAN',
                    entry: null,
                    candidates: scored.slice(0, 3).map(function(s) {
                        return s.entry;
                    }),
                    score: best ? best.score : 0
                };
            }

            // ---------- Golongan classification ----------
            // Returns 'III' | 'IV' | 'PPPK' | 'UNKNOWN'
            function classifyGolongan(golRaw) {
                var g = String(golRaw || '').trim().toUpperCase();
                if (!g)
                    return 'UNKNOWN';
                if (/PPPK/.test(g))
                    return 'PPPK';

                // Strategy 1: leading roman-numeral run - handles "III/a", "IIIa", "IVb", "IIa"
                var m = g.match(/^([IVX]+)/);
                if (m) {
                    if (m[1] === 'IX')
                        return 'PPPK';
                    if (m[1] === 'IV')
                        return 'IV';
                    if (m[1] === 'III')
                        return 'III';
                    if (m[1] === 'II')
                        return 'II';
                }

                // Strategy 2: leading arabic digit - handles "3/a", "4A", "2/b"
                m = g.match(/^(\d+)/);
                if (m) {
                    if (m[1] === '9')
                        return 'PPPK';
                    if (m[1] === '4')
                        return 'IV';
                    if (m[1] === '3')
                        return 'III';
                    if (m[1] === '2')
                        return 'II';
                }

                // Strategy 3: word-boundary search anywhere - handles "GOL. IV/A", "GOLONGAN III"
                if (/\bIX\b/.test(g))
                    return 'PPPK';
                if (/\bIV\b/.test(g))
                    return 'IV';
                if (/\bIII\b/.test(g))
                    return 'III';
                if (/\bII\b/.test(g))
                    return 'II';

                return 'UNKNOWN';
            }

            function golonganLabel(golClass) {
                if (golClass === 'II')
                    return 'PNS Gol. II';
                if (golClass === 'III')
                    return 'PNS Gol. III';
                if (golClass === 'IV')
                    return 'PNS Gol. IV';
                if (golClass === 'PPPK')
                    return 'PPPK Gol. IX';
                return 'Tidak dikenali';
            }

            // ---------- Number parsing (defensive, handles Indonesian-formatted text numbers) ----------
            function parseNumberID(raw) {
                if (raw == null || raw === '')
                    return 0;
                if (typeof raw === 'number')
                    return isNaN(raw) ? 0 : raw;
                if (typeof raw === 'object') {
                    if ('result' in raw)
                        return parseNumberID(raw.result);
                    if (raw.text != null)
                        return parseNumberID(raw.text);
                    if (raw.richText)
                        return parseNumberID(raw.richText.map(function(r) {
                            return r.text;
                        }).join(''));
                }
                var s = String(raw).trim();
                if (s === '')
                    return 0;
                s = s.replace(/[^\d.,-]/g, '');
                if (s === '')
                    return 0;
                if (s.indexOf(',') !== -1 && s.lastIndexOf(',') > s.lastIndexOf('.')) {
                    s = s.replace(/\./g, '').replace(',', '.');
                } else {
                    s = s.replace(/,/g, '');
                    var parts = s.split('.');
                    if (parts.length > 1 && parts.slice(1).every(function(p) {
                        return p.length === 3;
                    })) {
                        s = parts.join('');
                    }
                }
                var n = parseFloat(s);
                return isNaN(n) ? 0 : n;
            }

            // Extract a plain string from a possibly-rich ExcelJS cell value (handles
            // hyperlink objects, rich text, formula-result objects, and plain values).
            function cellText(raw) {
                if (raw == null)
                    return '';
                if (typeof raw === 'object') {
                    if ('result' in raw)
                        return cellText(raw.result);
                    if (raw.text != null)
                        return cellText(raw.text);
                    if (raw.richText)
                        return raw.richText.map(function(r) {
                            return r.text;
                        }).join('');
                    if (raw instanceof Date)
                        return raw.toISOString();
                }
                return String(raw).trim();
            }

            // ---------- Spreadsheet column letter helper ----------
            function colLetter(n) {
                var s = '';
                while (n > 0) {
                    var rem = (n - 1) % 26;
                    s = String.fromCharCode(65 + rem) + s;
                    n = Math.floor((n - 1) / 26);
                }
                return s;
            }

            // ---------- Header alias resolution ----------
            function normalizeHeader(s) {
                return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '');
            }

            function findHeaderColumn(headerCells, aliases) {
                // headerCells: [{colNumber, norm}]
                for (var i = 0; i < aliases.length; i++) {
                    for (var j = 0; j < headerCells.length; j++) {
                        if (headerCells[j].norm === aliases[i])
                            return headerCells[j].colNumber;
                    }
                }
                return null;
            }

            var LAPORAN_ALIASES = {
                nama: ['nama penghulu', 'nama', 'nama lengkap', 'nama pegawai'],
                kua: ['kua', 'nama kua', 'unit kerja', 'satuan kerja'],
                nip: ['nip'],
                golongan: ['golongan', 'gol', 'gol/ruang', 'golongan/ruang', 'gol ruang'],
                jumlahPeristiwa: ['jumlah peristiwa', 'jml peristiwa', 'peristiwa', 'jumlah nikah rujuk', 'jumlah nr'],
                tarifJaspro: ['jasa profesi', 'jaspro', 'nominal jasa profesi', 'tarif jasa profesi'],
                tarifTransport: ['transport', 'transpo', 'nominal transport', 'tarif transport'],
                jumlahDiterima: ['jumlah diterima', 'total diterima', 'diterima'],
                noRekening: ['no rekening', 'nomor rekening', 'rekening'],
                // opsional: tanggal peristiwa. Baris bertanggal memakai tarif yang berlaku pada tanggalnya (lihat tarifPada).
                tanggal: ['tanggal', 'tgl', 'tanggal peristiwa', 'tgl peristiwa', 'tanggal nikah', 'tgl nikah', 'tanggal akad', 'tgl akad', 'tanggal nikah/rujuk', 'tanggal nr', 'tanggal pelaksanaan', 'tanggal pencatatan'],
            };

            var MASTER_ALIASES = {
                nama: ['nama'],
                namaPemilik: ['namapemilik', 'nama pemilik', 'nama pemilik rekening'],
                noRekening: ['nomorrekening', 'nomor rekening', 'no rekening', 'rekening'],
            };

            var BULAN_LIST = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];

            // ---------- Tarif menurut tanggal ----------
            // Tarif dasar (settings.tarifJaspro / tarifTransport) berlaku sejak awal. settings.tarifRiwayat = [{mulai: 'YYYY-MM-DD',
            // jaspro: angka|null, transport: angka|null}] mengubah tarif MULAI tanggal itu (tanggal itu sendiri sudah memakai tarif baru).
            // Nominal kosong (null) = tidak berubah, jadi Jaspro dan Transport boleh berubah sendiri-sendiri pada tanggal yang berbeda
            // dan nominalnya boleh berbeda-beda di tiap perubahan. Tarif sebuah baris laporan ditentukan oleh tanggal barisnya (kolom
            // Tanggal di laporan) atau, bila tidak ada, oleh tanggal acuan (settings.tanggalAcuan; kosong = hari terakhir bulan laporan).
            // Aturan pemeriksaan di riwayatPeriksa harus sama dengan jaspro_guard di bop.sql (server menolak data yang melanggarnya).
            var TARIF_MAKS = 1000000000;
            var RIWAYAT_MAKS = 100;
            var BULAN_SINGKAT = {
                JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGU: 8, AGS: 8, AUG: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12
            };

            function tglIso(y, m, d) {   // angka tahun/bulan(1..12)/hari -> 'YYYY-MM-DD'; '' bila bukan tanggal yang sah
                if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31))
                    return '';
                var dt = new Date(Date.UTC(y, m - 1, d));
                if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d)
                    return '';
                return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
            }

            function tglSah(s) {   // true bila s berupa teks 'YYYY-MM-DD' yang tanggalnya ada
                var p = typeof s === 'string' ? s.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
                return !!p && tglIso(+p[1], +p[2], +p[3]) === s;
            }

            function tglID(iso) {   // 'YYYY-MM-DD' -> 'dd/mm/yyyy' (tampilan)
                return tglSah(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
            }

            function tambahHari(iso, n) {
                var p = iso.split('-')
                  , dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
                return tglIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
            }

            function parseTanggal(raw) {   // isi sel Excel (Date, nomor seri, atau teks) -> 'YYYY-MM-DD'; '' bila kosong / tidak terbaca
                if (raw == null || raw === '' || typeof raw === 'boolean')
                    return '';
                if (raw instanceof Date)   // ExcelJS memberi tanggal Excel sebagai Date UTC; getter UTC = tanggal yang tampil di Excel
                    return isNaN(raw.getTime()) ? '' : tglIso(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
                if (typeof raw === 'object') {   // hasil rumus, teks kaya, tautan
                    if ('result' in raw)
                        return parseTanggal(raw.result);
                    if (raw.text != null)
                        return parseTanggal(raw.text);
                    if (raw.richText)
                        return parseTanggal(raw.richText.map(function(r) {
                            return r.text;
                        }).join(''));
                    return '';
                }
                if (typeof raw === 'number') {   // nomor seri tanggal Excel = hari sejak 1899-12-30 (25569 = 1970-01-01)
                    if (!isFinite(raw) || raw < 20000 || raw > 80000)
                        return '';
                    var dn = new Date(Math.round((Math.floor(raw) - 25569) * 86400000));
                    return tglIso(dn.getUTCFullYear(), dn.getUTCMonth() + 1, dn.getUTCDate());
                }
                var s = String(raw).trim().replace(/^[A-Za-z]+,\s*/, '');   // "Rabu, 15 Oktober 2026" -> "15 Oktober 2026"
                if (!s)
                    return '';
                if (/^\d{5}(\.\d+)?$/.test(s))
                    return parseTanggal(parseFloat(s));
                var m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s].*)?$/);   // 2026-10-15, 2026/10/15
                if (m)
                    return tglIso(+m[1], +m[2], +m[3]);
                m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})(?:[T\s].*)?$/);   // 15/10/2026, 15-10-2026, 15.10.26 (hari lebih dulu)
                if (m)
                    return tglIso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
                m = s.match(/^(\d{1,2})[\s.\-\/]*([A-Za-z]{3,})\.?[\s.\-\/,]*(\d{4})(?:\D.*)?$/);   // 15 Oktober 2026, 15-Okt-2026
                if (m) {
                    var bl = BULAN_SINGKAT[m[2].slice(0, 3).toUpperCase()];
                    return bl ? tglIso(+m[3], bl, +m[1]) : '';
                }
                return '';
            }

            function indeksBulan(bulan) {
                return BULAN_LIST.indexOf(String(bulan || '').toUpperCase());
            }

            function awalBulan(bulan, tahun) {   // hari pertama bulan laporan ('' bila bulan/tahun tidak sah)
                var i = indeksBulan(bulan);
                return i < 0 ? '' : tglIso(parseInt(tahun, 10), i + 1, 1);
            }

            function akhirBulan(bulan, tahun) {   // hari terakhir bulan laporan
                var i = indeksBulan(bulan)
                  , y = parseInt(tahun, 10);
                if (i < 0 || !(y >= 1900 && y <= 2200))
                    return '';
                return tglIso(y, i + 1, new Date(Date.UTC(y, i + 1, 0)).getUTCDate());
            }

            function angkaTarif(v) {   // angka 0..TARIF_MAKS, atau null bila kosong / tidak sah
                if (v == null || typeof v === 'boolean')
                    return null;
                if (typeof v === 'string') {
                    v = v.trim();
                    if (v === '')
                        return null;
                }
                var n = typeof v === 'number' ? v : Number(v);
                return isFinite(n) && n >= 0 && n <= TARIF_MAKS ? n : null;
            }

            // Memeriksa daftar perubahan tarif. sah = perubahan yang dipakai (urut tanggal naik); masalah = baris yang diabaikan beserta alasannya
            // (i = nomor urut di daftar asal, mulai dari 0).
            function riwayatPeriksa(list) {
                var sah = []
                  , masalah = []
                  , seen = {};
                (Array.isArray(list) ? list : []).forEach(function(e, i) {
                    if (!e || typeof e !== 'object' || Array.isArray(e))
                        return masalah.push({
                            i: i,
                            pesan: 'Data perubahan tarif tidak valid.'
                        });
                    var mulai = e.mulai == null ? '' : String(e.mulai);
                    if (!mulai)
                        return masalah.push({
                            i: i,
                            pesan: 'Tanggal mulai belum diisi.'
                        });
                    if (!tglSah(mulai))
                        return masalah.push({
                            i: i,
                            pesan: 'Tanggal mulai tidak sah.'
                        });
                    if (seen[mulai])
                        return masalah.push({
                            i: i,
                            pesan: 'Tanggal ' + tglID(mulai) + ' sudah dipakai perubahan lain.'
                        });
                    var j = angkaTarif(e.jaspro)
                      , t = angkaTarif(e.transport)
                      , jAda = !(e.jaspro == null || String(e.jaspro).trim() === '')
                      , tAda = !(e.transport == null || String(e.transport).trim() === '');
                    if ((jAda && j == null) || (tAda && t == null))
                        return masalah.push({
                            i: i,
                            pesan: 'Nominal harus angka 0 sampai 1.000.000.000.'
                        });
                    if (j == null && t == null)
                        return masalah.push({
                            i: i,
                            pesan: 'Isi minimal satu nominal (Jasa Profesi atau Transport).'
                        });
                    if (sah.length >= RIWAYAT_MAKS)
                        return masalah.push({
                            i: i,
                            pesan: 'Maksimal ' + RIWAYAT_MAKS + ' perubahan tarif.'
                        });
                    seen[mulai] = true;
                    sah.push({
                        mulai: mulai,
                        jaspro: j,
                        transport: t
                    });
                });
                sah.sort(function(a, b) {
                    return a.mulai < b.mulai ? -1 : (a.mulai > b.mulai ? 1 : 0);
                });
                return {
                    sah: sah,
                    masalah: masalah
                };
            }

            function tanggalAcuan(settings) {   // tanggal yang menentukan tarif baris tanpa tanggal: pilihan pengguna, atau hari terakhir bulan laporan
                var a = settings && settings.tanggalAcuan;
                return tglSah(a) ? a : akhirBulan(settings && settings.bulan, settings && settings.tahun);
            }

            function tanggalBaris(row, settings) {   // tanggal yang dipakai menentukan tarif sebuah baris
                return row && tglSah(row.tanggal) ? row.tanggal : tanggalAcuan(settings);
            }

            // Tarif per peristiwa pada sebuah tanggal ('YYYY-MM-DD'). mulaiJaspro/mulaiTransport = tanggal perubahan yang sedang berlaku
            // ('' = masih tarif dasar). Tanggal kosong/tidak sah memakai tarif dasar.
            function tarifPada(tanggal, settings) {
                var j = Number(settings.tarifJaspro) || 0
                  , t = Number(settings.tarifTransport) || 0
                  , mj = ''
                  , mt = '';
                if (tglSah(tanggal))
                    riwayatPeriksa(settings.tarifRiwayat).sah.forEach(function(e) {
                        if (e.mulai > tanggal)
                            return;
                        if (e.jaspro != null) {
                            j = e.jaspro;
                            mj = e.mulai;
                        }
                        if (e.transport != null) {
                            t = e.transport;
                            mt = e.mulai;
                        }
                    });
                return {
                    jaspro: j,
                    transport: t,
                    mulaiJaspro: mj,
                    mulaiTransport: mt
                };
            }

            // Potongan tanggal dari..sampai (inklusif) yang tarifnya sama. kind 'jaspro' | 'transport' hanya memperhatikan tarif itu;
            // tanpa kind keduanya diperhatikan. Hasil: [{dari, sampai, jaspro, transport}]
            function tarifSegmen(settings, dari, sampai, kind) {
                if (!tglSah(dari) || !tglSah(sampai) || dari > sampai)
                    return [];
                var titik = [dari];
                riwayatPeriksa(settings.tarifRiwayat).sah.forEach(function(e) {
                    if (e.mulai > dari && e.mulai <= sampai)
                        titik.push(e.mulai);
                });
                var seg = [];
                titik.forEach(function(mulai, i) {
                    var akhir = i + 1 < titik.length ? tambahHari(titik[i + 1], -1) : sampai
                      , t = tarifPada(mulai, settings)
                      , prev = seg[seg.length - 1]
                      , sama = prev && (kind === 'jaspro' ? prev.jaspro === t.jaspro : kind === 'transport' ? prev.transport === t.transport : prev.jaspro === t.jaspro && prev.transport === t.transport);
                    if (sama)
                        prev.sampai = akhir;
                    else
                        seg.push({
                            dari: mulai,
                            sampai: akhir,
                            jaspro: t.jaspro,
                            transport: t.transport
                        });
                });
                return seg;
            }

            function fmtRupiah(n) {
                return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            }

            // Keterangan di bawah tabel Excel bila tarif berubah di tengah bulan laporan ('' bila tarifnya tetap sepanjang bulan).
            function catatanTarif(settings, kind) {   // kind: 'jaspro' atau 'transpo' / 'transport'
                var k = kind === 'jaspro' ? 'jaspro' : 'transport';
                var seg = tarifSegmen(settings, awalBulan(settings.bulan, settings.tahun), akhirBulan(settings.bulan, settings.tahun), k);
                if (seg.length < 2)
                    return '';
                return 'Catatan: tarif ' + (k === 'jaspro' ? 'jasa profesi' : 'transport') + ' per peristiwa pada bulan ini ' + seg.map(function(s) {
                    return 'Rp ' + fmtRupiah(s[k]) + ' (' + tglID(s.dari) + ' s.d. ' + tglID(s.sampai) + ')';
                }).join(', ') + '. Baris tanpa tanggal memakai tarif per ' + tglID(tanggalAcuan(settings)) + '.';
            }

            if (typeof module !== 'undefined' && module.exports) {
                module.exports = {
                    normalizeCoreName: normalizeCoreName,
                    stripHonorifics: stripHonorifics,
                    levenshtein: levenshtein,
                    similarity: similarity,
                    buildMasterIndex: buildMasterIndex,
                    matchPenghulu: matchPenghulu,
                    classifyGolongan: classifyGolongan,
                    golonganLabel: golonganLabel,
                    parseNumberID: parseNumberID,
                    cellText: cellText,
                    colLetter: colLetter,
                    normalizeHeader: normalizeHeader,
                    findHeaderColumn: findHeaderColumn,
                    LAPORAN_ALIASES: LAPORAN_ALIASES,
                    MASTER_ALIASES: MASTER_ALIASES,
                    BULAN_LIST: BULAN_LIST,
                    parseTanggal: parseTanggal,
                    tglSah: tglSah,
                    tglID: tglID,
                    awalBulan: awalBulan,
                    akhirBulan: akhirBulan,
                    riwayatPeriksa: riwayatPeriksa,
                    tanggalAcuan: tanggalAcuan,
                    tanggalBaris: tanggalBaris,
                    tarifPada: tarifPada,
                    tarifSegmen: tarifSegmen,
                    catatanTarif: catatanTarif,
                };
            }
            /*
 * PNBP NR Tool - Excel I/O
 * Parsing of uploaded workbooks and generation of the final output workbook.
 * Depends on: ExcelJS (global), logic.js (global functions/constants)
 */

            var CURRENCY_FMT = '_-* #,##0_-;-* #,##0_-;_-* "-"_-;_-@_-';
            var THIN = {
                style: 'thin'
            };
            var BORDER_ALL = {
                top: THIN,
                left: THIN,
                bottom: THIN,
                right: THIN
            };
            var REPORT_FONT = 'Arial';

            // ---------- Helpers ----------

            async function readWorkbookFromFile(file) {
                var buf = await file.arrayBuffer();
                var wb = new ExcelJS.Workbook();
                await wb.xlsx.load(buf);
                return wb;
            }

            function buildHeaderCells(headerRow) {
                var cells = [];
                headerRow.eachCell(function(cell, colNumber) {
                    cells.push({
                        colNumber: colNumber,
                        norm: normalizeHeader(cell.value)
                    });
                });
                return cells;
            }

            // ---------- Parse: Laporan Nominatif (input 1) ----------

            async function parseLaporanFile(file) {
                var wb;
                try {
                    wb = await readWorkbookFromFile(file);
                } catch (e) {
                    return {
                        ok: false,
                        error: 'File tidak dapat dibaca. Pastikan file berformat .xlsx yang valid (' + (e && e.message ? e.message : e) + ').'
                    };
                }
                var ws = wb.worksheets[0];
                if (!ws)
                    return {
                        ok: false,
                        error: 'Tidak ada sheet yang ditemukan dalam file.'
                    };

                var headerRowNum = 1;
                var headerCells = buildHeaderCells(ws.getRow(headerRowNum));
                var found = Object.keys(headerCells).length ? headerCells : [];

                var colNama = findHeaderColumn(headerCells, LAPORAN_ALIASES.nama);
                var colKua = findHeaderColumn(headerCells, LAPORAN_ALIASES.kua);
                var colNip = findHeaderColumn(headerCells, LAPORAN_ALIASES.nip);
                var colGol = findHeaderColumn(headerCells, LAPORAN_ALIASES.golongan);
                var colJumlah = findHeaderColumn(headerCells, LAPORAN_ALIASES.jumlahPeristiwa) || 7;
                var colTarifJaspro = findHeaderColumn(headerCells, LAPORAN_ALIASES.tarifJaspro) || 8;
                var colTarifTransport = findHeaderColumn(headerCells, LAPORAN_ALIASES.tarifTransport) || 9;
                var colJumlahDiterima = findHeaderColumn(headerCells, LAPORAN_ALIASES.jumlahDiterima) || 10;
                var colRek = findHeaderColumn(headerCells, LAPORAN_ALIASES.noRekening);
                var colTgl = findHeaderColumn(headerCells, LAPORAN_ALIASES.tanggal);
                // Kolom G/Jumlah Peristiwa, H/Jasa Profesi, I/Transport, J/Jumlah Diterima.
                // Header yang dikenal diutamakan; jika judul berbeda, gunakan posisi kolom G-J.

                var missing = [];
                if (!colNama)
                    missing.push('Nama Penghulu');
                if (!colKua)
                    missing.push('KUA');
                if (!colNip)
                    missing.push('NIP');
                if (!colGol)
                    missing.push('Golongan');
                if (!colJumlah)
                    missing.push('Jumlah Peristiwa');

                if (missing.length) {
                    var foundHeaders = headerCells.map(function(h) {
                        return h.norm;
                    }).filter(Boolean);
                    return {
                        ok: false,
                        error: 'Kolom wajib tidak ditemukan di baris pertama: ' + missing.join(', ') + '. ' + 'Kolom yang terbaca dari file: ' + (foundHeaders.length ? foundHeaders.join(', ') : '(tidak ada)') + '.',
                    };
                }

                var rows = [];
                var skipped = 0;
                var tglTakSah = 0;
                ws.eachRow(function(row, rowNum) {
                    if (rowNum <= headerRowNum)
                        return;
                    var namaRaw = row.getCell(colNama).value;
                    var namaText = cellText(namaRaw);
                    if (!namaText) {
                        return;
                    }
                    if (/^jumlah$/i.test(namaText) || /^total$/i.test(namaText)) {
                        skipped++;
                        return;
                    }

                    var tglRaw = colTgl ? row.getCell(colTgl).value : null
                      , tgl = parseTanggal(tglRaw);
                    if (colTgl && !tgl && cellText(tglRaw) !== '')
                        tglTakSah++;   // ada isinya tetapi bukan tanggal yang terbaca: baris memakai tanggal acuan

                    var rawJaspro = row.getCell(colTarifJaspro).value;
                    var rawTransport = row.getCell(colTarifTransport).value;
                    var rawDiterima = row.getCell(colJumlahDiterima).value;
                    var jasproText = cellText(rawJaspro);
                    var transportText = cellText(rawTransport);
                    var diterimaText = cellText(rawDiterima);
                    var jasproTotal = parseNumberID(rawJaspro);
                    var transportTotal = parseNumberID(rawTransport);
                    var jumlahPeristiwaSumber = parseNumberID(row.getCell(colJumlah).value);
                    var jumlahDiterimaSumber = diterimaText === '' ? null : parseNumberID(rawDiterima);

                    if (!jasproText || !/\d/.test(jasproText) || !isFinite(jasproTotal) || jasproTotal < 0 || jasproTotal > TARIF_MAKS) {
                        throw new Error('Total Jasa Profesi pada kolom H tidak valid di baris ' + rowNum + '.');
                    }
                    if (!transportText || !/\d/.test(transportText) || !isFinite(transportTotal) || transportTotal < 0 || transportTotal > TARIF_MAKS) {
                        throw new Error('Total Transport pada kolom I tidak valid di baris ' + rowNum + '.');
                    }
                    if (!Number.isInteger(jumlahPeristiwaSumber) || jumlahPeristiwaSumber < 0) {
                        throw new Error('Jumlah Peristiwa pada kolom G harus berupa bilangan bulat nol atau lebih (baris ' + rowNum + ').');
                    }
                    if (jumlahPeristiwaSumber === 0 && (jasproTotal !== 0 || transportTotal !== 0)) {
                        throw new Error('Kolom G bernilai 0 tetapi kolom H/I memiliki nominal pada baris ' + rowNum + '.');
                    }
                    if (!diterimaText || !/\d/.test(diterimaText) || !isFinite(jumlahDiterimaSumber) || jumlahDiterimaSumber < 0) {
                        throw new Error('Jumlah Diterima pada kolom J wajib diisi angka nol atau lebih (baris ' + rowNum + ').');
                    }
                    rows.push({
                        nama: namaText,
                        kua: cellText(row.getCell(colKua).value),
                        nip: cellText(row.getCell(colNip).value),
                        golongan: cellText(row.getCell(colGol).value),
                        jumlahPeristiwa: jumlahPeristiwaSumber,
                        jasproTotalSumber: jasproTotal,
                        transportTotalSumber: transportTotal,
                        jumlahDiterimaSumber: jumlahDiterimaSumber,
                        noRekeningSumber: colRek ? cellText(row.getCell(colRek).value) : '',
                        tanggal: tgl,
                    });
                });

                if (!rows.length) {
                    return {
                        ok: false,
                        error: 'Tidak ada baris data yang terbaca. Pastikan data dimulai tepat di bawah baris judul kolom.'
                    };
                }

                return {
                    ok: true,
                    rows: rows,
                    sheetName: ws.name,
                    skipped: skipped,
                    adaKolomTanggal: !!colTgl,
                    tanggalTakSah: tglTakSah
                };
            }

            // ---------- Parse: Master Rekening (input 2) ----------

            async function parseMasterFile(file) {
                var wb;
                try {
                    wb = await readWorkbookFromFile(file);
                } catch (e) {
                    return {
                        ok: false,
                        error: 'File tidak dapat dibaca. Pastikan file berformat .xlsx yang valid (' + (e && e.message ? e.message : e) + ').'
                    };
                }
                var ws = wb.worksheets[0];
                if (!ws)
                    return {
                        ok: false,
                        error: 'Tidak ada sheet yang ditemukan dalam file.'
                    };

                var headerCells = buildHeaderCells(ws.getRow(1));
                var colNama = findHeaderColumn(headerCells, MASTER_ALIASES.nama);
                var colPemilik = findHeaderColumn(headerCells, MASTER_ALIASES.namaPemilik);
                var colRek = findHeaderColumn(headerCells, MASTER_ALIASES.noRekening);

                var missing = [];
                if (!colNama)
                    missing.push('Nama');
                if (!colRek)
                    missing.push('NomorRekening');
                if (missing.length) {
                    var foundHeaders = headerCells.map(function(h) {
                        return h.norm;
                    }).filter(Boolean);
                    return {
                        ok: false,
                        error: 'Kolom wajib tidak ditemukan di baris pertama: ' + missing.join(', ') + '. ' + 'Kolom yang terbaca dari file: ' + (foundHeaders.length ? foundHeaders.join(', ') : '(tidak ada)') + '.',
                    };
                }

                var entries = [];
                ws.eachRow(function(row, rowNum) {
                    if (rowNum === 1)
                        return;
                    var namaText = cellText(row.getCell(colNama).value);
                    if (!namaText)
                        return;
                    entries.push({
                        id: 'imp_' + rowNum + '_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
                        nama: namaText,
                        namaPemilik: colPemilik ? (cellText(row.getCell(colPemilik).value) || namaText) : namaText,
                        noRekening: colRek ? cellText(row.getCell(colRek).value) : '',
                    });
                });

                if (!entries.length) {
                    return {
                        ok: false,
                        error: 'Tidak ada baris data yang terbaca dari file Master Rekening.'
                    };
                }

                return {
                    ok: true,
                    entries: entries
                };
            }

            // ---------- Generate: output workbook ----------

            function buildReportSheet(ws, opts) {
                var title = opts.title
                  , rows = opts.rows
                  , kind = opts.kind
                  , settings = opts.settings
                  , footer = opts.footer;
                var isJaspro = kind === 'jaspro';
                // Kolom TANGGAL hanya muncul bila ada baris yang membawa tanggal sendiri (laporan dengan kolom Tanggal);
                // tanpa itu susunan laporan sama seperti sebelumnya.
                var adaTgl = rows.some(function(r) {
                    return tglSah(r.tanggal);
                });

                // Column A (blank spacer) and the second, always-empty "NO. REKENING" column
                // have been removed — "NO. REKENING CSV" is now the sheet's only rekening column.
                var COL = {
                    no: 1,
                    nama: 2,
                    kua: 3,
                    nip: 4,
                    gol: 5,
                    rekcsv: 6
                };
                var nextCol = 7;
                if (adaTgl)
                    COL.tgl = nextCol++;
                COL.jumlah = nextCol++;
                COL.tarif = nextCol++;
                COL.subtotal = nextCol++;
                if (isJaspro)
                    COL.pph = nextCol++;
                COL.diterima = nextCol++;
                var lastColNum = COL.diterima;

                var widthOf = {
                    no: 6.9,
                    nama: 40,
                    kua: 24.5,
                    nip: 22.5,
                    gol: 9.5,
                    rekcsv: 19.5,
                    tgl: 12.5,
                    jumlah: 8.5,
                    tarif: 11.7,
                    subtotal: 15.1,
                    pph: 15.5,
                    diterima: isJaspro ? 19.3 : 15.5
                };
                Object.keys(COL).forEach(function(name) {
                    ws.getColumn(COL[name]).width = widthOf[name];
                });

                ws.mergeCells(2, COL.nama, 2, lastColNum);
                var t = ws.getCell(2, COL.nama);
                t.value = title;
                t.font = {
                    name: REPORT_FONT,
                    size: 14,
                    bold: true
                };
                t.alignment = {
                    horizontal: 'center',
                    vertical: 'middle',
                    wrapText: true
                };
                ws.getRow(2).height = 24;

                var headers = ['No', 'NAMA', 'KUA', 'NIP', 'GOL', 'NO. REKENING CSV'].concat(adaTgl ? ['TANGGAL'] : [], ['JUMLAH', 'TARIF', 'JUMLAH'], isJaspro ? ['PPH', 'JUMLAH DITERIMA'] : ['JUMLAH DITERIMA']);
                headers.forEach(function(h, i) {
                    var cell = ws.getCell(4, COL.no + i);
                    cell.value = h;
                    cell.font = {
                        name: REPORT_FONT,
                        size: 11,
                        bold: true
                    };
                    cell.alignment = {
                        horizontal: 'center',
                        vertical: 'middle',
                        wrapText: true
                    };
                    cell.border = BORDER_ALL;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: {
                            argb: 'FFE8ECEF'
                        }
                    };
                });
                ws.getRow(4).height = 30;

                var firstDataRow = 5;
                var r = firstDataRow;
                rows.forEach(function(row, idx) {
                    var R = ws.getRow(r);

                    var cNo = R.getCell(COL.no);
                    cNo.value = idx + 1;
                    cNo.numFmt = '0';
                    cNo.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cNo.border = BORDER_ALL;
                    cNo.font = {
                        name: REPORT_FONT,
                        size: 11
                    };
                    var cNama = R.getCell(COL.nama);
                    cNama.value = row.nama;
                    cNama.alignment = {
                        horizontal: 'left',
                        vertical: 'center',
                        wrapText: true
                    };
                    cNama.border = BORDER_ALL;
                    cNama.font = {
                        name: REPORT_FONT,
                        size: 11
                    };
                    var cKua = R.getCell(COL.kua);
                    cKua.value = row.kua;
                    cKua.alignment = {
                        horizontal: 'left',
                        vertical: 'center'
                    };
                    cKua.border = BORDER_ALL;
                    cKua.font = {
                        name: REPORT_FONT,
                        size: 11
                    };
                    var cNip = R.getCell(COL.nip);
                    cNip.value = row.nip;
                    cNip.numFmt = '@';
                    cNip.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cNip.border = BORDER_ALL;
                    cNip.font = {
                        name: REPORT_FONT,
                        size: 11
                    };
                    var cGol = R.getCell(COL.gol);
                    cGol.value = row.golongan;
                    cGol.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cGol.border = BORDER_ALL;
                    cGol.font = {
                        name: REPORT_FONT,
                        size: 11
                    };
                    var cRekCsv = R.getCell(COL.rekcsv);
                    cRekCsv.value = row.rekening || '';
                    cRekCsv.numFmt = '@';
                    cRekCsv.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cRekCsv.border = BORDER_ALL;
                    cRekCsv.font = {
                        name: REPORT_FONT,
                        size: 11
                    };

                    if (adaTgl) {
                        var cTgl = R.getCell(COL.tgl);
                        if (tglSah(row.tanggal)) {   // tanggal asli Excel (bukan teks) supaya bisa diurutkan / disaring
                            cTgl.value = new Date(Date.UTC(+row.tanggal.slice(0, 4), +row.tanggal.slice(5, 7) - 1, +row.tanggal.slice(8, 10)));
                            cTgl.numFmt = 'dd/mm/yyyy';
                        }
                        cTgl.alignment = {
                            horizontal: 'center',
                            vertical: 'center'
                        };
                        cTgl.border = BORDER_ALL;
                        cTgl.font = {
                            name: REPORT_FONT,
                            size: 11
                        };
                    }

                    var cJumlah = R.getCell(COL.jumlah);
                    cJumlah.value = row.jumlahPeristiwa;
                    cJumlah.numFmt = '0';
                    cJumlah.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cJumlah.border = BORDER_ALL;
                    cJumlah.font = {
                        name: REPORT_FONT,
                        size: 11
                    };

                    // tarif per baris (menurut tanggal baris); settings hanya dipakai bila baris belum dihitung lewat classifyRow
                    var tarifValue = isJaspro ? row.tarifJaspro : row.tarifTransport;
                    if (tarifValue == null)
                        tarifValue = isJaspro ? settings.tarifJaspro : settings.tarifTransport;
                    var cTarif = R.getCell(COL.tarif);
                    cTarif.value = tarifValue;
                    cTarif.numFmt = CURRENCY_FMT;
                    cTarif.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cTarif.border = BORDER_ALL;
                    cTarif.font = {
                        name: REPORT_FONT,
                        size: 11
                    };

                    var colJumlahL = colLetter(COL.jumlah)
                      , colTarifL = colLetter(COL.tarif)
                      , colSubtotalL = colLetter(COL.subtotal);
                    var subtotalValue = isJaspro ? row.jasproSubtotal : row.transpoSubtotal;
                    var cSubtotal = R.getCell(COL.subtotal);
                    cSubtotal.value = {
                        formula: colJumlahL + r + '*' + colTarifL + r,
                        result: subtotalValue
                    };
                    cSubtotal.numFmt = CURRENCY_FMT;
                    cSubtotal.alignment = {
                        horizontal: 'right',
                        vertical: 'center'
                    };
                    cSubtotal.border = BORDER_ALL;
                    cSubtotal.font = {
                        name: REPORT_FONT,
                        size: 11
                    };

                    if (isJaspro) {
                        var colPphL = colLetter(COL.pph);
                        var ratePctStr = (row.pphRate != null ? (row.pphRate * 100) : 0) + '%';
                        var cPph = R.getCell(COL.pph);
                        cPph.value = {
                            formula: colSubtotalL + r + '*' + ratePctStr,
                            result: row.jasproPph
                        };
                        cPph.numFmt = CURRENCY_FMT;
                        cPph.alignment = {
                            horizontal: 'right',
                            vertical: 'center'
                        };
                        cPph.border = BORDER_ALL;
                        cPph.font = {
                            name: REPORT_FONT,
                            size: 11
                        };

                        var cDiterima = R.getCell(COL.diterima);
                        cDiterima.value = {
                            formula: colSubtotalL + r + '-' + colPphL + r,
                            result: row.jasproDiterima
                        };
                        cDiterima.numFmt = CURRENCY_FMT;
                        cDiterima.alignment = {
                            horizontal: 'right',
                            vertical: 'center'
                        };
                        cDiterima.border = BORDER_ALL;
                        cDiterima.font = {
                            name: REPORT_FONT,
                            size: 11,
                            bold: true
                        };
                    } else {
                        var cDiterima2 = R.getCell(COL.diterima);
                        cDiterima2.value = {
                            formula: colSubtotalL + r,
                            result: row.transpoDiterima
                        };
                        cDiterima2.numFmt = CURRENCY_FMT;
                        cDiterima2.alignment = {
                            horizontal: 'right',
                            vertical: 'center'
                        };
                        cDiterima2.border = BORDER_ALL;
                        cDiterima2.font = {
                            name: REPORT_FONT,
                            size: 11,
                            bold: true
                        };
                    }
                    r++;
                });

                var totalRow = r;
                var lastDataRow = r - 1;
                var labelTo = adaTgl ? COL.tgl : COL.rekcsv;   // label "JUMLAH" membentang sampai tepat sebelum kolom JUMLAH peristiwa
                ws.mergeCells(totalRow, COL.no, totalRow, labelTo);
                var labelCell = ws.getCell(totalRow, COL.no);
                labelCell.value = 'JUMLAH';
                labelCell.font = {
                    name: REPORT_FONT,
                    size: 11,
                    bold: true
                };
                labelCell.alignment = {
                    horizontal: 'right',
                    vertical: 'center'
                };
                labelCell.border = {
                    top: THIN,
                    bottom: THIN,
                    left: THIN
                };
                ws.getCell(totalRow, labelTo).border = {
                    top: THIN,
                    bottom: THIN,
                    right: THIN
                };

                function sumCol(colNum) {
                    var cl = colLetter(colNum);
                    var cell = ws.getCell(totalRow, colNum);
                    var total = 0;
                    rows.forEach(function(row) {
                        if (colNum === COL.jumlah)
                            total += row.jumlahPeristiwa;
                        else if (colNum === COL.subtotal)
                            total += isJaspro ? row.jasproSubtotal : row.transpoSubtotal;
                        else if (isJaspro && colNum === COL.pph)
                            total += row.jasproPph;
                        else if (colNum === COL.diterima)
                            total += isJaspro ? row.jasproDiterima : row.transpoDiterima;
                    });
                    cell.value = {
                        formula: 'SUM(' + cl + firstDataRow + ':' + cl + lastDataRow + ')',
                        result: total
                    };
                    cell.numFmt = colNum === COL.jumlah ? '#,##0' : CURRENCY_FMT;
                    cell.font = {
                        name: REPORT_FONT,
                        size: 11,
                        bold: true
                    };
                    cell.alignment = {
                        horizontal: 'center',
                        vertical: 'center'
                    };
                    cell.border = BORDER_ALL;
                    return total;
                }
                sumCol(COL.jumlah);
                ws.getCell(totalRow, COL.tarif).border = BORDER_ALL;
                sumCol(COL.subtotal);
                if (isJaspro)
                    sumCol(COL.pph);
                sumCol(COL.diterima);
                ws.getRow(totalRow).height = 18;

                // Keterangan tarif: hanya bila tarif berubah di tengah bulan laporan. Diletakkan di baris kosong antara total dan tanda tangan.
                var catatan = catatanTarif(settings, kind);
                if (catatan) {
                    ws.mergeCells(totalRow + 1, COL.no, totalRow + 1, lastColNum);
                    var cCat = ws.getCell(totalRow + 1, COL.no);
                    cCat.value = catatan;
                    cCat.font = {
                        name: REPORT_FONT,
                        size: 9,
                        italic: true
                    };
                    cCat.alignment = {
                        horizontal: 'left',
                        vertical: 'top',
                        wrapText: true
                    };
                    ws.getRow(totalRow + 1).height = 26;
                }

                // Footer / signature block — text at 12pt, with extra blank rows left for the
                // physical signature/stamp between the "jabatan" line and the printed name.
                var SIGNATURE_FONT_SIZE = 12;
                var fr = totalRow + 3;
                function mergeSet(row, colFrom, colTo, value, opts) {
                    opts = opts || {};
                    if (colTo > colFrom)
                        ws.mergeCells(row, colFrom, row, colTo);
                    var c = ws.getCell(row, colFrom);
                    c.value = value;
                    var f = {
                        name: REPORT_FONT,
                        size: SIGNATURE_FONT_SIZE,
                        bold: true
                    };
                    if (opts.font)
                        for (var k in opts.font)
                            f[k] = opts.font[k];
                    c.font = f;
                    c.alignment = {
                        horizontal: opts.h || 'left',
                        vertical: opts.v || 'top',
                        wrapText: false
                    };
                    return c;
                }
                var leftFrom = COL.nama
                  , leftTo = COL.kua;
                var midFrom = COL.gol
                  , midTo = COL.rekcsv;
                var rightFrom = isJaspro ? COL.pph : COL.tarif
                  , rightTo = COL.diterima;

                mergeSet(fr, leftFrom, leftTo, 'Mengetahui,');
                mergeSet(fr, midFrom, midTo, footer.ppkLabel1 || 'Setuju Dibayar', {
                    h: 'center'
                });
                mergeSet(fr, rightFrom, rightTo, footer.tempatTanggal, {
                    h: 'right'
                });
                mergeSet(fr + 1, leftFrom, leftTo, footer.kpaJabatan);
                mergeSet(fr + 1, midFrom, midTo, footer.ppkJabatan, {
                    h: 'center'
                });
                mergeSet(fr + 1, rightFrom, rightTo, footer.bendaharaJabatan, {
                    h: 'right'
                });

                // 2 extra blank rows of signing space vs. the previous layout (gap of 5 rows
                // now, was 3): fr+1 is the jabatan line, fr+2..fr+6 are blank for a pen
                // signature/stamp, fr+7 is where the printed name resumes.
                var nameRow = fr + 7;
                mergeSet(nameRow, leftFrom, leftTo, footer.kpaNama, {
                    font: {
                        underline: true
                    }
                });
                mergeSet(nameRow, midFrom, midTo, footer.ppkNama, {
                    h: 'center',
                    font: {
                        underline: true
                    }
                });
                mergeSet(nameRow, rightFrom, rightTo, footer.bendaharaNama, {
                    h: 'right',
                    font: {
                        underline: true
                    }
                });
                mergeSet(nameRow + 1, leftFrom, leftTo, 'NIP. ' + footer.kpaNip, {
                    font: {
                        bold: false
                    }
                });
                mergeSet(nameRow + 1, midFrom, midTo, 'NIP. ' + footer.ppkNip, {
                    h: 'center',
                    font: {
                        bold: false
                    }
                });
                mergeSet(nameRow + 1, rightFrom, rightTo, 'NIP. ' + footer.bendaharaNip, {
                    h: 'right',
                    font: {
                        bold: false
                    }
                });

                ws.views = [{
                    state: 'frozen',
                    ySplit: 4
                }];
                ws.pageSetup = {
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    paperSize: 9
                };
            }

            async function buildOutputWorkbook(rows, settings, footer) {
                var wb = new ExcelJS.Workbook();
                wb.creator = 'Tools Laporan Nominatif PNBP NR';
                wb.created = new Date();

                var wsJ = wb.addWorksheet('JASPRO');
                buildReportSheet(wsJ, {
                    title: 'DAFTAR NOMINATIF PENERIMAAN JASA PROFESI PENGHULU BULAN ' + settings.bulan + ' ' + settings.tahun,
                    rows: rows,
                    kind: 'jaspro',
                    settings: settings,
                    footer: footer,
                });

                var wsT = wb.addWorksheet('TRANSPO');
                buildReportSheet(wsT, {
                    title: 'DAFTAR NOMINATIF PENERIMAAN TRANSPORT PENGHULU BULAN ' + settings.bulan + ' ' + settings.tahun,
                    rows: rows,
                    kind: 'transpo',
                    settings: settings,
                    footer: footer,
                });

                return wb;
            }

            async function downloadWorkbook(wb, filename) {
                var buffer = await wb.xlsx.writeBuffer();
                var blob = new Blob([buffer],{
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function() {
                    URL.revokeObjectURL(url);
                }, 4000);
            }
function classifyRow(row, settings) {
                    var golClass = classifyGolongan(row.golongan);
                    var pphRateMap = {
                        II: settings.pphII / 100,
                        III: settings.pphIII / 100,
                        IV: settings.pphIV / 100,
                        PPPK: settings.pphPPPK / 100
                    };
                    var pphRate = pphRateMap.hasOwnProperty(golClass) ? pphRateMap[golClass] : null;
                    // File nominatif baru membawa total per baris pada H dan I; nominal per peristiwa dihitung dengan membagi G.
                    // Arsip lama tanpa total H/I tetap memakai tarif tersimpan agar histori lama tetap dapat dihitung.
                    var tanggalTarif = tanggalBaris(row, settings);
                    var tarifLama = tarifPada(tanggalTarif, settings);
                    var tarifJasproPeristiwa = row.jasproTotalSumber != null
                        ? (row.jumlahPeristiwa > 0 ? Number(row.jasproTotalSumber) / row.jumlahPeristiwa : 0)
                        : tarifLama.jaspro;
                    var tarifTransportPeristiwa = row.transportTotalSumber != null
                        ? (row.jumlahPeristiwa > 0 ? Number(row.transportTotalSumber) / row.jumlahPeristiwa : 0)
                        : tarifLama.transport;
                    var tarif = { jaspro: tarifJasproPeristiwa, transport: tarifTransportPeristiwa };
                    // H dan I adalah total nominal per baris; tarif per peristiwa = total / jumlah peristiwa G.
                    var jasproSubtotal = Math.round(row.jumlahPeristiwa * tarif.jaspro);
                    var jasproPph = pphRate != null ? Math.round(jasproSubtotal * pphRate) : 0;
                    var jasproDiterima = jasproSubtotal - jasproPph;
                    var transpoSubtotal = Math.round(row.jumlahPeristiwa * tarif.transport);
                    // Kolom J pada file contoh = H + I (jumlah bruto sebelum PPh).
                    var jumlahDiterimaHitung = jasproSubtotal + transpoSubtotal;
                    var jumlahDiterimaBersih = jasproDiterima + transpoSubtotal;
                    var jumlahDiterimaSumber = row.jumlahDiterimaSumber == null ? null : Number(row.jumlahDiterimaSumber);
                    var selisihJumlahDiterima = jumlahDiterimaSumber == null ? null : jumlahDiterimaHitung - jumlahDiterimaSumber;
                    return {
                        golClass: golClass,
                        pphRate: pphRate,
                        tanggalTarif: tanggalTarif,
                        tarifJaspro: tarif.jaspro,
                        tarifTransport: tarif.transport,
                        jasproSubtotal: jasproSubtotal,
                        jasproPph: jasproPph,
                        jasproDiterima: jasproDiterima,
                        transpoSubtotal: transpoSubtotal,
                        transpoDiterima: transpoSubtotal,
                        jumlahDiterimaSumber: jumlahDiterimaSumber,
                        jumlahDiterimaHitung: jumlahDiterimaHitung,
                        jumlahDiterimaBersih: jumlahDiterimaBersih,
                        selisihJumlahDiterima: selisihJumlahDiterima,
                        jumlahDiterimaCocok: selisihJumlahDiterima == null || Math.abs(selisihJumlahDiterima) <= 1,
                    };
                }
function csvFieldSafe(val) {
                    var s = String(val == null ? '' : val);
                    s = s.replace(/[\r\n]+/g, ' ');
                    s = s.replace(/\|/g, '/');
                    s = s.replace(/"/g, '""');
                    return s;
                }
function buildDisbursementRows(processedRows, masterList, kind) {
                    var masterByRekening = {};
                    (masterList || []).forEach(function(m) {
                        if (m.noRekening)
                            masterByRekening[m.noRekening] = m;
                    });

                    var groups = {};
                    var order = [];
                    processedRows.forEach(function(row) {
                        // Group by the resolved account number whenever we have one — that's the
                        // actual recipient identity. Two rows can carry differently-formatted or
                        // typo'd source names (e.g. "RIDWAN, S.Sos" vs "RIDWAN. S.Sos") yet still
                        // point to the same rekening once matched/confirmed, and must be paid as
                        // a single combined line, not two. Only fall back to name-based grouping
                        // when a row has no rekening at all to key on.
                        var key = row.rekening ? ('REK:' + row.rekening) : ('NAMA:' + (normalizeCoreName(row.nama) || row.nama));
                        if (!groups[key]) {
                            var masterEntry = row.rekening ? masterByRekening[row.rekening] : null;
                            groups[key] = {
                                nama: masterEntry ? masterEntry.nama : row.nama,
                                namaPemilik: row.namaPemilik || (masterEntry ? masterEntry.namaPemilik : ''),
                                rekening: row.rekening || '',
                                total: 0,
                                hasTransaction: true,
                            };
                            order.push(key);
                        }
                        var g = groups[key];
                        if (!g.rekening && row.rekening)
                            g.rekening = row.rekening;
                        if (!g.namaPemilik && row.namaPemilik)
                            g.namaPemilik = row.namaPemilik;
                        g.total += (kind === 'jaspro' ? row.jasproDiterima : row.transpoDiterima);
                    });

                    // Every account in Master Rekening is listed even if it had no transaction
                    // this period, so the CSV is a complete roster — those get '-' for the amount.
                    var usedRekening = {};
                    order.forEach(function(k) {
                        if (groups[k].rekening)
                            usedRekening[groups[k].rekening] = true;
                    });
                    (masterList || []).forEach(function(m) {
                        if (!m.noRekening || usedRekening[m.noRekening])
                            return;
                        var key = 'REK:' + m.noRekening;
                        groups[key] = {
                            nama: m.nama,
                            namaPemilik: m.namaPemilik,
                            rekening: m.noRekening,
                            total: 0,
                            hasTransaction: false
                        };
                        order.push(key);
                    });

                    order.sort(function(a, b) {
                        return groups[a].nama.localeCompare(groups[b].nama, 'id');
                    });

                    return order.map(function(key, i) {
                        var g = groups[key];
                        return {
                            no: i + 1,
                            nama: g.nama,
                            namaPemilik: g.namaPemilik || g.nama,
                            rekening: g.rekening,
                            total: g.hasTransaction ? Math.round(g.total) : null,
                        };
                    });
                }
function buildCsvContent(rows) {
                    var headerLine = ['NO', 'NAMA_SUPPLIER', 'NAMA_PEMILIK_REKENING', 'NO_REKENING', 'JUMLAH_UANG'].join('|');
                    var lines = ['"' + headerLine + '"'];
                    rows.forEach(function(r) {
                        var jumlahStr = r.total == null ? '-' : String(r.total);
                        var fields = [r.no, csvFieldSafe(r.nama), csvFieldSafe(r.namaPemilik), csvFieldSafe(r.rekening), jumlahStr];
                        lines.push('"' + fields.join('|') + '"');
                    });
                    return lines.join('\r\n');
                }
return { BULAN_LIST, normalizeCoreName, buildMasterIndex, matchPenghulu, golonganLabel, parseLaporanFile, parseMasterFile,
  buildOutputWorkbook, downloadWorkbook, classifyRow, buildDisbursementRows, buildCsvContent,
  parseTanggal, tglSah, tglID, awalBulan, akhirBulan, riwayatPeriksa, tanggalAcuan, tanggalBaris, tarifPada, tarifSegmen, catatanTarif, fmtRupiah,
  TARIF_MAKS, RIWAYAT_MAKS };
})();

/* ====== Jaspro Transport: Laporan Nominatif PNBP NR (menu 'jaspro') ======
   Data hanya SATU baris di tabel jaspro_data (id = 1): setiap simpan menimpa data lama, tanpa riwayat.
   settings.tarifRiwayat = perubahan tarif menurut tanggal (JX.tarifPada); hanya perubahan yang lengkap dan sah yang dikirim ke server. */
const J = { on: false, master: [], laporan: null, set: {}, rows: null, periods: [], periodId: '', historyYear: new Date().getFullYear(), historySelected: '', showPreview: false, stale: false, masterDraft: null, settingsDraft: null, q: '', t: null };
const jpDef = () => ({
  bulan: JX.BULAN_LIST[new Date().getMonth()], tahun: new Date().getFullYear(), tarifJaspro: 100000, tarifTransport: 50000,
  tarifRiwayat: [], tanggalAcuan: '',
  pphII: 0, pphIII: 5, pphIV: 15, pphPPPK: 5, tempatTanggal: '',
  kpaJabatan: 'Kuasa Pengguna Anggaran', kpaNama: '', kpaNip: '', ppkJabatan: 'Pejabat Pembuat Komitmen', ppkNama: '', ppkNip: '',
  bendaharaJabatan: 'Bendahara Bimas', bendaharaNama: '', bendaharaNip: ''
});
const jpReset = () => Object.assign(J, { on: false, master: [], laporan: null, rows: null });
function jpMuatSet(tersimpan) {   // pengaturan tersimpan di atas bawaan; riwayat tarif dijaga selalu berupa daftar
  const s = { ...jpDef(), ...(tersimpan || {}) };
  s.tarifRiwayat = (Array.isArray(s.tarifRiwayat) ? s.tarifRiwayat : []).map(e => ({ mulai: e?.mulai ?? '', jaspro: e?.jaspro ?? null, transport: e?.transport ?? null }));
  if (typeof s.tanggalAcuan !== 'string') s.tanggalAcuan = '';
  return s;
}
function jpSetOut() {
  return { ...J.set, tarifRiwayat: JX.riwayatPeriksa(J.set.tarifRiwayat).sah, tanggalAcuan: JX.tglSah(J.set.tanggalAcuan) ? J.set.tanggalAcuan : '' };
}
function jpPeriodId(settings = J.set) {
  const month=JX.BULAN_LIST.indexOf(String(settings.bulan||'').toUpperCase())+1, year=Number(settings.tahun);
  return month>0 && Number.isInteger(year) && year>=1900 && year<=2200 ? String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0') : '';
}
function jpPeriodLabel(id) {
  const [y,m]=String(id||'').split('-').map(Number);
  return y&&m>=1&&m<=12 ? JX.BULAN_LIST[m-1][0]+JX.BULAN_LIST[m-1].slice(1).toLowerCase()+' '+y : id;
}
function jpDuplikatJadwal(rows) {
  const seen=new Map(),duplicate=[];
  (rows||[]).forEach((r,i)=>{
    const nip=String(r.nip||'').replace(/\D/g,'');
    const identitas=nip.length>=10 ? nip : JX.normalizeCoreName(r.nama);
    const key=[identitas,JX.normalizeCoreName(r.kua),JX.tglSah(r.tanggal)?r.tanggal:'TANPA-TANGGAL'].join('|');
    if(seen.has(key))duplicate.push({baris:i+2,pertama:seen.get(key)+2,nama:r.nama,tanggal:r.tanggal});
    else seen.set(key,i);
  });
  return duplicate;
}
function jpHitung(laporan,settings) {
  const rows=(laporan?.rows||[]).map(r=>({...r,...JX.classifyRow(r,settings||jpDef())}));
  const sum=k=>rows.reduce((n,r)=>n+(Number(r[k])||0),0);
  const jasproBruto=sum('jasproSubtotal'),pph=sum('jasproPph'),jaspro=sum('jasproDiterima'),transport=sum('transpoDiterima');
  const mismatchRows=rows.filter(r=>r.jumlahDiterimaSumber!=null&&!r.jumlahDiterimaCocok);
  return {rows,penghulu:new Set(rows.map(r=>JX.normalizeCoreName(r.nama)+'|'+JX.normalizeCoreName(r.kua))).size,
    peristiwa:sum('jumlahPeristiwa'),jasproBruto,pph,jaspro,transport,total:jaspro+transport,
    mismatchCount:mismatchRows.length,sourceTotal:rows.reduce((n,r)=>n+(r.jumlahDiterimaSumber==null?0:r.jumlahDiterimaSumber),0)};
}
function jpLoadPeriod(id) {
  const record=J.periods.find(p=>p.id===id),[year,month]=String(id).split('-').map(Number),defaults=jpDef();
  defaults.tahun=year;defaults.bulan=JX.BULAN_LIST[month-1]||defaults.bulan;
  J.set=record?jpMuatSet(record.settings):defaults;
  J.set.tahun=year;J.set.bulan=JX.BULAN_LIST[month-1]||J.set.bulan;
  J.laporan=record?.laporan||null;J.periodId=id;J.rows=null;J.stale=false;
}
const jpSetSimpan = () => {
  clearTimeout(J.t);
  J.t = setTimeout(() => { J.t = null; jpSave({ settings: jpSetOut() }); }, 800);
};
async function jpSetFlush() {
  if (J.t === null) return true;
  clearTimeout(J.t); J.t = null;
  return jpSave({ settings: jpSetOut() });
}
const jpX = () => loadJs(CDN.exceljs);   // ExcelJS hanya dimuat saat dibutuhkan
const JST = { OTOMATIS: ['success', 'Cocok otomatis'], OTOMATIS_FUZZY: ['warning', 'Cocok (mirip)'], AMBIGU: ['warning', 'Ambigu'], TIDAK_DITEMUKAN: ['danger', 'Tidak ditemukan'], MANUAL: ['secondary', 'Diisi manual'] };

const jpStat = (t, c) => { const b = $('jstat'); if (b) { b.className = 'badge bg-label-' + c; b.textContent = t; } };
async function jpSavePeriod(id, patch) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(id || ''))) {
    jpToast('Pilih periode laporan yang sah.', 'warning');
    return false;
  }
  const [tahun, bulan] = id.split('-').map(Number);
  const current = J.periods.find(p => p.id === id);
  const payload = {
    id, tahun, bulan,
    laporan: Object.prototype.hasOwnProperty.call(patch, 'laporan') ? patch.laporan : (current?.laporan ?? null),
    settings: Object.prototype.hasOwnProperty.call(patch, 'settings') ? patch.settings : (current?.settings || {})
  };
  jpStat('Menyimpan…', 'secondary');
  const { data, error } = await sb.from('jaspro_periode')
    .upsert(payload, { onConflict: 'id' })
    .select('id,tahun,bulan,laporan,settings,updated_at').single();
  jpStat(error ? 'Gagal menyimpan' : 'Tersimpan', error ? 'danger' : 'success');
  if (error) {
    jpToast('Gagal menyimpan periode ' + jpPeriodLabel(id) + ': ' + error.message, 'danger');
    return false;
  }
  const ix = J.periods.findIndex(p => p.id === id);
  if (ix < 0) J.periods.push(data); else J.periods[ix] = data;
  J.periods.sort((a, b) => b.id.localeCompare(a.id));
  return true;
}
async function jpSave(patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'master')) {
    jpStat('Menyimpan…', 'secondary');
    const { error } = await sb.from('jaspro_data').upsert({ id: 1, master: patch.master }, { onConflict: 'id' });
    jpStat(error ? 'Gagal menyimpan' : 'Tersimpan', error ? 'danger' : 'success');
    if (error) {
      jpToast('Gagal menyimpan Master Rekening: ' + error.message, 'danger');
      return false;
    }
    J.master = patch.master;
    return true;
  }
  return jpSavePeriod(jpPeriodId(J.set), patch);
}
function jpModalClass(name = '') {
  const dialog = $('dlg');
  dialog.classList.remove('jp-dialog-upload', 'jp-dialog-master', 'jp-dialog-settings');
  if (name) dialog.classList.add(name);
}

async function jpBusy(btn, label, action) {
  if (!btn || btn.disabled) return false;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' + esc(label || 'Menyimpan…');
  try {
    return await action();
  } catch (error) {
    jpToast('Proses tidak berhasil: ' + (error?.message || error), 'danger');
    return false;
  } finally {
    if (btn.isConnected) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = original;
    }
  }
}

async function pageJaspro() {
  const firstLoad = !J.on;
  $('view').innerHTML = `<div class="jp" id="jroot">
    <div class="jp-page-head">
      <div class="jp-page-title">
        <h4 class="mb-1">Jaspro Transport</h4>
        <p class="mb-0">Riwayat laporan bulanan, rincian pembayaran, dan pengaturan nominatif penghulu.</p>
      </div>
      <div class="jp-page-actions">
        <button class="btn btn-primary" data-act="upload-open"><i class="bx bx-upload"></i> Upload laporan XLS</button>
        <button class="btn btn-outline-secondary" data-act="master-open"><i class="bx bx-bank"></i> Master Rekening</button>
        <button class="btn btn-outline-secondary" data-act="settings-open"><i class="bx bx-slider-alt"></i> Pejabat &amp; PPh</button>
      </div>
    </div>
    <div id="jmsg"></div>
    <div id="jpanel" aria-live="polite">Memuat riwayat…</div>
  </div>`;
  if (!J.on || REFRESH_PAGE_DATA) {
    const selectedYear = firstLoad ? new Date().getFullYear() : J.historyYear;
    const selectedPeriod = firstLoad ? '' : J.historySelected;
    const [{ data: masterData, error: masterError }, { data: periods, error: periodError }] = await Promise.all([
      sb.from('jaspro_data').select('master').eq('id', 1).maybeSingle(),
      sb.from('jaspro_periode').select('id,tahun,bulan,laporan,settings,updated_at').order('id', { ascending: false })
    ]);
    if (masterError) return $('jpanel').innerHTML = note('Gagal memuat Master Rekening: ' + masterError.message);
    if (periodError) return $('jpanel').innerHTML = note('Gagal memuat arsip Jaspro. Jalankan bop.sql versi terbaru di Supabase terlebih dahulu. Pesan: ' + periodError.message);
    const defaults = jpDef(), currentId = jpPeriodId(defaults);
    const nextPeriods = periods || [];
    const stillExists = nextPeriods.some(p => p.id === selectedPeriod && p.laporan);
    Object.assign(J, {
      master: masterData?.master || [],
      periods: nextPeriods,
      on: true,
      historyYear: selectedYear,
      historySelected: stillExists ? selectedPeriod : '',
      showPreview: false
    });
    jpLoadPeriod(stillExists ? selectedPeriod : currentId);
  }
  jpStat('Tersimpan', 'success');
  const root = $('jroot');
  root.onclick = jpClick;
  root.onchange = jpChange;
  root.oninput = jpInput;
  jpRender();
}

function jpRender() {
  const panel = $('jpanel');
  if (!panel) return;
  const selected = J.historySelected ? J.periods.find(p => p.id === J.historySelected && p.laporan) : null;
  if (J.historySelected && !selected) {
    J.historySelected = '';
    J.showPreview = false;
  }
  panel.innerHTML = selected ? jpDetailPeriode(selected) : pRiwayat();
}

/* ---- Langkah 1: Input Laporan Nominatif ---- */
const pIn = () => {
  const R = J.laporan?.rows || [], u = new Set(R.map(r => JX.normalizeCoreName(r.nama) || r.nama)).size, tp = R.reduce((s, r) => s + (r.jumlahPeristiwa || 0), 0), bt = R.filter(r => JX.tglSah(r.tanggal)).length;
  return `<div class="card"><div class="card-body">
    <h5 class="mb-1">Input Laporan Nominatif</h5>
    <p class="mb-3">Pilih bulan dan tahun terlebih dahulu. Setiap periode disimpan terpisah; unggah ulang pada periode yang sama akan memperbarui arsip periode tersebut tanpa menghapus bulan lain.</p>
    <div class="row g-3 mb-3">
      <div class="col-sm-6 col-lg-3"><label class="form-label">Bulan laporan</label><select class="form-select" data-period="bulan">${JX.BULAN_LIST.map(b => `<option value="${b}"${b === J.set.bulan ? ' selected' : ''}>${b[0] + b.slice(1).toLowerCase()}</option>`).join('')}</select></div>
      <div class="col-sm-6 col-lg-3"><label class="form-label">Tahun laporan</label><input class="form-control" type="number" min="1900" max="2200" step="1" data-period="tahun" value="${esc(J.set.tahun)}"></div>
      <div class="col-12"><small class="text-body-secondary">Periode dipilih: <b>${esc(jpPeriodLabel(J.periodId))}</b>${J.laporan ? ' · Sudah ada laporan tersimpan; unggahan berikutnya dapat menggantinya.' : ' · Belum ada laporan tersimpan.'}</small></div>
    </div>
    <div class="jp-drop" data-act="upl"><div class="avatar rounded bg-label-primary mx-auto mb-2"><i class="bx bx-cloud-upload fs-3"></i></div>
      <div class="fw-semibold">Seret file ke sini, atau klik untuk memilih</div><small>Format .xlsx · Kolom wajib: Nama Penghulu, KUA, NIP, Golongan, G-J (Peristiwa, Jasa Profesi, Transport, Diterima) · Kolom opsional: No Rekening, Tanggal</small></div>
    <input type="file" id="jfl" accept=".xlsx" hidden>
    <p class="small text-body-secondary mt-2 mb-0">Kolom <b>G</b> = jumlah peristiwa, <b>H</b> = total Jasa Profesi untuk seluruh peristiwa, <b>I</b> = total Transport, dan <b>J</b> = total bruto pembanding. Tarif satu peristiwa dihitung dari H ÷ G dan I ÷ G, kemudian dikalikan kembali dengan G sebelum PPh dihitung.</p>
    ${R.length ? `<div class="row g-3 mt-1">${jpCard('bx-list-ul', 'primary', R.length, 'Total baris')}${jpCard('bx-user', 'info', u, 'Penghulu')}${jpCard('bx-calendar-check', 'success', tp, 'Total peristiwa')}${bt ? jpCard('bx-calendar', 'warning', bt, 'Baris bertanggal') : ''}</div>
      ${J.laporan.tanggalTakSah ? `<div class="alert alert-warning py-2 mt-3 mb-0">${J.laporan.tanggalTakSah} baris berisi kolom Tanggal yang tidak terbaca sebagai tanggal (contoh yang dikenali: 15/10/2026, 2026-10-15, 15 Oktober 2026). Baris itu memakai tanggal acuan.</div>` : ''}
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 my-3"><span>${R.length} baris dari “${esc(J.laporan.fileName)}”</span><button class="btn btn-sm btn-outline-danger" data-act="clr"><i class="bx bx-trash"></i> Hapus laporan</button></div>
      <div class="scroll"><table class="table table-hover align-middle mb-0"><thead><tr><th>No</th><th>Nama Penghulu</th><th>KUA</th><th>NIP</th><th>Golongan</th>${bt ? '<th>Tanggal</th>' : ''}<th class="text-end">Peristiwa (G)</th><th class="text-end">Jaspro total (H)</th><th class="text-end">Jaspro/peristiwa (H÷G)</th><th class="text-end">Transport total (I)</th><th class="text-end">Transport/peristiwa (I÷G)</th><th class="text-end">Diterima file (J)</th></tr></thead>
      <tbody>${R.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.nama)}</td><td>${esc(r.kua)}</td><td>${esc(r.nip)}</td><td>${esc(r.golongan)}</td>${bt ? `<td class="text-nowrap">${JX.tglSah(r.tanggal) ? JX.tglID(r.tanggal) : '<span class="text-body-secondary">–</span>'}</td>` : ''}<td class="text-end">${esc(r.jumlahPeristiwa)}</td><td class="text-end text-nowrap">Rp ${rp(Math.round(r.jasproTotalSumber || 0))}</td><td class="text-end text-nowrap">Rp ${rp(r.jumlahPeristiwa>0?Math.round(r.jasproTotalSumber/r.jumlahPeristiwa):0)}</td><td class="text-end text-nowrap">Rp ${rp(Math.round(r.transportTotalSumber || 0))}</td><td class="text-end text-nowrap">Rp ${rp(r.jumlahPeristiwa>0?Math.round(r.transportTotalSumber/r.jumlahPeristiwa):0)}</td><td class="text-end text-nowrap">${r.jumlahDiterimaSumber == null ? "–" : "Rp " + rp(Math.round(r.jumlahDiterimaSumber))}</td></tr>`).join('')}</tbody></table></div>` : ''}
  </div></div>`;
};
async function jpLaporan(file, options = {}) {
  if (!file) return false;
  if (!/\.xlsx$/i.test(file.name)) {
    jpToast('Format file harus .xlsx.', 'danger');
    return false;
  }
  const id = options.periodId || jpPeriodId(J.set);
  if (!id) return jpToast('Bulan dan tahun laporan tidak sah.', 'danger'), false;
  const [year, month] = id.split('-').map(Number);
  const existing = J.periods.find(p => p.id === id);
  const settings = options.settings
    ? jpMuatSet(options.settings)
    : id === J.periodId ? jpMuatSet(jpSetOut()) : jpMuatSet(existing?.settings);
  settings.tahun = year;
  settings.bulan = JX.BULAN_LIST[month - 1];

  return jpBusy(options.button, 'Menyimpan laporan…', async () => {
    jpStat('Membaca file…', 'secondary');
    let parsed;
    try {
      await jpX();
      parsed = await JX.parseLaporanFile(file);
    } catch (error) {
      parsed = { ok: false, error: error.message };
    }
    if (parsed.ok && parsed.rows.length > 5000) {
      parsed = { ok: false, error: 'Maksimal 5.000 baris per laporan.' };
    }
    if (!parsed.ok) {
      jpStat('Tersimpan', 'success');
      jpToast(parsed.error, 'danger');
      return false;
    }
    const duplicates = jpDuplikatJadwal(parsed.rows);
    if (duplicates.length) {
      jpStat('Duplikasi ditemukan', 'danger');
      const sample = duplicates.slice(0, 8).map(d =>
        `Baris ${d.baris} memiliki jadwal ganda dengan baris ${d.pertama} (${esc(d.nama)} · ${esc(d.tanggal ? JX.tglID(d.tanggal) : 'tanpa tanggal')}).`
      ).join('<br>');
      jpToast(`Ditemukan ${duplicates.length} jadwal duplikat. Data tidak disimpan. ${sample.replace(/<br>/g, ' ')}`, 'danger');
      return false;
    }
    const nextReport = { fileName: file.name, rows: parsed.rows, tanggalTakSah: parsed.tanggalTakSah || 0 };
    const save = async () => {
      const ok = await jpSavePeriod(id, { laporan: nextReport, settings });
      if (!ok) return false;
      J.historyYear = year;
      J.historySelected = '';
      J.showPreview = false;
      J.periodId = id;
      J.set = jpMuatSet(settings);
      J.laporan = nextReport;
      J.rows = null;
      J.stale = false;
      options.dialog?.close();
      jpRender();
      const dated = parsed.rows.filter(row => JX.tglSah(row.tanggal)).length;
      $('jmsg').innerHTML = note(
        `${parsed.rows.length} baris berhasil disimpan untuk ${esc(jpPeriodLabel(id))}.${parsed.skipped ? ' ' + parsed.skipped + ' baris jumlah dilewati.' : ''}${dated ? ' ' + dated + ' baris memiliki tanggal.' : ''} ${existing?.laporan ? 'Arsip periode ini telah diperbarui; periode lain tetap tersimpan.' : 'Arsip periode baru berhasil dibuat.'}`,
        'success'
      );
      return true;
    };
    if (existing?.laporan) {
      jpModalClass('jp-dialog-upload');
      jpDlg(`<h5 class="mb-1">Perbarui arsip ${esc(jpPeriodLabel(id))}?</h5>
        <p class="text-body-secondary">Laporan yang sudah tersimpan pada periode ini akan diganti dengan file baru. Arsip periode lain tidak berubah.</p>
        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-outline-secondary" data-cancel-upload>Kembali</button>
          <button class="btn btn-primary" data-confirm-upload><i class="bx bx-save"></i> Ganti dan simpan</button>
        </div>`,
      dialog => {
        dialog.classList.add('jp-dialog-upload');
        dialog.querySelector('[data-cancel-upload]').onclick = () => jpUploadDialog(id);
        dialog.querySelector('[data-confirm-upload]').onclick = async event => {
          await jpBusy(event.currentTarget, 'Menyimpan…', save);
        };
      });
      return true;
    }
    return save();
  });
}

/* ---- Dialog pengelolaan Jaspro ---- */
function jpUploadDialog(periodId) {
  jpModalClass('jp-dialog-upload');
  const id = periodId || J.periodId || jpPeriodId(jpDef());
  const [year, month] = id.split('-').map(Number);
  const period = J.periods.find(p => p.id === id);
  jpDlg(`<h5 class="mb-1">Upload laporan XLS</h5>
    <p class="text-body-secondary mb-3">Pilih periode dan file laporan nominatif (.xlsx). Laporan tersimpan per bulan sehingga tidak menimpa periode lain.</p>
    <div class="row g-3 mb-3">
      <div class="col-sm-6"><label class="form-label" for="jp-upload-month">Bulan laporan</label>
        <select id="jp-upload-month" class="form-select">${JX.BULAN_LIST.map((m, i) => `<option value="${i + 1}"${i + 1 === month ? ' selected' : ''}>${m[0] + m.slice(1).toLowerCase()}</option>`).join('')}</select>
      </div>
      <div class="col-sm-6"><label class="form-label" for="jp-upload-year">Tahun laporan</label>
        <input id="jp-upload-year" class="form-control" type="number" min="1900" max="2200" step="1" value="${year}">
      </div>
    </div>
    <label class="jp-upload-pick" for="jp-upload-file">
      <span class="jp-upload-symbol"><i class="bx bx-file"></i></span>
      <strong id="jp-upload-name">Pilih file laporan XLS</strong>
      <small>Format .xlsx · Maksimal 5.000 baris</small>
    </label>
    <input id="jp-upload-file" type="file" accept=".xlsx" hidden>
    ${period?.laporan ? '<div class="alert alert-warning py-2 mt-3 mb-0">Periode ini sudah memiliki arsip. Simpan akan meminta konfirmasi sebelum menggantinya.</div>' : ''}
    <div class="d-flex justify-content-end gap-2 mt-4">
      <button class="btn btn-outline-secondary" data-x>Batal</button>
      <button class="btn btn-primary" data-upload-save disabled><i class="bx bx-save"></i> Simpan laporan</button>
    </div>`,
  d => {
    d.classList.remove('jp-dialog-master', 'jp-dialog-settings');
    d.classList.add('jp-dialog-upload');
    d.querySelector('[data-x]').onclick = () => d.close();
    const input = d.querySelector('#jp-upload-file');
    const saveButton = d.querySelector('[data-upload-save]');
    input.onchange = () => {
      const file = input.files?.[0];
      d.querySelector('#jp-upload-name').textContent = file ? file.name : 'Pilih file laporan XLS';
      saveButton.disabled = !file;
    };
    saveButton.onclick = async () => {
      const file = input.files?.[0];
      const targetYear = Number(d.querySelector('#jp-upload-year').value);
      const targetMonth = Number(d.querySelector('#jp-upload-month').value);
      if (!Number.isInteger(targetYear) || targetYear < 1900 || targetYear > 2200) {
        jpToast('Tahun harus berupa angka 1900 sampai 2200.', 'warning');
        return;
      }
      const targetId = String(targetYear).padStart(4, '0') + '-' + String(targetMonth).padStart(2, '0');
      await jpLaporan(file, { periodId: targetId, dialog: d, button: saveButton });
    };
  });
}

function jpMasterDialog(preserve = false) {
  jpModalClass('jp-dialog-master');
  if (!preserve || !Array.isArray(J.masterDraft)) J.masterDraft = J.master.map(m => ({ ...m }));
  const rows = J.masterDraft.map((m, i) => `<tr>
    <td><input class="form-control form-control-sm" data-mi="${i}" data-mf="nama" value="${esc(m.nama)}" aria-label="Nama penghulu baris ${i + 1}"></td>
    <td><input class="form-control form-control-sm" data-mi="${i}" data-mf="namaPemilik" value="${esc(m.namaPemilik || '')}" aria-label="Nama pemilik rekening baris ${i + 1}"></td>
    <td><input class="form-control form-control-sm" data-mi="${i}" data-mf="noRekening" value="${esc(m.noRekening)}" aria-label="Nomor rekening baris ${i + 1}"></td>
    <td class="text-end"><button type="button" class="btn btn-sm btn-outline-danger" data-master-remove="${i}" aria-label="Hapus baris ${i + 1}"><i class="bx bx-trash"></i></button></td>
  </tr>`).join('');
  jpDlg(`<h5 class="mb-1">Master Rekening</h5>
    <p class="text-body-secondary mb-3">Atur nama penghulu dan nomor rekening. Pencocokan nama digunakan saat membuka rincian laporan.</p>
    <div class="jp-master-toolbar">
      <span class="small text-body-secondary">${J.masterDraft.length} data rekening</span>
      <div class="d-flex flex-wrap gap-2">
        <input id="jp-master-file" type="file" accept=".xlsx" hidden>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-master-import><i class="bx bx-upload"></i> Impor XLS</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" data-master-export><i class="bx bx-download"></i> Ekspor XLS</button>
        <button type="button" class="btn btn-sm btn-outline-primary" data-master-add><i class="bx bx-plus"></i> Tambah baris</button>
      </div>
    </div>
    <div class="jp-master-table-wrap">
      <table class="table table-sm table-hover align-middle mb-0">
        <thead><tr><th>Nama penghulu</th><th>Nama pemilik rekening</th><th>Nomor rekening</th><th></th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="text-center text-body-secondary py-4">Belum ada data. Tambahkan baris atau impor file Excel.</td></tr>'}</tbody>
      </table>
    </div>
    <div id="jp-master-error" class="small text-danger mt-2" role="alert"></div>
    <div class="d-flex justify-content-between align-items-center gap-2 mt-4">
      <button class="btn btn-outline-secondary" data-x>Batal</button>
      <button class="btn btn-primary" data-master-save><i class="bx bx-save"></i> Simpan Master Rekening</button>
    </div>`,
  d => {
    d.classList.remove('jp-dialog-upload', 'jp-dialog-settings');
    d.classList.add('jp-dialog-master');
    d.onclick = async e => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-x')) return d.close();
      if (button.hasAttribute('data-master-add')) {
        J.masterDraft.push({ id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), nama: '', namaPemilik: '', noRekening: '' });
        jpMasterDialog(true);
        d.querySelector('[data-mi="' + (J.masterDraft.length - 1) + '"][data-mf="nama"]')?.focus();
      } else if (button.hasAttribute('data-master-remove')) {
        J.masterDraft.splice(Number(button.getAttribute('data-master-remove')), 1);
        jpMasterDialog(true);
      } else if (button.hasAttribute('data-master-import')) {
        d.querySelector('#jp-master-file').click();
      } else if (button.hasAttribute('data-master-export')) {
        jpMExp(J.masterDraft);
      } else if (button.hasAttribute('data-master-save')) {
        const cleaned = J.masterDraft.map(m => ({
          id: m.id || ('m_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)),
          nama: String(m.nama || '').trim(),
          namaPemilik: String(m.namaPemilik || '').trim() || String(m.nama || '').trim(),
          noRekening: String(m.noRekening || '').trim()
        }));
        const invalid = cleaned.findIndex(m => !m.nama || !m.noRekening);
        if (invalid >= 0) {
          d.querySelector('#jp-master-error').textContent = 'Nama penghulu dan nomor rekening wajib diisi pada baris ' + (invalid + 1) + '.';
          d.querySelector('[data-mi="' + invalid + '"][data-mf="' + (!cleaned[invalid].nama ? 'nama' : 'noRekening') + '"]')?.focus();
          return;
        }
        await jpBusy(button, 'Menyimpan…', async () => {
          const ok = await jpSave({ master: cleaned });
          if (!ok) return false;
          J.masterDraft = null;
          J.stale = true;
          d.close();
          jpRender();
          jpToast('Master Rekening berhasil disimpan.');
          return true;
        });
      }
    };
    d.oninput = e => {
      const input = e.target;
      if (input.dataset.mi == null || !input.dataset.mf) return;
      const row = J.masterDraft[Number(input.dataset.mi)];
      if (row) row[input.dataset.mf] = input.value;
    };
    d.onchange = async e => {
      if (e.target.id !== 'jp-master-file') return;
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!/\.xlsx$/i.test(file.name)) return jpToast('Format file harus .xlsx.', 'danger');
      let parsed;
      try { await jpX(); parsed = await JX.parseMasterFile(file); }
      catch (error) { parsed = { ok: false, error: error.message }; }
      if (!parsed.ok) return jpToast(parsed.error, 'danger');
      const merge = () => {
        const index = JX.buildMasterIndex(J.masterDraft);
        let added = 0, updated = 0;
        parsed.entries.forEach(entry => {
          const matches = index[JX.normalizeCoreName(entry.nama)];
          if (matches?.length === 1) {
            Object.assign(matches[0], { nama: entry.nama, namaPemilik: entry.namaPemilik, noRekening: entry.noRekening });
            updated++;
          } else {
            J.masterDraft.push(entry);
            added++;
          }
        });
        jpMasterDialog(true);
        jpToast(added + ' data ditambahkan, ' + updated + ' data diperbarui.', 'success');
      };
      const replace = () => {
        J.masterDraft = parsed.entries.map(({ id, nama, namaPemilik, noRekening }) => ({
          id: id || ('m_' + Date.now() + '_' + Math.floor(Math.random() * 1e6)), nama, namaPemilik, noRekening
        }));
        jpMasterDialog(true);
        jpToast('Data Master Rekening diganti dari file.', 'success');
      };
      jpModalClass('jp-dialog-settings');
      jpDlg(`<h5 class="mb-2">Impor ${parsed.entries.length} data rekening</h5>
        <p>${J.masterDraft.length ? 'Pilih apakah data dari “' + esc(file.name) + '” akan digabungkan atau mengganti seluruh isi Master Rekening.' : 'Data dari “' + esc(file.name) + '” akan ditambahkan.'}</p>
        <div class="d-grid gap-2">
          <button class="btn btn-primary" data-merge>Gabungkan data</button>
          ${J.masterDraft.length ? '<button class="btn btn-outline-danger" data-replace>Ganti seluruh data</button>' : ''}
          <button class="btn btn-outline-secondary" data-x>Kembali</button>
        </div>`,
      confirm => {
        confirm.classList.add('jp-dialog-settings');
        confirm.querySelector('[data-x]').onclick = () => jpMasterDialog(true);
        confirm.querySelector('[data-merge]').onclick = () => merge();
        confirm.querySelector('[data-replace]')?.addEventListener('click', () => {
          jpModalClass('jp-dialog-settings');
        jpDlg(`<h5 class="mb-1">Ganti seluruh Master Rekening?</h5>
          <p class="text-body-secondary">Seluruh daftar yang sedang diedit akan diganti dengan ${parsed.entries.length} data dari file. Perubahan ini belum dikirim ke server sampai Anda menekan Simpan.</p>
          <div class="d-flex justify-content-end gap-2">
            <button class="btn btn-outline-secondary" data-cancel-replace>Kembali</button>
            <button class="btn btn-danger" data-confirm-replace>Ganti data</button>
          </div>`,
        confirm => {
          confirm.querySelector('[data-cancel-replace]').onclick = () => jpMasterDialog(true);
          confirm.querySelector('[data-confirm-replace]').onclick = replace;
        });
        });
      });
    };
  });
}

function jpMExp(entries = J.master) {
  if (!entries.length) return jpToast('Belum ada data untuk diekspor.', 'warning');
  jpX().then(() => {
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('MASTER');
    ws.columns = [{ width: 5 }, { width: 32 }, { width: 26 }, { width: 20 }];
    ws.addRow(['No', 'Nama', 'NamaPemilik', 'NomorRekening']).font = { bold: true };
    entries.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).forEach((m, i) => {
      ws.addRow([i + 1, m.nama, m.namaPemilik, m.noRekening]).getCell(4).numFmt = '@';
    });
    return JX.downloadWorkbook(wb, 'MASTER_REKENING.xlsx');
  }).then(() => jpToast('Master Rekening diekspor.')).catch(error => jpToast(error.message, 'danger'));
}

function jpSettingsCollect(dialog) {
  const values = { ...J.settingsDraft.values };
  dialog.querySelectorAll('[data-setting]').forEach(input => {
    const key = input.dataset.setting;
    values[key] = key.startsWith('pph') ? Number(input.value || 0) : input.value.trim();
  });
  return values;
}

function jpSettingsDialog(periodId) {
  const id = periodId || J.periodId || jpPeriodId(jpDef());
  const record = J.periods.find(p => p.id === id);
  J.settingsDraft = {
    periodId: id,
    values: jpMuatSet(record?.settings),
    cache: {}
  };
  jpSettingsDialogRender();
}

function jpSettingsDialogRender() {
  jpModalClass('jp-dialog-settings');
  const state = J.settingsDraft;
  const [year, month] = state.periodId.split('-').map(Number);
  const value = state.values;
  jpDlg(`<h5 class="mb-1">Pejabat &amp; PPh</h5>
    <p class="text-body-secondary mb-3">Pengaturan disimpan bersama periode yang dipilih agar tanda tangan dan tarif PPh mengikuti laporan bulan tersebut.</p>
    <div class="row g-3 mb-4">
      <div class="col-sm-6"><label class="form-label" for="jp-setting-month">Bulan laporan</label>
        <select id="jp-setting-month" class="form-select">${JX.BULAN_LIST.map((m, i) => `<option value="${i + 1}"${i + 1 === month ? ' selected' : ''}>${m[0] + m.slice(1).toLowerCase()}</option>`).join('')}</select>
      </div>
      <div class="col-sm-6"><label class="form-label" for="jp-setting-year">Tahun laporan</label>
        <input id="jp-setting-year" class="form-control" type="number" min="1900" max="2200" step="1" value="${year}">
      </div>
    </div>
    <h6 class="mb-2">Tarif PPh Jasa Profesi (%)</h6>
    <p class="small text-body-secondary">PPh dipotong dari Jaspro. Transport tidak dikenakan PPh.</p>
    <div class="row g-3 mb-4">
      ${[['pphII', 'PNS Golongan II'], ['pphIII', 'PNS Golongan III'], ['pphIV', 'PNS Golongan IV'], ['pphPPPK', 'PPPK']].map(([key, label]) => `<div class="col-6 col-lg-3"><label class="form-label" for="jp-${key}">${label}</label><input id="jp-${key}" class="form-control" type="number" min="0" max="100" step="0.01" data-setting="${key}" value="${esc(value[key])}"></div>`).join('')}
    </div>
    <h6 class="mb-2">Pejabat penandatangan</h6>
    <div class="row g-3">
      ${[['kpa', 'Kuasa Pengguna Anggaran'], ['ppk', 'Pejabat Pembuat Komitmen'], ['bendahara', 'Bendahara']].map(([prefix, label]) => `<div class="col-lg-4"><div class="jp-signatory-card"><div class="fw-semibold mb-2">${label}</div>
        <label class="form-label" for="jp-${prefix}-jabatan">Jabatan</label><input id="jp-${prefix}-jabatan" class="form-control mb-2" data-setting="${prefix}Jabatan" value="${esc(value[prefix + 'Jabatan'])}">
        <label class="form-label" for="jp-${prefix}-nama">Nama</label><input id="jp-${prefix}-nama" class="form-control mb-2" data-setting="${prefix}Nama" value="${esc(value[prefix + 'Nama'])}">
        <label class="form-label" for="jp-${prefix}-nip">NIP</label><input id="jp-${prefix}-nip" class="form-control" data-setting="${prefix}Nip" value="${esc(value[prefix + 'Nip'])}">
      </div></div>`).join('')}
      <div class="col-12"><label class="form-label" for="jp-setting-place">Tempat &amp; tanggal</label><input id="jp-setting-place" class="form-control" data-setting="tempatTanggal" value="${esc(value.tempatTanggal)}" placeholder="Indramayu, 30 November 2026"></div>
    </div>
    <div class="d-flex justify-content-end gap-2 mt-4">
      <button class="btn btn-outline-secondary" data-x>Batal</button>
      <button class="btn btn-primary" data-settings-save><i class="bx bx-save"></i> Simpan pengaturan</button>
    </div>`,
  d => {
    d.classList.remove('jp-dialog-upload', 'jp-dialog-master');
    d.classList.add('jp-dialog-settings');
    d.querySelector('[data-x]').onclick = () => { J.settingsDraft = null; d.close(); };
    d.onchange = e => {
      if (!['jp-setting-month', 'jp-setting-year'].includes(e.target.id)) return;
      const currentValues = jpSettingsCollect(d);
      J.settingsDraft.cache[J.settingsDraft.periodId] = currentValues;
      const nextYear = Number(d.querySelector('#jp-setting-year').value);
      const nextMonth = Number(d.querySelector('#jp-setting-month').value);
      if (!Number.isInteger(nextYear) || nextYear < 1900 || nextYear > 2200 || !Number.isInteger(nextMonth) || nextMonth < 1 || nextMonth > 12) {
        jpToast('Periode harus berupa bulan dan tahun yang sah.', 'warning');
        return;
      }
      const nextId = String(nextYear).padStart(4, '0') + '-' + String(nextMonth).padStart(2, '0');
      const cached = J.settingsDraft.cache[nextId];
      const nextRecord = J.periods.find(p => p.id === nextId);
      J.settingsDraft.periodId = nextId;
      J.settingsDraft.values = cached || jpMuatSet(nextRecord?.settings);
      J.settingsDraft.values.tahun = nextYear;
      J.settingsDraft.values.bulan = JX.BULAN_LIST[nextMonth - 1];
      jpSettingsDialogRender();
    };
    d.onclick = async e => {
      const button = e.target.closest('[data-settings-save]');
      if (!button) return;
      const targetId = J.settingsDraft.periodId;
      const values = jpSettingsCollect(d);
      const [targetYear, targetMonth] = targetId.split('-').map(Number);
      values.tahun = targetYear;
      values.bulan = JX.BULAN_LIST[targetMonth - 1];
      const invalid = ['pphII', 'pphIII', 'pphIV', 'pphPPPK'].some(key =>
        !Number.isFinite(values[key]) || values[key] < 0 || values[key] > 100
      );
      if (invalid) return jpToast('Tarif PPh harus berupa angka 0 sampai 100 persen.', 'warning');
      await jpBusy(button, 'Menyimpan…', async () => {
        const ok = await jpSavePeriod(targetId, { settings: values });
        if (!ok) return false;
        if (J.periodId === targetId) {
          J.set = jpMuatSet(values);
          J.rows = null;
          J.showPreview = false;
        }
        J.settingsDraft = null;
        d.close();
        jpRender();
        jpToast('Pengaturan Pejabat & PPh berhasil disimpan.');
        return true;
      });
    };
  });
}

/* ---- Langkah 2: Master Rekening ---- */
const jpMRows = () => {
  const q = JX.normalizeCoreName(J.q), cnt = {};
  J.master.forEach(m => { const k = JX.normalizeCoreName(m.nama); cnt[k] = (cnt[k] || 0) + 1; });
  const L = J.master.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).filter(m => !q || JX.normalizeCoreName(m.nama).includes(q));
  return { n: L.length, html: L.map(m => `<tr><td>${esc(m.nama)}${cnt[JX.normalizeCoreName(m.nama)] > 1 ? ' <span class="badge bg-label-warning" title="Ada lebih dari satu entri dengan nama mirip">duplikat?</span>' : ''}</td><td>${esc(m.namaPemilik || m.nama)}</td><td>${esc(m.noRekening)}</td>
    <td class="text-end text-nowrap"><button class="btn btn-sm btn-outline-secondary px-2" data-act="medit" data-id="${esc(m.id)}" aria-label="Ubah"><i class="bx bx-edit"></i></button> <button class="btn btn-sm btn-outline-danger px-2" data-act="mdel" data-id="${esc(m.id)}" aria-label="Hapus"><i class="bx bx-trash"></i></button></td></tr>`).join('') };
};
const jpMCount = n => `Total: ${J.master.length} penghulu${J.q ? ' · ' + n + ' cocok pencarian' : ''}`;
const pMa = () => {
  const r = jpMRows();
  return `<div class="card"><div class="card-body">
    <h5 class="mb-1">Master Rekening Penghulu</h5><p class="mb-3">Data induk nama &amp; nomor rekening penghulu. Tersimpan di server dan dipakai mengisi nomor rekening pada laporan.</p>
    <div class="d-flex flex-wrap gap-2 mb-3"><div class="input-group" style="max-width:320px"><span class="input-group-text"><i class="bx bx-search"></i></span><input id="jq" type="search" class="form-control" placeholder="Cari nama penghulu…" value="${esc(J.q)}"></div>
      <span class="flex-grow-1"></span><input type="file" id="jfm" accept=".xlsx" hidden>
      <button class="btn btn-outline-secondary" data-act="mimp"><i class="bx bx-upload"></i> Impor Excel</button>
      <button class="btn btn-outline-secondary" data-act="mexp"><i class="bx bx-download"></i> Ekspor Excel</button>
      <button class="btn btn-primary" data-act="madd"><i class="bx bx-plus"></i> Tambah Penghulu</button></div>
    ${J.master.length ? `<div class="scroll"><table class="table table-hover align-middle mb-0"><thead><tr><th>Nama</th><th>Nama Pemilik Rekening</th><th>Nomor Rekening</th><th></th></tr></thead><tbody id="jmt">${r.html}</tbody></table></div><div class="mt-2" id="jmc">${jpMCount(r.n)}</div>`
      : `<div class="text-center py-5"><div class="avatar rounded bg-label-secondary mx-auto mb-2"><i class="bx bx-id-card fs-3"></i></div><div class="fw-semibold">Belum ada data rekening</div><small>Tambah satu per satu, atau impor dari Excel (kolom: Nama, NamaPemilik, NomorRekening).</small></div>`}
  </div></div>`;
};
function jpMForm(id) {
  const m = J.master.find(x => x.id === id);
  jpDlg(`<h5 class="mb-1">${m ? 'Ubah' : 'Tambah'} Penghulu</h5><p class="mb-3">Nama dicocokkan otomatis dengan nama pada laporan nominatif.</p><div id="jfe"></div>
    <label class="form-label">Nama Penghulu</label><input id="jfn" class="form-control mb-3" placeholder="ABDUL KARIM, S.Ag" value="${esc(m?.nama)}">
    <label class="form-label">Nama Pemilik Rekening</label><input id="jfo" class="form-control mb-3" placeholder="(samakan dengan Nama jika kosong)" value="${esc(m?.namaPemilik)}">
    <label class="form-label">Nomor Rekening</label><input id="jfr" class="form-control mb-4" placeholder="7200548398" value="${esc(m?.noRekening)}">
    <div class="d-flex justify-content-end gap-2"><button class="btn btn-outline-secondary" data-x>Batal</button><button class="btn btn-primary" data-ok>${m ? 'Simpan Perubahan' : 'Tambah'}</button></div>`,
  d => {
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelector('[data-ok]').onclick = async () => {
      const nama = $('jfn').value.trim(), rek = $('jfr').value.trim();
      if (!nama || !rek) return $('jfe').innerHTML = note('Nama dan nomor rekening wajib diisi.', 'warning');
      const v = { nama, namaPemilik: $('jfo').value.trim() || nama, noRekening: rek };
      if (m) Object.assign(m, v); else J.master.push({ id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1e6), ...v });
      J.stale = true; d.close();
      if (await jpSave({ master: J.master })) jpToast(`Data "${nama}" disimpan.`);
      jpRender();
    };
  });
}
async function jpImport(f) {
  if (!f) return;
  if (!/\.xlsx$/i.test(f.name)) return jpToast('Format file harus .xlsx', 'danger');
  let r; try { await jpX(); r = await JX.parseMasterFile(f); } catch (e) { r = { ok: false, error: e.message }; }
  if (!r.ok) return jpToast(r.error, 'danger');
  const n = r.entries.length, has = J.master.length, go = async mode => {
    if (mode === 'replace') J.master = r.entries.map(({ id, nama, namaPemilik, noRekening }) => ({ id, nama, namaPemilik, noRekening }));
    else {
      const ix = JX.buildMasterIndex(J.master); let a = 0, u = 0;
      r.entries.forEach(e => {
        const m = ix[JX.normalizeCoreName(e.nama)];
        if (m?.length === 1) { Object.assign(m[0], { nama: e.nama, namaPemilik: e.namaPemilik, noRekening: e.noRekening }); u++; } else { J.master.push(e); a++; }
      });
      jpToast(`${a} data ditambahkan, ${u} diperbarui.`);
    }
    J.stale = true; await jpSave({ master: J.master }); jpRender();
  };
  jpDlg(`<h5 class="mb-2">Impor ${n} data rekening</h5><p>${has ? `Master Rekening saat ini berisi ${has} data. Pilih cara memakai data dari "${esc(f.name)}".` : `Master Rekening masih kosong; ${n} data dari "${esc(f.name)}" akan ditambahkan.`}</p>
    <div class="d-grid gap-2">${has ? '<button class="btn btn-primary" data-m="merge">Gabungkan (perbarui yang cocok, tambah yang baru)</button><button class="btn btn-outline-danger" data-m="replace">Ganti semua data</button>' : `<button class="btn btn-primary" data-m="merge">Tambahkan ${n} data</button>`}<button class="btn btn-outline-secondary" data-x>Batal</button></div>`,
  d => {
    d.querySelector('[data-x]').onclick = () => d.close();
    d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => b.dataset.m === 'replace'
      ? jpAsk('Ganti semua data?', `Seluruh ${has} data Master Rekening akan DIHAPUS dan diganti ${n} data dari file ini.`, 'Ganti Semua', () => go('replace'), true)
      : (d.close(), go('merge')));
  });
}
async function jpMExp() {
  if (!J.master.length) return jpToast('Belum ada data untuk diekspor.', 'warning');
  try {
    await jpX();
    const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('MASTER');
    ws.columns = [{ width: 5 }, { width: 32 }, { width: 26 }, { width: 20 }];
    ws.addRow(['No', 'Nama', 'NamaPemilik', 'NomorRekening']).font = { bold: true };
    J.master.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).forEach((m, i) => { ws.addRow([i + 1, m.nama, m.namaPemilik, m.noRekening]).getCell(4).numFmt = '@'; });
    await JX.downloadWorkbook(wb, 'MASTER_REKENING.xlsx'); jpToast('Master Rekening diekspor.');
  } catch (e) { jpToast(e.message, 'danger'); }
}

/* ---- Riwayat historis Jaspro Transport: halaman utama + tampilan detail ---- */
function pRiwayat() {
  const year = Number(J.historyYear) || new Date().getFullYear();
  const records = J.periods
    .filter(p => p.laporan && Number(p.tahun) === year)
    .sort((a, b) => a.bulan - b.bulan);
  const sums = records.map(period => ({ period, ...jpHitung(period.laporan, jpMuatSet(period.settings)) }));
  const total = key => sums.reduce((n, x) => n + (Number(x[key]) || 0), 0);
  const money = value => 'Rp ' + rp(Math.round(value || 0));
  return `<section class="card jp-history-card">
    <div class="card-body">
      <div class="jp-history-head">
        <div>
          <h5 class="mb-1">Riwayat Tahunan Jaspro Transport</h5>
          <p class="text-body-secondary mb-0">Pilih tahun untuk melihat laporan bulanan dan rincian pembayaran.</p>
        </div>
        <div class="jp-year-control">
          <label class="form-label mb-1" for="jp-history-year">Tahun laporan</label>
          <input id="jp-history-year" class="form-control" type="number" min="1900" max="2200" step="1"
            data-history-year value="${esc(year)}" aria-label="Tahun laporan">
        </div>
      </div>
      ${records.length ? `
        <div class="row g-3 mb-4">
          ${jpCard('bx-wallet', 'primary', money(total('jaspro')), 'Total Jaspro bersih')}
          ${jpCard('bx-bus', 'info', money(total('transport')), 'Total Transport')}
          ${jpCard('bx-calculator', 'success', money(total('total')), 'Total diterima')}
          ${jpCard('bx-calendar-check', 'warning', total('peristiwa'), 'Total peristiwa')}
        </div>
        <div class="jp-table-wrap">
          <table class="table table-hover align-middle mb-0 jp-history-table">
            <thead><tr>
              <th>Bulan</th><th class="text-end">Baris</th><th class="text-end">Peristiwa</th>
              <th class="text-end">Jaspro bruto</th><th class="text-end">PPh</th>
              <th class="text-end">Jaspro bersih</th><th class="text-end">Transport</th>
              <th class="text-end">Total diterima</th><th class="text-end">Aksi</th>
            </tr></thead>
            <tbody>${sums.map(x => `<tr>
              <td class="fw-semibold">${esc(JX.BULAN_LIST[x.period.bulan - 1])}</td>
              <td class="text-end">${x.rows.length}</td><td class="text-end">${x.peristiwa}</td>
              <td class="text-end text-nowrap">${money(x.jasproBruto)}</td>
              <td class="text-end text-nowrap">${money(x.pph)}</td>
              <td class="text-end text-nowrap">${money(x.jaspro)}</td>
              <td class="text-end text-nowrap">${money(x.transport)}</td>
              <td class="text-end text-nowrap fw-semibold">${money(x.total)}</td>
              <td class="text-end text-nowrap">
                <button class="btn btn-sm btn-primary" data-act="hdetail" data-id="${esc(x.period.id)}">Detail</button>
                <button class="btn btn-sm btn-outline-secondary" data-act="hedit" data-id="${esc(x.period.id)}" title="Unggah ulang periode ini" aria-label="Unggah ulang ${esc(jpPeriodLabel(x.period.id))}"><i class="bx bx-upload"></i></button>
                <button class="btn btn-sm btn-outline-danger" data-act="hdel" data-id="${esc(x.period.id)}" title="Hapus arsip periode" aria-label="Hapus ${esc(jpPeriodLabel(x.period.id))}"><i class="bx bx-trash"></i></button>
              </td>
            </tr>`).join('')}</tbody>
            <tfoot><tr class="fw-bold">
              <td colspan="2">TOTAL ${year}</td><td class="text-end">${total('peristiwa')}</td>
              <td class="text-end text-nowrap">${money(total('jasproBruto'))}</td>
              <td class="text-end text-nowrap">${money(total('pph'))}</td>
              <td class="text-end text-nowrap">${money(total('jaspro'))}</td>
              <td class="text-end text-nowrap">${money(total('transport'))}</td>
              <td class="text-end text-nowrap">${money(total('total'))}</td><td></td>
            </tr></tfoot>
          </table>
        </div>` : `
        <div class="jp-empty">
          <div class="jp-empty-icon"><i class="bx bx-folder-open"></i></div>
          <h6 class="mb-1">Belum ada laporan pada tahun ${year}</h6>
          <p class="text-body-secondary mb-3">Arsip untuk tahun ini masih kosong. Unggah laporan XLS untuk mulai mencatat periode bulanan.</p>
          <button class="btn btn-primary" data-act="upload-open"><i class="bx bx-upload"></i> Upload laporan XLS</button>
        </div>`}
    </div>
  </section>`;
}

function jpBuildMatchedRows(laporan, settings) {
  const index = JX.buildMasterIndex(J.master);
  return (laporan?.rows || []).map(row => {
    const match = JX.matchPenghulu(row.nama, J.master, index);
    return {
      ...row,
      ...JX.classifyRow(row, settings || jpDef()),
      rekening: match.entry?.noRekening || row.noRekeningSumber || '',
      namaPemilik: match.entry?.namaPemilik || '',
      matchStatus: match.entry ? match.status : 'TIDAK_DITEMUKAN',
      candidates: match.candidates || []
    };
  });
}

function jpDetailPeriode(period) {
  const settings = jpMuatSet(period.settings);
  const data = jpHitung(period.laporan, settings);
  const rows = jpBuildMatchedRows(period.laporan, settings);
  const f = value => 'Rp ' + rp(Math.round(value || 0));
  const missing = rows.filter(r => !r.rekening || !['OTOMATIS', 'MANUAL'].includes(r.matchStatus)).length;
  const adaTgl = rows.some(r => JX.tglSah(r.tanggal));
  return `<section class="card jp-detail-card">
    <div class="card-body">
      <div class="jp-detail-top">
        <button class="btn btn-outline-secondary" data-act="hback"><i class="bx bx-arrow-back"></i> Kembali ke riwayat</button>
        <span class="text-body-secondary small">Tahun ${period.tahun}</span>
      </div>
      <div class="jp-detail-title">
        <div>
          <h5 class="mb-1">Rincian ${esc(jpPeriodLabel(period.id))}</h5>
          <p class="text-body-secondary mb-0">Sumber: ${esc(period.laporan?.fileName || 'Laporan Nominatif')}</p>
        </div>
        <span class="badge bg-label-primary">${rows.length} baris</span>
      </div>
      <div class="row g-3 mb-4">
        ${jpCard('bx-wallet', 'primary', f(data.jasproBruto), 'Jaspro bruto')}
        ${jpCard('bx-receipt', 'warning', f(data.pph), 'Potongan PPh')}
        ${jpCard('bx-wallet', 'success', f(data.jaspro), 'Jaspro bersih')}
        ${jpCard('bx-bus', 'info', f(data.transport), 'Transport')}
        ${jpCard('bx-calculator', 'primary', f(data.total), 'Total diterima')}
        ${jpCard('bx-check-double', data.mismatchCount ? 'warning' : 'success', data.mismatchCount, 'Selisih kolom J')}
      </div>
      ${missing ? `<div class="alert alert-warning py-2" role="status">${missing} baris belum memiliki kecocokan rekening yang dapat dipastikan. Periksa nama penghulu pada Master Rekening sebelum mengunduh nominatif.</div>` : ''}
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h6 class="mb-0">Rincian per penghulu</h6>
        <button class="btn btn-primary" data-act="detail-process">${J.showPreview ? '<i class="bx bx-refresh"></i> Perbarui pratinjau' : '<i class="bx bx-check-double"></i> Cocokkan &amp; Pratinjau Data'}</button>
      </div>
      <div class="jp-table-wrap">
        <table class="table table-sm table-hover align-middle mb-0 jp-detail-table">
          <thead><tr>
            <th>No</th><th>Nama Penghulu</th><th>KUA</th><th>NIP</th><th>Golongan</th>
            <th>Nomor rekening</th><th>Status rekening</th>${adaTgl ? '<th>Tanggal</th>' : ''}
            <th class="text-end">Peristiwa (G)</th><th class="text-end">Jaspro/peristiwa</th>
            <th class="text-end">Transport/peristiwa</th><th class="text-end">Jaspro bruto</th>
            <th class="text-end">Transport bruto</th><th class="text-end">Diterima file (J)</th>
            <th class="text-end">Total bruto (H+I)</th><th>Pemeriksaan</th>
          </tr></thead>
          <tbody>${rows.map((r, i) => {
            const [tone, label] = JST[r.matchStatus] || JST.TIDAK_DITEMUKAN;
            const rekening = r.rekening ? esc(r.rekening) : '<span class="text-warning">Belum tersedia</span>';
            const status = r.matchStatus === 'TIDAK_DITEMUKAN' ? 'Tidak cocok' : r.matchStatus === 'AMBIGU' ? 'Perlu dipilih' : r.matchStatus === 'OTOMATIS_FUZZY' ? 'Nama mirip' : r.matchStatus === 'MANUAL' ? 'Manual' : 'Cocok otomatis';
            return `<tr class="${!r.rekening || !['OTOMATIS', 'MANUAL'].includes(r.matchStatus) ? 'issue' : ''}">
              <td>${i + 1}</td><td>${esc(r.nama)}</td><td>${esc(r.kua)}</td><td>${esc(r.nip)}</td><td>${esc(r.golongan)}</td>
              <td class="text-nowrap">${rekening}</td><td><span class="badge bg-label-${tone}" title="${label}">${status}</span></td>
              ${adaTgl ? `<td class="text-nowrap">${JX.tglSah(r.tanggal) ? JX.tglID(r.tanggal) : '–'}</td>` : ''}
              <td class="text-end">${r.jumlahPeristiwa}</td><td class="text-end text-nowrap">${f(r.tarifJaspro)}</td>
              <td class="text-end text-nowrap">${f(r.tarifTransport)}</td><td class="text-end text-nowrap">${f(r.jasproSubtotal)}</td>
              <td class="text-end text-nowrap">${f(r.transpoSubtotal)}</td><td class="text-end text-nowrap">${r.jumlahDiterimaSumber == null ? '–' : f(r.jumlahDiterimaSumber)}</td>
              <td class="text-end text-nowrap fw-semibold">${f(r.jumlahDiterimaHitung)}</td>
              <td>${r.jumlahDiterimaSumber == null ? '<span class="badge bg-label-secondary">Tidak ada di file</span>' : r.jumlahDiterimaCocok ? '<span class="badge bg-label-success">Sesuai</span>' : '<span class="badge bg-label-warning">Selisih ' + f(Math.abs(r.selisihJumlahDiterima)) + '</span>'}</td>
            </tr>`;
          }).join('')}</tbody>
          <tfoot><tr class="fw-bold">
            <td colspan="${adaTgl ? 8 : 7}">TOTAL</td><td class="text-end">${data.peristiwa}</td><td class="text-end">–</td><td class="text-end">–</td>
            <td class="text-end text-nowrap">${f(data.jasproBruto)}</td><td class="text-end text-nowrap">${f(data.transport)}</td>
            <td class="text-end text-nowrap">${f(data.sourceTotal)}</td><td class="text-end text-nowrap">${f(data.jasproBruto + data.transport)}</td>
            <td>${data.mismatchCount ? data.mismatchCount + ' baris selisih' : '—'}</td>
          </tr></tfoot>
        </table>
      </div>
      ${J.showPreview ? `<div id="jrev" class="jp-nominatif-preview">${jpReviewHtml()}</div>` : '<div id="jrev"></div>'}
    </div>
  </section>`;
}

/* ---- Langkah 3: Proses & Unduh ---- */
// Tarif dasar + perubahan tarif menurut tanggal. Baris pertama = tarif dasar (berlaku sejak awal); baris berikutnya = perubahan yang
// berlaku MULAI tanggalnya. Nominal dikosongkan bila tarif itu tidak ikut berubah (Jasa Profesi dan Transport bisa berubah sendiri-sendiri).
const pTarif = () => {
  const L = J.set.tarifRiwayat, ang = x => x == null ? '' : esc(x);
  const num = extra => `<input type="number" min="0" max="${JX.TARIF_MAKS}" step="any" class="form-control form-control-sm" ${extra}>`;
  return `<p class="small text-body-secondary mb-2">Isi tarif dasar, lalu tambahkan perubahan bila tarif berganti pada tanggal tertentu (mis. setelah ada aturan baru). Perubahan berlaku mulai tanggal yang diisi (tanggal itu sendiri sudah memakai tarif baru) dan nominalnya boleh berbeda di tiap perubahan. Kosongkan satu nominal bila tarif itu tidak berubah.</p>
    <div class="table-responsive"><table class="table table-sm align-middle mb-2" id="jtr"><thead><tr><th style="min-width:170px">Berlaku mulai</th><th style="min-width:150px">Jasa Profesi (Rp)</th><th style="min-width:150px">Transport (Rp)</th><th></th></tr></thead><tbody>
      <tr><td class="text-body-secondary">Sejak awal (tarif dasar)</td><td>${num(`data-s="tarifJaspro" data-n value="${ang(J.set.tarifJaspro)}" aria-label="Tarif dasar Jasa Profesi"`)}</td><td>${num(`data-s="tarifTransport" data-n value="${ang(J.set.tarifTransport)}" aria-label="Tarif dasar Transport"`)}</td><td></td></tr>
      ${L.map((e, i) => `<tr><td><input type="date" class="form-control form-control-sm" data-t="mulai" data-k="${i}" value="${esc(e.mulai)}" aria-label="Perubahan ${i + 1}: berlaku mulai tanggal"></td>
        <td>${num(`data-t="jaspro" data-k="${i}" value="${ang(e.jaspro)}" placeholder="tidak berubah" aria-label="Perubahan ${i + 1}: Jasa Profesi baru"`)}</td>
        <td>${num(`data-t="transport" data-k="${i}" value="${ang(e.transport)}" placeholder="tidak berubah" aria-label="Perubahan ${i + 1}: Transport baru"`)}</td>
        <td class="text-end"><button class="btn btn-sm btn-outline-danger px-2" data-act="tdel" data-k="${i}" aria-label="Hapus perubahan ${i + 1}"><i class="bx bx-trash"></i></button></td></tr>`).join('')}
    </tbody></table></div>
    <button class="btn btn-sm btn-outline-primary mb-3" data-act="tadd"><i class="bx bx-plus"></i> Tambah perubahan tarif</button>
    <div class="row g-3 mb-3"><div class="col-sm-6 col-lg-4"><label class="form-label">Tanggal acuan (opsional)</label><input type="date" class="form-control" data-s="tanggalAcuan" value="${esc(J.set.tanggalAcuan)}"><div class="form-text">Menentukan tarif baris laporan yang tidak punya tanggal. Kosong = hari terakhir bulan laporan.</div></div></div>
    <div id="jtsum" class="mb-4">${jpTarifRingkas()}</div>`;
};
// Ringkasan: tarif yang berlaku pada bulan laporan, peringatan bila tarif berubah di tengah bulan, dan perubahan yang belum lengkap.
function jpTarifRingkas() {
  const s = J.set, P = JX.riwayatPeriksa(s.tarifRiwayat), a = JX.awalBulan(s.bulan, s.tahun), z = JX.akhirBulan(s.bulan, s.tahun), seg = JX.tarifSegmen(s, a, z);
  const R = x => `Rp ${rp(Math.round(x))}`, acuan = JX.tglID(JX.tanggalAcuan(s));
  let h = '';
  if (P.masalah.length) h += `<div class="alert alert-warning py-2"><div class="fw-semibold">Perubahan tarif ini belum dihitung dan belum disimpan:</div><ul class="mb-0 ps-3">${P.masalah.map(m => `<li>Baris ${m.i + 1}: ${esc(m.pesan)}</li>`).join('')}</ul></div>`;
  if (!seg.length) return h + '<div class="small text-body-secondary">Pilih bulan dan isi tahun yang sah untuk melihat tarif yang berlaku.</div>';
  h += `<div class="border rounded p-3" style="background:rgba(67,89,113,.04)"><div class="fw-semibold mb-1">Tarif yang berlaku pada ${esc(s.bulan[0] + s.bulan.slice(1).toLowerCase())} ${esc(s.tahun)}</div>${seg.map(g =>
    `<div class="small">${JX.tglID(g.dari)}${g.sampai !== g.dari ? ' – ' + JX.tglID(g.sampai) : ''}: Jasa Profesi <b>${R(g.jaspro)}</b> · Transport <b>${R(g.transport)}</b></div>`).join('')}</div>`;
  if (seg.length > 1) {
    const L = J.laporan?.rows || [], ada = L.some(r => JX.tglSah(r.tanggal)), tanpa = !L.length || L.some(r => !JX.tglSah(r.tanggal));
    h += `<div class="alert alert-info py-2 mt-2 mb-0">Tarif berubah di tengah bulan ini. ${!ada
      ? `Laporan yang dimuat tidak memiliki kolom Tanggal, sehingga seluruh baris memakai tarif per ${acuan} (tanggal acuan). Untuk memisahkan peristiwa sebelum dan sesudah perubahan, unggah laporan dengan kolom Tanggal (satu baris per penghulu per tanggal) atau ubah tanggal acuan.`
      : tanpa ? `Baris bertanggal memakai tarif sesuai tanggalnya; baris tanpa tanggal memakai tarif per ${acuan} (tanggal acuan).` : 'Setiap baris laporan memakai tarif sesuai tanggalnya.'}</div>`;
  }
  return h;
}
const jpTarifRefresh = () => { const b = $('jtsum'); if (b) b.innerHTML = jpTarifRingkas(); };
function jpUrutRiwayat() {   // perubahan yang tanggalnya sah diurutkan naik; baris yang belum lengkap tetap di bawah (urutan aslinya)
  const L = J.set.tarifRiwayat.map((e, i) => [e, i]);
  L.sort(([a, i], [b, j]) => { const x = JX.tglSah(a.mulai), y = JX.tglSah(b.mulai); return x && y ? (a.mulai < b.mulai ? -1 : a.mulai > b.mulai ? 1 : i - j) : x ? -1 : y ? 1 : i - j; });
  J.set.tarifRiwayat = L.map(([e]) => e);
}
const pPr = () => {
  const f = (k, l, n, c = 'col-sm-6 col-lg-3') => `<div class="${c}"><label class="form-label">${l}</label><input class="form-control" ${n ? 'type="number" min="0" data-n' : 'type="text"'} data-s="${k}" value="${esc(J.set[k])}"></div>`;
  return `<div class="card mb-4"><div class="card-body">
    <h5 class="mb-1">Proses &amp; Unduh Laporan</h5><p class="mb-4">Tarif per peristiwa dihitung dari total Jasa Profesi pada kolom H ÷ jumlah peristiwa pada G, serta total Transport pada I ÷ G. Aplikasi mengalikan kembali tarif tersebut dengan jumlah peristiwa, menghitung PPh, lalu menampilkan total bruto dan nilai dibayarkan sebelum membuat Excel atau CSV.</p>
    <p class="small text-body-secondary mb-4">Periode aktif: <b>${esc(jpPeriodLabel(J.periodId))}</b>. Pengaturan PPh dan tanda tangan disimpan bersama arsip periode ini.</p>
    <h6 class="text-uppercase small">Tarif PPh Jasa Profesi (%) <span class="fw-normal text-lowercase">· transport tidak dikenakan PPh</span></h6>
    <div class="row g-3 mb-4">${f('pphII', 'PNS Golongan II', 1)}${f('pphIII', 'PNS Golongan III', 1)}${f('pphIV', 'PNS Golongan IV', 1)}${f('pphPPPK', 'PPPK Golongan IX', 1)}</div>
    <h6 class="text-uppercase small">Blok tanda tangan</h6>
    <div class="row g-3 mb-3">${f('tempatTanggal', 'Tempat &amp; tanggal', 0, 'col-sm-6 col-lg-4')}</div>
    <div class="row g-3">${[['kpa', 'Kolom Kiri'], ['ppk', 'Kolom Tengah'], ['bendahara', 'Kolom Kanan']].map(([p, t]) => `<div class="col-lg-4"><div class="border rounded p-3"><div class="fw-semibold">${t}</div>${[['Jabatan', 'Jabatan'], ['Nama', 'Nama'], ['Nip', 'NIP']].map(([k, l]) => `<label class="form-label mt-2 mb-1">${l}</label><input class="form-control form-control-sm" data-s="${p + k}" value="${esc(J.set[p + k])}">`).join('')}</div></div>`).join('')}</div>
    <div class="d-flex flex-wrap justify-content-end align-items-center gap-3 mt-4"><span id="jph" class="small"></span><button class="btn btn-primary" id="jpb" data-act="proc"><i class="bx bx-check-double"></i> Cocokkan &amp; Pratinjau Data</button></div>
  </div></div><div id="jrev"></div>`;
};
function jpProcBtn() {
  const b = $('jpb'); if (!b) return;
  const l = J.laporan?.rows?.length, m = J.master.length;
  b.disabled = !(l && m);
  $('jph').textContent = !l && !m ? 'Lengkapi Input Laporan dan Master Rekening terlebih dahulu.' : !l ? 'Unggah Laporan Nominatif terlebih dahulu.' : !m ? 'Tambahkan data Master Rekening terlebih dahulu.' : J.stale && J.rows ? 'Data sumber berubah — klik untuk memperbarui pratinjau.' : '';
}
function jpProcess() {
  if (!J.laporan?.rows?.length) return jpToast('Laporan periode ini belum tersedia.', 'warning');
  if (!J.master.length) return jpToast('Master Rekening masih kosong. Isi Master Rekening terlebih dahulu untuk mencocokkan penerima.', 'warning');
  J.rows = jpBuildMatchedRows(J.laporan, J.set);
  J.stale = false;
  J.showPreview = true;
  jpRender();
  document.getElementById('jrev')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function jpReviewHtml() {
  const R = J.rows;
  if (!R) return '';
  const sum = key => R.reduce((s, r) => s + (Number(r[key]) || 0), 0);
  const ok = R.filter(r => r.matchStatus === 'OTOMATIS').length;
  const bad = R.filter(r => !['OTOMATIS', 'MANUAL'].includes(r.matchStatus) || !r.rekening).length;
  const adaTgl = R.some(r => JX.tglSah(r.tanggal));
  const cekJ = R.filter(r => r.jumlahDiterimaSumber != null);
  const bedaJ = cekJ.filter(r => !r.jumlahDiterimaCocok).length;
  return `<section class="card mt-4">
    <div class="card-body">
      <div class="jp-review-head">
        <div>
          <h6 class="mb-1">Pratinjau nominatif</h6>
          <p class="text-body-secondary small mb-0">Periksa rekening, golongan, dan hasil perhitungan sebelum mengunduh.</p>
        </div>
        <span class="badge bg-label-secondary">${R.length} baris</span>
      </div>
      <div class="row g-3 mb-3">
        ${jpCard('bx-check-circle', 'success', ok, 'Cocok otomatis')}
        ${jpCard('bx-error', bad ? 'warning' : 'success', bad, 'Perlu ditinjau')}
        ${jpCard('bx-wallet', 'info', 'Rp ' + rp(Math.round(sum('jasproDiterima'))), 'Jaspro bersih')}
        ${jpCard('bx-bus', 'info', 'Rp ' + rp(Math.round(sum('transpoDiterima'))), 'Transport')}
        ${jpCard('bx-check-double', bedaJ ? 'warning' : 'success', cekJ.length ? (cekJ.length - bedaJ) + '/' + cekJ.length : '–', 'Pemeriksaan kolom J')}
      </div>
      <p class="small text-body-secondary mb-3">Tarif per peristiwa = H ÷ G untuk Jaspro dan I ÷ G untuk Transport. Kolom J dibandingkan dengan jumlah bruto H+I sebelum PPh. Perubahan rekening di tabel ini hanya berlaku untuk pratinjau dan unduhan saat ini.</p>
      <div class="jp-table-wrap">
        <table class="table align-middle mb-0 jp-review-table">
          <thead><tr><th>No</th><th>Nama</th><th>KUA</th><th>NIP</th><th>Golongan</th><th>Status</th><th>No. Rekening</th><th>Nama Pemilik</th>${adaTgl ? '<th>Tanggal</th>' : ''}<th class="text-end">Peristiwa</th><th class="text-end">Jaspro bersih</th><th class="text-end">Transport</th><th class="text-end">Diterima file (J)</th><th class="text-end">Hasil bruto</th><th>Pemeriksaan</th><th class="text-end">Dibayarkan</th></tr></thead>
          <tbody>${R.map((r, i) => {
            const [tone, label] = JST[r.matchStatus] || JST.TIDAK_DITEMUKAN;
            const isBad = !['OTOMATIS', 'MANUAL'].includes(r.matchStatus) || !r.rekening;
            const candidate = r.candidates?.[0];
            const unknown = r.golClass === 'UNKNOWN';
            return `<tr class="${isBad ? 'issue' : ''}">
              <td>${i + 1}</td><td>${esc(r.nama)}</td><td>${esc(r.kua)}</td><td>${esc(r.nip)}</td>
              <td><input class="form-control form-control-sm" style="width:84px" data-i="${i}" data-f="gol" value="${esc(r.golongan)}"><span class="badge bg-label-${unknown ? 'danger' : 'secondary'} mt-1">${unknown ? '? tidak dikenali' : esc(JX.golonganLabel(r.golClass))}</span></td>
              <td><span class="badge bg-label-${tone}">${label}</span>${isBad && candidate ? `<button class="btn btn-link btn-sm p-0 d-block text-start" data-act="use" data-i="${i}">Pakai: ${esc(candidate.nama.slice(0, 22))}${candidate.nama.length > 22 ? '…' : ''}</button>` : ''}</td>
              <td><input class="form-control form-control-sm" style="width:140px" list="jdl-list" data-i="${i}" data-f="rek" value="${esc(r.rekening)}" aria-label="Nomor rekening ${esc(r.nama)}"></td>
              <td><input class="form-control form-control-sm" style="width:160px" data-i="${i}" data-f="own" value="${esc(r.namaPemilik || '')}" placeholder="Sama dengan nama" aria-label="Nama pemilik rekening ${esc(r.nama)}"></td>
              ${adaTgl ? `<td class="text-nowrap">${JX.tglSah(r.tanggal) ? JX.tglID(r.tanggal) : '–'}</td>` : ''}
              <td class="text-end">${esc(r.jumlahPeristiwa)}</td>
              <td class="text-end text-nowrap">${rp(Math.round(r.jasproDiterima))}<div class="small text-body-secondary">@ ${rp(r.tarifJaspro)}</div></td>
              <td class="text-end text-nowrap">${rp(Math.round(r.transpoDiterima))}<div class="small text-body-secondary">@ ${rp(r.tarifTransport)}</div></td>
              <td class="text-end text-nowrap">${r.jumlahDiterimaSumber == null ? '–' : rp(Math.round(r.jumlahDiterimaSumber))}</td>
              <td class="text-end text-nowrap fw-semibold">${rp(Math.round(r.jumlahDiterimaHitung))}</td>
              <td>${r.jumlahDiterimaSumber == null ? '<span class="badge bg-label-secondary">Tidak ada di file</span>' : r.jumlahDiterimaCocok ? '<span class="badge bg-label-success">Sesuai</span>' : '<span class="badge bg-label-warning">Selisih Rp ' + rp(Math.abs(Math.round(r.selisihJumlahDiterima))) + '</span>'}</td>
              <td class="text-end text-nowrap fw-semibold">${rp(Math.round(r.jumlahDiterimaBersih))}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <datalist id="jdl-list">${J.master.map(m => `<option value="${esc(m.noRekening)}">${esc(m.nama)}</option>`).join('')}</datalist>
      <div class="jp-download-row">
        <span class="small text-body-secondary">Unduh data hasil pencocokan</span>
        <div class="d-flex flex-wrap gap-2">
          <details class="jp-csv-menu">
            <summary class="btn btn-outline-secondary"><i class="bx bx-download"></i> Unduh CSV</summary>
            <div class="jp-csv-options">
              <button type="button" data-act="dcj">CSV Jaspro</button>
              <button type="button" data-act="dct">CSV Transport</button>
            </div>
          </details>
          <button class="btn btn-primary" data-act="dxl"><i class="bx bx-file"></i> Unduh Excel</button>
        </div>
      </div>
    </div>
  </section>`;
}
function jpReview() {
  const host = $('jrev');
  if (host) host.innerHTML = jpReviewHtml();
}
// Tarif (kind: xlsx = keduanya | jaspro | transpo) berubah di tengah bulan laporan?
function jpTarifBerubah(kind = 'xlsx') {
  const legacyRows = (J.rows || []).filter(r => r.jasproTotalSumber == null || r.transportTotalSumber == null);
  if (!legacyRows.length) return false;
  const s = J.set;
  return JX.tarifSegmen(s, JX.awalBulan(s.bulan, s.tahun), JX.akhirBulan(s.bulan, s.tahun), kind === 'xlsx' ? undefined : kind === 'jaspro' ? 'jaspro' : 'transport').length > 1;
}
// Hanya arsip lama tanpa tarif pada file yang masih menggunakan tarif historis dari pengaturan.
function jpTarifTengah(kind) {
  if (!J.rows || !jpTarifBerubah(kind)) return null;
  const n = J.rows.filter(r => (r.jasproTotalSumber == null || r.transportTotalSumber == null) && !JX.tglSah(r.tanggal)).length;
  return n ? { n, acuan: JX.tglID(JX.tanggalAcuan(J.set)) } : null;
}
function jpDl(kind) {
  const unresolved = J.rows.filter(row =>
    !row.rekening || !['OTOMATIS', 'MANUAL'].includes(row.matchStatus)
  ).length;
  const unknownGrade = J.rows.filter(row => row.golClass === 'UNKNOWN').length;
  const middle = jpTarifTengah(kind);
  const message = [
    unresolved && `${unresolved} baris belum memiliki kecocokan nama/nomor rekening yang dapat dipastikan`,
    kind === 'xlsx' && unknownGrade && `${unknownGrade} baris golongan tidak dikenali (PPh dihitung 0%)`,
    middle && `${middle.n} baris tanpa tanggal memakai tarif per ${middle.acuan} padahal tarif berubah di tengah bulan`
  ].filter(Boolean).join(' dan ');
  const download = () => kind === 'xlsx' ? jpExcel() : jpCsv(kind);
  if (message) {
    jpAsk(
      'Masih ada data yang perlu ditinjau',
      message + '. Periksa pratinjau. File tetap dapat dibuat, tetapi kolom rekening atau tarif yang belum pasti dapat memerlukan koreksi. Lanjutkan mengunduh?',
      'Lanjutkan Unduh',
      download
    );
  } else {
    download();
  }
}
async function jpExcel() {
  const s = J.set, f = { tempatTanggal: s.tempatTanggal || '' };
  ['kpa', 'ppk', 'bendahara'].forEach(p => ['Jabatan', 'Nama', 'Nip'].forEach(k => f[p + k] = s[p + k]));
  try {
    await jpX();
    const n = `${s.bulan}_LAPORAN_NOMINATIF_PNBP_NR_${s.tahun}.xlsx`;
    await JX.downloadWorkbook(await JX.buildOutputWorkbook(J.rows, s, f), n); jpToast('Laporan diunduh: ' + n);
  } catch (e) { jpToast('Gagal membuat file: ' + e.message, 'danger'); }
}
function jpCsv(kind) {
  const s = J.set, n = `${s.bulan}_CSV_${kind === 'jaspro' ? 'JASPRO' : 'TRANSPORT'}_${s.tahun}.csv`;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([JX.buildCsvContent(JX.buildDisbursementRows(J.rows, J.master, kind))], { type: 'text/csv;charset=utf-8' })), download: n });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); jpToast('CSV diunduh: ' + n);
}

/* ---- Event (delegasi pada #jroot) ---- */
function jpDefaultPeriodForYear(year = J.historyYear) {
  const y = Number(year) || new Date().getFullYear();
  const periods = J.periods.filter(p => Number(p.tahun) === y).sort((x, z) => z.bulan - x.bulan);
  if (periods.length) {
    const selected = J.periods.find(p => p.id === J.historySelected && Number(p.tahun) === y);
    return selected?.id || periods[0].id;
  }
  const now = new Date();
  const month = y === now.getFullYear() ? now.getMonth() + 1 : now.getMonth() + 1;
  return String(y).padStart(4, '0') + '-' + String(month).padStart(2, '0');
}

async function jpDeletePeriod(id, button, dialog) {
  return jpBusy(button, 'Menghapus…', async () => {
    try {
      jpStat('Menghapus…', 'secondary');
      const { error } = await sb.from('jaspro_periode').delete().eq('id', id);
      if (error) {
        jpStat('Gagal menghapus', 'danger');
        jpToast('Gagal menghapus periode: ' + error.message, 'danger');
        return false;
      }
      J.periods = J.periods.filter(p => p.id !== id);
      if (J.periodId === id) jpLoadPeriod(jpDefaultPeriodForYear());
      if (J.historySelected === id) J.historySelected = '';
      J.showPreview = false;
      dialog.close();
      jpRender();
      jpToast('Arsip ' + jpPeriodLabel(id) + ' berhasil dihapus.');
      return true;
    } catch (error) {
      jpStat('Gagal menghapus', 'danger');
      jpToast('Gagal menghapus periode: ' + (error?.message || error), 'danger');
      return false;
    }
  });
}

function jpDeletePeriodDialog(id) {
  const period = J.periods.find(p => p.id === id);
  if (!period) return;
  jpModalClass();
  jpDlg(`<h5 class="mb-1">Hapus arsip ${esc(jpPeriodLabel(id))}?</h5>
    <p class="text-body-secondary">Laporan, pengaturan tarif, dan rincian periode ini akan dihapus permanen. Periode lain dan Master Rekening tidak terpengaruh.</p>
    <div class="d-flex justify-content-end gap-2">
      <button class="btn btn-outline-secondary" data-cancel-delete>Batal</button>
      <button class="btn btn-danger" data-confirm-delete><i class="bx bx-trash"></i> Hapus periode</button>
    </div>`,
  dialog => {
    dialog.querySelector('[data-cancel-delete]').onclick = () => dialog.close();
    dialog.querySelector('[data-confirm-delete]').onclick = event =>
      jpDeletePeriod(id, event.currentTarget, dialog);
  });
}

function jpClick(e) {
  const button = e.target.closest('[data-act]');
  if (!button) return;
  const action = button.dataset.act;
  const id = button.dataset.id;

  if (action === 'upload-open') jpUploadDialog(jpDefaultPeriodForYear());
  else if (action === 'master-open') jpMasterDialog();
  else if (action === 'settings-open') jpSettingsDialog(jpDefaultPeriodForYear());
  else if (action === 'hdetail') {
    const period = J.periods.find(p => p.id === id && p.laporan);
    if (!period) return jpToast('Laporan periode ini tidak ditemukan.', 'warning');
    J.historyYear = Number(period.tahun);
    J.historySelected = id;
    J.showPreview = false;
    jpLoadPeriod(id);
    jpRender();
  } else if (action === 'hback') {
    J.historySelected = '';
    J.showPreview = false;
    J.rows = null;
    jpRender();
  } else if (action === 'hedit') {
    if (J.periods.some(p => p.id === id)) jpUploadDialog(id);
  } else if (action === 'hdel') {
    jpDeletePeriodDialog(id);
  } else if (action === 'detail-process') jpProcess();
  else if (action === 'use') {
    const row = J.rows?.[Number(button.dataset.i)];
    const candidate = row?.candidates?.[0];
    if (!row || !candidate?.noRekening) return jpToast('Kandidat tidak memiliki nomor rekening.', 'warning');
    Object.assign(row, {
      rekening: candidate.noRekening,
      namaPemilik: candidate.namaPemilik || candidate.nama,
      matchStatus: 'MANUAL'
    });
    jpReview();
  } else if (action === 'dxl') jpDl('xlsx');
  else if (action === 'dcj') jpDl('jaspro');
  else if (action === 'dct') jpDl('transpo');
}

async function jpChange(e) {
  const target = e.target;
  const data = target.dataset;

  if (data.historyYear != null) {
    const year = Number(target.value);
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      target.value = String(J.historyYear);
      return jpToast('Tahun harus berupa angka 1900 sampai 2200.', 'warning');
    }
    J.historyYear = year;
    J.historySelected = '';
    J.showPreview = false;
    J.rows = null;
    jpRender();
    return;
  }

  if (data.i != null && J.rows) {
    const row = J.rows[Number(data.i)];
    if (!row) return;
    if (data.f === 'gol') {
      row.golongan = target.value;
      Object.assign(row, JX.classifyRow(row, J.set));
      jpReview();
    } else if (data.f === 'rek') {
      row.rekening = target.value.trim();
      row.matchStatus = 'MANUAL';
      const master = J.master.find(item => item.noRekening === row.rekening);
      if (master) row.namaPemilik = master.namaPemilik || master.nama;
      jpReview();
    } else if (data.f === 'own') {
      row.namaPemilik = target.value.trim();
    }
  }
}

function jpInput(e) {
  const target = e.target;
  if (target.id === 'jq') {
    J.q = target.value;
    const result = jpMRows();
    if ($('jmt')) $('jmt').innerHTML = result.html;
    if ($('jmc')) $('jmc').textContent = jpMCount(result.n);
  } else if (target.dataset.t) {
    const entry = J.set.tarifRiwayat[Number(target.dataset.k)];
    if (!entry) return;
    if (target.dataset.t === 'mulai') entry.mulai = target.value;
    else {
      const value = parseFloat(target.value);
      entry[target.dataset.t] = target.value.trim() === '' || !Number.isFinite(value) ? null : value;
    }
    J.stale = true;
    jpSetSimpan();
    jpTarifRefresh();
  } else if (target.dataset.s) {
    J.set[target.dataset.s] = 'n' in target.dataset ? (parseFloat(target.value) || 0) : target.value;
    J.stale = true;
    jpSetSimpan();
    jpTarifRefresh();
  }
}

// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { jaspro: pageJaspro });
