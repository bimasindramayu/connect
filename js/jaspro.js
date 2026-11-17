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
const J = { on: false, master: [], laporan: null, set: {}, rows: null, periods: [], periodId: '', historyYear: new Date().getFullYear(), historySelected: '', stale: false, tab: 'input', q: '', t: null };
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
async function jpSave(patch) {
  jpStat('Menyimpan…','secondary');
  if(Object.prototype.hasOwnProperty.call(patch,'master')){
    const {error}=await sb.from('jaspro_data').upsert({id:1,master:patch.master},{onConflict:'id'});
    jpStat(error?'Gagal menyimpan':'Tersimpan',error?'danger':'success');
    if(error)jpToast('Gagal menyimpan Master Rekening: '+error.message,'danger');else J.master=patch.master;
    return !error;
  }
  const id=jpPeriodId(J.set);
  if(!id){jpStat('Periode tidak sah','danger');jpToast('Pilih bulan dan tahun laporan yang sah.','danger');return false;}
  const [tahun,bulan]=id.split('-').map(Number),current=J.periods.find(p=>p.id===id);
  const payload={id,tahun,bulan,
    laporan:Object.prototype.hasOwnProperty.call(patch,'laporan')?patch.laporan:(current?.laporan??J.laporan??null),
    settings:Object.prototype.hasOwnProperty.call(patch,'settings')?patch.settings:jpSetOut()};
  const {data,error}=await sb.from('jaspro_periode').upsert(payload,{onConflict:'id'}).select('id,tahun,bulan,laporan,settings,updated_at').single();
  jpStat(error?'Gagal menyimpan':'Tersimpan',error?'danger':'success');
  if(error){jpToast('Gagal menyimpan periode '+jpPeriodLabel(id)+': '+error.message,'danger');return false;}
  const ix=J.periods.findIndex(p=>p.id===id);if(ix<0)J.periods.push(data);else J.periods[ix]=data;
  J.periods.sort((a,b)=>b.id.localeCompare(a.id));return true;
}

async function pageJaspro() {
  $('view').innerHTML = `<div class="jp" id="jroot">
    <div class="jp-heading">
      <div><h4>Jaspro Transport</h4><p>Kelola laporan nominatif, periksa pembayaran, dan lihat arsip bulanan.</p></div>
      <span id="jstat" class="badge bg-label-secondary">Memuat…</span>
    </div>
    <nav class="jp-nav" id="jnav" aria-label="Menu Jaspro Transport"></nav>
    <div id="jmsg" aria-live="polite"></div>
    <div id="jpanel"><div class="jp-loading">Memuat data Jaspro Transport…</div></div>
  </div>`;
  if(!J.on||REFRESH_PAGE_DATA){
    const [{data:masterData,error:masterError},{data:periods,error:periodError}]=await Promise.all([
      sb.from('jaspro_data').select('master').eq('id',1).maybeSingle(),
      sb.from('jaspro_periode').select('id,tahun,bulan,laporan,settings,updated_at').order('id',{ascending:false})
    ]);
    if(masterError)return $('jpanel').innerHTML=note('Gagal memuat Master Rekening: '+masterError.message);
    if(periodError)return $('jpanel').innerHTML=note('Gagal memuat arsip Jaspro. Jalankan bop.sql versi terbaru di Supabase terlebih dahulu. Pesan: '+periodError.message);
    const defaults=jpDef(),currentId=jpPeriodId(defaults);
    Object.assign(J,{master:masterData?.master||[],periods:periods||[],on:true,historySelected:''});
    jpLoadPeriod(currentId);
  }
  jpStat('Tersimpan','success');
  const r=$('jroot');r.onclick=jpClick;r.onchange=jpChange;r.oninput=jpInput;
  r.ondragover=e=>{if(e.target.closest('.jp-drop'))e.preventDefault();};
  r.ondrop=e=>{if(e.target.closest('.jp-drop')){e.preventDefault();jpLaporan(e.dataTransfer.files[0]);}};
  jpRender();
}
function jpRender() {
  const tabs=[['input','Laporan & Proses'],['master','Master Rekening'],['riwayat','Riwayat']];
  $('jnav').innerHTML=tabs.map(([key,label])=>`<button type="button" data-act="tab" data-tab="${key}" aria-pressed="${J.tab===key?'true':'false'}">${label}</button>`).join('');
  if(J.tab==='input')jpUrutRiwayat();
  $('jpanel').innerHTML={input:pWork,master:pMa,riwayat:pRiwayat}[J.tab]();
  if(J.tab==='input'){jpProcBtn();jpReview();}
}

/* ---- Langkah 1: Input Laporan Nominatif ---- */
const pIn = () => {
  const R=J.laporan?.rows||[];
  const peristiwa=R.reduce((n,r)=>n+(Number(r.jumlahPeristiwa)||0),0);
  const penghulu=new Set(R.map(r=>JX.normalizeCoreName(r.nama)||r.nama)).size;
  const tersimpan=!!J.laporan,tanggalBuruk=Number(J.laporan?.tanggalTakSah)||0;
  return `<section class="jp-section">
    <div class="jp-section-title"><h5>Laporan nominatif</h5><p>Pilih periode dan unggah file Excel (.xlsx).</p></div>
    <div class="jp-period-row">
      <div><label class="form-label" for="jp-bulan">Bulan laporan</label><select id="jp-bulan" class="form-select" data-period="bulan">${JX.BULAN_LIST.map(b=>`<option value="${b}"${b===J.set.bulan?' selected':''}>${b[0]+b.slice(1).toLowerCase()}</option>`).join('')}</select></div>
      <div><label class="form-label" for="jp-tahun">Tahun laporan</label><input id="jp-tahun" class="form-control" type="number" min="1900" max="2200" step="1" data-period="tahun" value="${esc(J.set.tahun)}"></div>
      <div class="jp-period-current"><span>Periode aktif</span><strong>${esc(jpPeriodLabel(J.periodId))}</strong></div>
    </div>
    <div class="jp-upload-row">
      <div class="jp-file-status"><i class="bx ${tersimpan?'bx-file-check':'bx-file-plus'}" aria-hidden="true"></i>
        <div><strong>${tersimpan?'Laporan tersimpan':'Belum ada laporan'}</strong>
          <span>${tersimpan?`${esc(J.laporan.fileName||'File Excel')} · ${R.length.toLocaleString('id-ID')} baris`:'Pilih file nominatif berformat .xlsx untuk periode ini.'}</span>
        </div>
      </div>
      <input type="file" id="jfl" accept=".xlsx" hidden>
      <button type="button" class="btn btn-primary" data-act="upl"><i class="bx bx-upload me-1"></i>${tersimpan?'Ganti File':'Pilih File Excel'}</button>
    </div>
    ${tersimpan?`<div class="jp-report-summary"><span>${penghulu.toLocaleString('id-ID')} penghulu</span><span>${peristiwa.toLocaleString('id-ID')} peristiwa</span>
      <button type="button" class="btn btn-sm btn-outline-danger" data-act="clr">Hapus laporan periode ini</button></div>`:''}
    <p class="jp-source-note">Kolom file: <b>G</b> jumlah peristiwa · <b>H</b> total Jaspro bruto · <b>I</b> total Transport bruto · <b>J</b> pembanding bruto (H + I). PPh dipotong setelah nilai bruto dihitung.</p>
    ${tanggalBuruk?`<div class="alert alert-warning">${tanggalBuruk.toLocaleString('id-ID')} baris memiliki tanggal yang tidak terbaca dan akan menggunakan tanggal acuan.</div>`:''}
    ${R.length?`<details class="jp-source-details"><summary>Lihat isi file (${R.length.toLocaleString('id-ID')} baris)</summary>
      <div class="jp-table-wrap"><div class="scroll"><table class="table table-hover align-middle mb-0">
        <thead><tr><th>No</th><th>Nama Penghulu</th><th>KUA</th><th>NIP</th><th>Golongan</th><th>Tanggal</th><th class="text-end">Peristiwa (G)</th><th class="text-end">Jaspro total (H)</th><th class="text-end">Jaspro / peristiwa</th><th class="text-end">Transport total (I)</th><th class="text-end">Transport / peristiwa</th><th class="text-end">Diterima file (J)</th></tr></thead>
        <tbody>${R.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.nama)}</td><td>${esc(r.kua)}</td><td>${esc(r.nip)}</td><td>${esc(r.golongan)}</td><td class="text-nowrap">${JX.tglSah(r.tanggal)?JX.tglID(r.tanggal):'–'}</td><td class="text-end">${r.jumlahPeristiwa}</td><td class="text-end text-nowrap">Rp ${rp(Math.round(r.jasproTotalSumber||0))}</td><td class="text-end text-nowrap">Rp ${rp(r.jumlahPeristiwa>0?Math.round(r.jasproTotalSumber/r.jumlahPeristiwa):0)}</td><td class="text-end text-nowrap">Rp ${rp(Math.round(r.transportTotalSumber||0))}</td><td class="text-end text-nowrap">Rp ${rp(r.jumlahPeristiwa>0?Math.round(r.transportTotalSumber/r.jumlahPeristiwa):0)}</td><td class="text-end text-nowrap">${r.jumlahDiterimaSumber==null?'–':'Rp '+rp(Math.round(r.jumlahDiterimaSumber))}</td></tr>`).join('')}</tbody>
      </table></div></div></details>`:''}
  </section>`;
};

async function jpLaporan(f) {
  if(!f)return;
  if(!/\.xlsx$/i.test(f.name))return jpToast('Format file harus .xlsx','danger');
  const id=jpPeriodId(J.set);if(!id)return jpToast('Pilih bulan dan tahun laporan yang sah.','danger');
  jpStat('Membaca file…','secondary');
  let r;try{await jpX();r=await JX.parseLaporanFile(f);}catch(e){r={ok:false,error:e.message};}
  if(r.ok&&r.rows.length>5000)r={ok:false,error:'Maksimal 5.000 baris per laporan.'};
  if(!r.ok){jpStat('Tersimpan','success');return $('jmsg').innerHTML=note(r.error);}
  const duplicates=jpDuplikatJadwal(r.rows);
  if(duplicates.length){
    jpStat('Duplikasi ditemukan','danger');
    const sample=duplicates.slice(0,8).map(d=>`Baris ${d.baris} memiliki jadwal ganda dengan baris ${d.pertama} (${esc(d.nama)} · ${esc(d.tanggal?JX.tglID(d.tanggal):'tanpa tanggal')}).`).join('<br>');
    return $('jmsg').innerHTML=note(`Ditemukan ${duplicates.length} jadwal duplikat pada file. Data tidak disimpan. ${sample}`,'danger');
  }
  const nextReport={fileName:f.name,rows:r.rows,tanggalTakSah:r.tanggalTakSah||0},existing=J.periods.find(p=>p.id===id);
  const save=async()=>{
    const ok=await jpSave({laporan:nextReport,settings:jpSetOut()});if(!ok)return;
    J.laporan=nextReport;J.rows=null;J.stale=true;J.periodId=id;jpRender();
    const bt=r.rows.filter(x=>x.tanggal).length;
    $('jmsg').innerHTML=note(`${r.rows.length} baris dimuat dari "${esc(f.name)}" untuk ${esc(jpPeriodLabel(id))}${r.skipped?` (${r.skipped} baris jumlah dilewati)`:''}${bt?`, ${bt} di antaranya bertanggal`:''}. ${existing?.laporan?'Arsip bulan ini berhasil diperbarui; arsip bulan lainnya tetap tersimpan.':'Arsip periode berhasil dibuat.'}`,'success');
  };
  if(existing?.laporan)jpAsk('Perbarui arsip '+jpPeriodLabel(id)+'?','Laporan lama pada periode ini akan diganti dengan file baru. Data periode lain tidak akan berubah.','Perbarui Periode',save,true);
  else save();
}

/* ---- Langkah 2: Master Rekening ---- */
const jpMRows = () => {
  const q = JX.normalizeCoreName(J.q), cnt = {};
  J.master.forEach(m => { const k = JX.normalizeCoreName(m.nama); cnt[k] = (cnt[k] || 0) + 1; });
  const L = J.master.slice().sort((a, b) => a.nama.localeCompare(b.nama, 'id')).filter(m => !q || JX.normalizeCoreName(m.nama).includes(q));
  return { n: L.length, html: L.map(m => `<tr><td>${esc(m.nama)}${cnt[JX.normalizeCoreName(m.nama)] > 1 ? ' <span class="badge bg-label-warning" title="Ada lebih dari satu entri dengan nama mirip">duplikat?</span>' : ''}</td><td>${esc(m.namaPemilik || m.nama)}</td><td>${esc(m.noRekening)}</td>
    <td class="text-end text-nowrap"><div class="jp-row-actions"><button type="button" class="btn btn-sm btn-outline-secondary" data-act="medit" data-id="${esc(m.id)}">Ubah</button> <button type="button" class="btn btn-sm btn-outline-danger" data-act="mdel" data-id="${esc(m.id)}">Hapus</button></div></td></tr>`).join('') };
};
const jpMCount = n => `Total: ${J.master.length} penghulu${J.q ? ' · ' + n + ' cocok pencarian' : ''}`;
const pMa = () => {
  const r=jpMRows();
  return `<section class="jp-section">
    <div class="jp-section-title"><h5>Master Rekening Penghulu</h5><p>Data ini dipakai untuk mencocokkan nama dan nomor rekening pada laporan nominatif.</p></div>
    <div class="jp-master-toolbar">
      <div class="jp-search"><label class="form-label" for="jq">Cari penghulu</label>
        <div class="input-group"><input id="jq" type="search" class="form-control" placeholder="Ketik nama penghulu…" value="${esc(J.q)}" aria-label="Cari penghulu">
          <button type="button" id="jmclear" class="btn btn-outline-secondary" data-act="mclear" aria-label="Hapus pencarian" ${J.q?'':'disabled'}>Hapus</button></div>
      </div>
      <div class="jp-master-actions"><input type="file" id="jfm" accept=".xlsx" hidden>
        <button type="button" class="btn btn-outline-secondary" data-act="mimp">Impor Excel</button>
        <button type="button" class="btn btn-outline-secondary" data-act="mexp">Ekspor Excel</button>
        <button type="button" class="btn btn-primary" data-act="madd">Tambah Penghulu</button>
      </div>
    </div>
    <div class="jp-master-count" id="jmc">${jpMCount(r.n)}</div>
    ${J.master.length?`<div class="jp-table-wrap"><div class="scroll"><table class="table table-hover align-middle mb-0">
      <thead><tr><th>Nama Penghulu</th><th>Nama Pemilik Rekening</th><th>Nomor Rekening</th><th class="text-end">Aksi</th></tr></thead><tbody id="jmt">${r.html}</tbody>
    </table></div></div>`:`<div class="jp-empty-state"><p>Master Rekening belum memiliki data. Impor file Excel atau tambahkan penghulu secara manual.</p>
      <button type="button" class="btn btn-outline-secondary" data-act="mimp">Impor Excel</button>
      <button type="button" class="btn btn-primary" data-act="madd">Tambah Penghulu</button>
    </div>`}
  </section>`;
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

/* ---- Riwayat historis Jaspro Transport ---- */
function pRiwayat() {
  const years=[...new Set([...J.periods.filter(p=>p.laporan).map(p=>Number(p.tahun)),Number(J.set.tahun)])].filter(Number.isFinite).sort((a,b)=>b-a);
  if(!years.includes(Number(J.historyYear)))J.historyYear=years[0]||new Date().getFullYear();
  const records=J.periods.filter(p=>p.laporan&&Number(p.tahun)===Number(J.historyYear)).sort((a,b)=>a.bulan-b.bulan);
  const sums=records.map(p=>({period:p,...jpHitung(p.laporan,jpMuatSet(p.settings))}));
  const total=k=>sums.reduce((n,x)=>n+(Number(x[k])||0),0);
  const selected=J.periods.find(p=>p.id===J.historySelected);
  const f=n=>'Rp '+rp(Math.round(Number(n)||0));
  return `<section class="jp-section">
    <div class="jp-history-top">
      <div class="jp-section-title"><h5>Riwayat pembayaran</h5><p>Arsip laporan per bulan. Pilih tahun untuk melihat rekap dan rincian.</p></div>
      <div class="jp-year-select"><label class="form-label" for="jp-history-year">Tahun laporan</label>
        <select id="jp-history-year" class="form-select" data-history-year>${years.map(y=>`<option value="${y}"${Number(y)===Number(J.historyYear)?' selected':''}>${y}</option>`).join('')}</select>
      </div>
    </div>
    ${records.length?`
      <div class="jp-summary-grid">
        <div><span>Total peristiwa</span><strong>${total('peristiwa').toLocaleString('id-ID')}</strong></div>
        <div><span>Jaspro bruto</span><strong>${f(total('jasproBruto'))}</strong></div>
        <div><span>PPh Jaspro</span><strong>${f(total('pph'))}</strong></div>
        <div><span>Jaspro bersih</span><strong>${f(total('jaspro'))}</strong></div>
        <div><span>Transport bruto</span><strong>${f(total('transport'))}</strong></div>
        <div><span>Total dibayarkan</span><strong>${f(total('total'))}</strong></div>
      </div>
      <div class="jp-table-heading"><h6>Rekap per bulan</h6><p>${records.length.toLocaleString('id-ID')} periode tersimpan pada tahun ${J.historyYear}.</p></div>
      <div class="jp-table-wrap"><div class="scroll"><table class="table table-hover align-middle mb-0">
        <thead><tr><th>Bulan</th><th class="text-end">Baris</th><th class="text-end">Peristiwa</th><th class="text-end">Jaspro bruto</th><th class="text-end">Transport bruto</th><th class="text-end">Total bruto</th><th class="text-end">Aksi</th></tr></thead>
        <tbody>${sums.map(x=>`<tr>
          <td class="fw-semibold">${esc(JX.BULAN_LIST[x.period.bulan-1])}</td><td class="text-end">${x.rows.length.toLocaleString('id-ID')}</td>
          <td class="text-end">${x.peristiwa.toLocaleString('id-ID')}</td>
          <td class="text-end text-nowrap">${f(x.jasproBruto)}</td><td class="text-end text-nowrap">${f(x.transport)}</td>
          <td class="text-end text-nowrap">${f(x.jasproBruto+x.transport)}</td>
          <td class="text-end text-nowrap"><div class="jp-row-actions">
            <button type="button" class="btn btn-sm btn-outline-primary" data-act="hdetail" data-id="${x.period.id}">${J.historySelected===x.period.id?'Tutup rincian':'Lihat rincian'}</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" data-act="hedit" data-id="${x.period.id}" aria-label="Ubah laporan ${jpPeriodLabel(x.period.id)}">Ubah</button>
            <button type="button" class="btn btn-sm btn-outline-danger" data-act="hdel" data-id="${x.period.id}" aria-label="Hapus arsip ${jpPeriodLabel(x.period.id)}">Hapus</button>
          </div></td>
        </tr>`).join('')}</tbody>
        <tfoot><tr class="fw-semibold"><td colspan="2">TOTAL TAHUN ${J.historyYear}</td><td class="text-end">${total('peristiwa').toLocaleString('id-ID')}</td>
          <td class="text-end text-nowrap">${f(total('jasproBruto'))}</td><td class="text-end text-nowrap">${f(total('transport'))}</td>
          <td class="text-end text-nowrap">${f(total('jasproBruto')+total('transport'))}</td><td></td></tr></tfoot>
      </table></div></div>`:`
      <div class="jp-empty-state"><h6>Belum ada laporan untuk tahun ${J.historyYear}</h6>
        <p>Unggah laporan nominatif pada menu Laporan & Proses. Arsip yang sudah disimpan akan muncul di sini.</p>
        <button type="button" class="btn btn-primary" data-act="tab" data-tab="input">Buka Laporan & Proses</button>
      </div>`}
  </section>${selected&&Number(selected.tahun)===Number(J.historyYear)?jpDetailPeriode(selected):''}`;
}

function jpDetailPeriode(period) {
  const s=jpMuatSet(period.settings),data=jpHitung(period.laporan,s),f=n=>'Rp '+rp(Math.round(Number(n)||0));
  return `<section class="jp-section jp-detail-section">
    <div class="jp-detail-heading"><div class="jp-section-title"><h5>Rincian ${esc(jpPeriodLabel(period.id))}</h5><p>Sumber: ${esc(period.laporan?.fileName||'Laporan Nominatif')} · ${data.rows.length.toLocaleString('id-ID')} baris</p></div></div>
    <div class="jp-summary-grid">
      <div><span>Total peristiwa</span><strong>${data.peristiwa.toLocaleString('id-ID')}</strong></div>
      <div><span>Jaspro bruto</span><strong>${f(data.jasproBruto)}</strong></div>
      <div><span>Potongan PPh</span><strong>${f(data.pph)}</strong></div>
      <div><span>Jaspro bersih</span><strong>${f(data.jaspro)}</strong></div>
      <div><span>Transport bruto</span><strong>${f(data.transport)}</strong></div>
      <div><span>Total dibayarkan</span><strong>${f(data.total)}</strong></div>
    </div>
    <div class="jp-table-heading"><h6>Rincian per penghulu</h6><p>Nominal pada tabel merupakan bruto, sebelum potongan PPh.</p></div>
    <div class="jp-table-wrap"><div class="scroll"><table class="table table-hover align-middle mb-0">
      <thead><tr><th>No</th><th>Nama Penghulu</th><th>KUA</th><th>NIP</th><th>Golongan</th><th>Tanggal</th><th class="text-end">Peristiwa</th><th class="text-end">Jaspro / peristiwa</th><th class="text-end">Transport / peristiwa</th><th class="text-end">Jaspro bruto</th><th class="text-end">Transport bruto</th><th class="text-end">Diterima file (J)</th><th class="text-end">Total bruto (H+I)</th><th>Pemeriksaan</th></tr></thead>
      <tbody>${data.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.nama)}</td><td>${esc(r.kua)}</td><td>${esc(r.nip)}</td><td>${esc(r.golongan)}</td>
        <td class="text-nowrap">${JX.tglSah(r.tanggal)?JX.tglID(r.tanggal):'–'}</td><td class="text-end">${Number(r.jumlahPeristiwa||0).toLocaleString('id-ID')}</td>
        <td class="text-end text-nowrap">${f(r.tarifJaspro)}</td><td class="text-end text-nowrap">${f(r.tarifTransport)}</td>
        <td class="text-end text-nowrap">${f(r.jasproSubtotal)}</td><td class="text-end text-nowrap">${f(r.transpoSubtotal)}</td>
        <td class="text-end text-nowrap">${r.jumlahDiterimaSumber==null?'–':f(r.jumlahDiterimaSumber)}</td>
        <td class="text-end text-nowrap">${f(r.jumlahDiterimaHitung)}</td>
        <td>${r.jumlahDiterimaSumber==null?'<span class="badge bg-label-secondary">Tidak ada di file</span>':r.jumlahDiterimaCocok?'<span class="badge bg-label-success">Sesuai</span>':'<span class="badge bg-label-warning">Selisih '+f(Math.abs(r.selisihJumlahDiterima))+'</span>'}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="fw-semibold"><td colspan="6">TOTAL</td><td class="text-end">${data.peristiwa.toLocaleString('id-ID')}</td><td class="text-end">–</td><td class="text-end">–</td>
        <td class="text-end text-nowrap">${f(data.jasproBruto)}</td><td class="text-end text-nowrap">${f(data.transport)}</td>
        <td class="text-end text-nowrap">${f(data.sourceTotal)}</td><td class="text-end text-nowrap">${f(data.jasproBruto+data.transport)}</td>
        <td>${data.mismatchCount?data.mismatchCount+' baris selisih':'Sesuai'}</td></tr></tfoot>
    </table></div></div>
    <p class="jp-table-note">Geser tabel ke samping untuk melihat semua kolom.</p>
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
  const f=(k,l)=>`<div class="col-sm-6 col-lg-3"><label class="form-label" for="jp-set-${k}">${l}</label><input id="jp-set-${k}" class="form-control" type="number" min="0" step="any" data-s="${k}" data-n value="${esc(J.set[k])}"></div>`;
  return `<section class="jp-section jp-process-section">
    <div class="jp-section-title"><h5>Pemeriksaan dan unduh</h5><p>Cocokkan nama serta rekening, lalu periksa nominal sebelum mengunduh laporan.</p></div>
    <div class="jp-master-status"><span>Master Rekening</span><strong>${J.master.length.toLocaleString('id-ID')} data</strong>
      <button type="button" class="btn btn-sm btn-outline-secondary" data-act="tab" data-tab="master">Kelola rekening</button></div>
    <details class="jp-settings"><summary>Pengaturan PPh dan tanda tangan</summary>
      <div class="jp-settings-body">
        <p>PPh dipotong dari Jaspro sesuai golongan. Transport tidak dikenakan PPh. Pengaturan tersimpan untuk periode ${esc(jpPeriodLabel(J.periodId))}.</p>
        <h6>Tarif PPh Jasa Profesi (%)</h6><div class="row g-3 mb-4">${f('pphII','PNS Golongan II')}${f('pphIII','PNS Golongan III')}${f('pphIV','PNS Golongan IV')}${f('pphPPPK','PPPK Golongan IX')}</div>
        <h6>Tempat dan tanggal laporan</h6><div class="row g-3 mb-4"><div class="col-sm-6 col-lg-4"><label class="form-label" for="jp-set-tempatTanggal">Tempat &amp; tanggal</label><input id="jp-set-tempatTanggal" class="form-control" data-s="tempatTanggal" value="${esc(J.set.tempatTanggal)}"></div></div>
        <h6>Penandatangan</h6><div class="row g-3">${[['kpa','Kuasa Pengguna Anggaran'],['ppk','Pejabat Pembuat Komitmen'],['bendahara','Bendahara']].map(([p,t])=>`<div class="col-lg-4"><div class="jp-sign-box"><strong>${t}</strong>${[['Jabatan','Jabatan'],['Nama','Nama'],['Nip','NIP']].map(([k,l])=>`<label class="form-label mt-3" for="jp-set-${p+k}">${l}</label><input id="jp-set-${p+k}" class="form-control" data-s="${p+k}" value="${esc(J.set[p+k])}">`).join('')}</div></div>`).join('')}</div>
      </div>
    </details>
    <div class="jp-process-action"><div><strong>Periksa laporan</strong><p id="jph" class="mb-0">Hasil belum dihitung.</p></div>
      <button type="button" class="btn btn-primary" id="jpb" data-act="proc"><i class="bx bx-check me-1"></i><span id="jpb-label">Cocokkan dan tampilkan hasil</span></button></div>
  </section><div id="jrev"></div>`;
};
function pWork(){return pIn()+pPr();}

function jpProcBtn() {
  const b=$('jpb'),hint=$('jph'),label=$('jpb-label');
  if(!b||!hint||!label)return;
  const adaLaporan=!!J.laporan?.rows?.length,adaMaster=J.master.length>0;
  b.disabled=!(adaLaporan&&adaMaster);
  if(!adaLaporan)hint.textContent='Unggah laporan nominatif terlebih dahulu.';
  else if(!adaMaster)hint.textContent='Tambahkan atau impor Master Rekening terlebih dahulu.';
  else if(J.stale&&J.rows)hint.textContent='Ada perubahan yang belum dihitung ulang.';
  else if(J.rows)hint.textContent='Data siap diperiksa ulang atau diunduh.';
  else hint.textContent='Laporan dan Master Rekening siap dicocokkan.';
  label.textContent=J.rows?'Perbarui hasil pemeriksaan':'Cocokkan dan tampilkan hasil';
}

function jpProcess() {
  const ix = JX.buildMasterIndex(J.master);
  J.rows = J.laporan.rows.map(r => {
    const m = JX.matchPenghulu(r.nama, J.master, ix);
    return { ...r, ...JX.classifyRow(r, J.set), rekening: m.entry ? m.entry.noRekening : (r.noRekeningSumber || ''), namaPemilik: m.entry ? m.entry.namaPemilik : '', matchStatus: m.entry ? m.status : 'TIDAK_DITEMUKAN', candidates: m.candidates };
  });
  J.stale = false; jpRender(); $('jrev').scrollIntoView({ behavior: 'smooth' });
}
function jpReview() {
  const R=J.rows,h=$('jrev');if(!h)return;
  if(!R){h.innerHTML='';return;}
  const sum=k=>R.reduce((n,r)=>n+(Number(r[k])||0),0);
  const cocok=R.filter(r=>['OTOMATIS','MANUAL'].includes(r.matchStatus)).length;
  const perlu=R.length-cocok;
  const cekJ=R.filter(r=>r.jumlahDiterimaSumber!=null);
  const sesuaiJ=cekJ.filter(r=>r.jumlahDiterimaCocok).length;
  const adaTgl=R.some(r=>JX.tglSah(r.tanggal));
  const f=n=>'Rp '+rp(Math.round(Number(n)||0));
  h.innerHTML=`<section class="jp-results">
    <div class="jp-section-title"><h5>Hasil pemeriksaan</h5><p>${R.length.toLocaleString('id-ID')} baris laporan · ${cocok.toLocaleString('id-ID')} cocok · ${perlu.toLocaleString('id-ID')} perlu ditinjau</p></div>
    ${J.stale?'<div class="jp-inline-warning">Data sumber atau pengaturan berubah. Klik “Perbarui hasil pemeriksaan” untuk menghitung ulang sebelum mengunduh.</div>':''}
    <div class="jp-summary-grid">
      <div><span>Jaspro bruto</span><strong>${f(sum('jasproSubtotal'))}</strong></div><div><span>PPh Jaspro</span><strong>${f(sum('jasproPph'))}</strong></div>
      <div><span>Jaspro bersih</span><strong>${f(sum('jasproDiterima'))}</strong></div><div><span>Transport bruto</span><strong>${f(sum('transpoSubtotal'))}</strong></div>
      <div><span>Total dibayarkan</span><strong>${f(sum('jumlahDiterimaBersih'))}</strong></div><div><span>Kolom J sesuai</span><strong>${cekJ.length?sesuaiJ.toLocaleString('id-ID')+'/'+cekJ.length.toLocaleString('id-ID'):'Tidak tersedia'}</strong></div>
    </div>
    <div class="jp-table-heading"><h6>Rincian per penghulu</h6><p>Nilai bruto dibandingkan dengan kolom J sebelum PPh. Pembayaran bersih sudah memperhitungkan potongan PPh.</p></div>
    <div class="jp-table-wrap"><div class="scroll"><table class="table table-hover align-middle mb-0">
      <thead><tr><th>No</th><th>Nama Penghulu</th><th>KUA</th><th>NIP</th><th>Golongan</th><th>Status cocok</th><th>Nomor Rekening</th><th>Nama Pemilik</th>${adaTgl?'<th>Tanggal</th>':''}<th class="text-end">Peristiwa</th><th class="text-end">Jaspro bruto</th><th class="text-end">PPh</th><th class="text-end">Jaspro bersih</th><th class="text-end">Transport bruto</th><th class="text-end">Diterima file (J)</th><th class="text-end">Hitung bruto</th><th>Pemeriksaan</th><th class="text-end">Dibayarkan bersih</th></tr></thead>
      <tbody>${R.map((r,i)=>{
        const [c,l]=JST[r.matchStatus]||JST.TIDAK_DITEMUKAN;
        const isBad=!['OTOMATIS','MANUAL'].includes(r.matchStatus),cd=r.candidates?.[0],unk=r.golClass==='UNKNOWN';
        return `<tr class="${isBad?'issue':''}">
          <td>${i+1}</td><td>${esc(r.nama)}</td><td>${esc(r.kua)}</td><td>${esc(r.nip)}</td>
          <td><input class="form-control form-control-sm jp-inline-edit" data-i="${i}" data-f="gol" value="${esc(r.golongan)}" aria-label="Golongan ${esc(r.nama)}"><span class="badge bg-label-${unk?'danger':'secondary'} mt-1">${unk?'Tidak dikenali':esc(JX.golonganLabel(r.golClass))}</span></td>
          <td><span class="badge bg-label-${c}">${l}</span>${isBad&&cd?`<button type="button" class="btn btn-link btn-sm d-block p-0 mt-1" data-act="use" data-i="${i}">Gunakan ${esc(cd.nama.slice(0,24))}${cd.nama.length>24?'…':''}</button>`:''}</td>
          <td><input class="form-control form-control-sm jp-inline-edit jp-account-edit" list="jdl-list" data-i="${i}" data-f="rek" value="${esc(r.rekening)}" aria-label="Nomor rekening ${esc(r.nama)}"></td>
          <td><input class="form-control form-control-sm jp-inline-edit jp-owner-edit" data-i="${i}" data-f="own" value="${esc(r.namaPemilik||'')}" placeholder="Sama dengan nama" aria-label="Nama pemilik rekening ${esc(r.nama)}"></td>
          ${adaTgl?`<td class="text-nowrap">${JX.tglSah(r.tanggal)?JX.tglID(r.tanggal):'–'}</td>`:''}
          <td class="text-end">${Number(r.jumlahPeristiwa||0).toLocaleString('id-ID')}</td>
          <td class="text-end text-nowrap">${f(r.jasproSubtotal)}</td><td class="text-end text-nowrap">${f(r.jasproPph)}</td><td class="text-end text-nowrap">${f(r.jasproDiterima)}</td>
          <td class="text-end text-nowrap">${f(r.transpoSubtotal)}</td><td class="text-end text-nowrap">${r.jumlahDiterimaSumber==null?'–':f(r.jumlahDiterimaSumber)}</td>
          <td class="text-end text-nowrap">${f(r.jumlahDiterimaHitung)}</td>
          <td>${r.jumlahDiterimaSumber==null?'<span class="badge bg-label-secondary">Tidak ada di file</span>':r.jumlahDiterimaCocok?'<span class="badge bg-label-success">Sesuai</span>':'<span class="badge bg-label-warning">Selisih '+f(Math.abs(r.selisihJumlahDiterima))+'</span>'}</td>
          <td class="text-end text-nowrap fw-semibold">${f(r.jumlahDiterimaBersih)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div></div>
    <p class="jp-table-note">Geser tabel ke samping untuk melihat semua kolom. Perubahan Golongan, Nomor Rekening, dan Nama Pemilik hanya berlaku pada pratinjau ini; Master Rekening dapat dikelola pada menu tersendiri.</p>
    <datalist id="jdl-list">${J.master.map(m=>`<option value="${esc(m.noRekening)}">${esc(m.nama)}</option>`).join('')}</datalist>
    <div class="jp-download-bar"><div><strong>Unduh hasil</strong><p>Excel untuk laporan lengkap atau CSV terpisah untuk pembayaran.</p></div>
      <div class="jp-download-actions"><button type="button" class="btn btn-outline-secondary" data-act="dcj">CSV Jaspro</button><button type="button" class="btn btn-outline-secondary" data-act="dct">CSV Transport</button><button type="button" class="btn btn-primary" data-act="dxl">Unduh Laporan Excel</button></div>
    </div>
  </section>`;
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
function jpDl(kind) {   // kind: xlsx | jaspro | transpo
  const rek = J.rows.filter(r => !r.rekening).length, gol = J.rows.filter(r => r.golClass === 'UNKNOWN').length, tengah = jpTarifTengah(kind);
  const go = () => kind === 'xlsx' ? jpExcel() : jpCsv(kind);
  const msg = [rek && `${rek} baris tanpa nomor rekening`, kind === 'xlsx' && gol && `${gol} baris golongan tidak dikenali (PPh dihitung 0%)`, tengah && `${tengah.n} baris tanpa tanggal memakai tarif per ${tengah.acuan} padahal tarif berubah di tengah bulan`].filter(Boolean).join(' dan ');
  if (msg) jpAsk('Masih ada data yang perlu ditinjau', msg + (rek || (kind === 'xlsx' && gol) ? '. File tetap bisa dibuat dengan kolom terkait kosong/0' : '') + '. Lanjutkan mengunduh?', 'Lanjutkan Unduh', go); else go();
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
function jpClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  if (a === 'tab') { J.tab = b.dataset.tab; $('jmsg').innerHTML = ''; jpRender(); $('jnav')?.querySelector('[data-tab="' + J.tab + '"]')?.focus(); }
  else if (a === 'hdetail') { J.historySelected=J.historySelected===id?'':id; jpRender(); }
  else if (a === 'hedit') { const p=J.periods.find(x=>x.id===id); if(p){jpLoadPeriod(id);J.tab='input';$('jmsg').innerHTML=note('Periode '+esc(jpPeriodLabel(id))+' dibuka. Unggah file baru untuk mengganti arsip periode ini.','info');jpRender();} }
  else if (a === 'hdel') { const p=J.periods.find(x=>x.id===id); if(p) jpAsk('Hapus arsip '+jpPeriodLabel(id)+'?','Laporan, pengaturan tarif, dan rincian periode ini akan dihapus permanen. Periode lain dan Master Rekening tidak terpengaruh.','Hapus Periode',async()=>{const {error}=await sb.from('jaspro_periode').delete().eq('id',id);if(error)return jpToast('Gagal menghapus periode: '+error.message,'danger');J.periods=J.periods.filter(x=>x.id!==id);if(J.periodId===id)jpLoadPeriod(jpPeriodId(jpDef()));if(J.historySelected===id)J.historySelected='';jpRender();jpToast('Arsip '+jpPeriodLabel(id)+' berhasil dihapus.');},true); }
  else if (a === 'upl') $('jfl').click();
  else if (a === 'clr') jpAsk('Hapus laporan tersimpan?', 'Laporan Nominatif yang tersimpan di server akan dihapus.', 'Hapus', async () => { J.laporan = null; J.rows = null; if (await jpSave({ laporan: null })) jpRender(); }, true);
  else if (a === 'mclear') { J.q=''; const input=$('jq'),r=jpMRows(); if(input){input.value='';input.focus();} if($('jmt'))$('jmt').innerHTML=r.html; if($('jmc'))$('jmc').textContent=jpMCount(r.n); if($('jmclear'))$('jmclear').disabled=true; }
  else if (a === 'mimp') $('jfm').click();
  else if (a === 'mexp') jpMExp();
  else if (a === 'madd') jpMForm();
  else if (a === 'medit') jpMForm(id);
  else if (a === 'mdel') {
    const m = J.master.find(x => x.id === id);
    if (m) jpAsk('Hapus data penghulu?', `"${m.nama}" akan dihapus dari Master Rekening.`, 'Hapus', async () => { J.master = J.master.filter(x => x.id !== id); J.stale = true; await jpSave({ master: J.master }); jpRender(); }, true);
  }
  else if (a === 'tadd') {
    J.set.tarifRiwayat.push({ mulai: '', jaspro: null, transport: null });
    jpRender();
    $('jpanel').querySelector(`[data-t="mulai"][data-k="${J.set.tarifRiwayat.length - 1}"]`)?.focus();
  }
  else if (a === 'tdel') { J.set.tarifRiwayat.splice(+b.dataset.k, 1); J.stale = true; jpSetSimpan(); jpRender(); }
  else if (a === 'proc') jpProcess();
  else if (a === 'use') { const r = J.rows[b.dataset.i], c = r.candidates[0]; Object.assign(r, { rekening: c.noRekening, namaPemilik: c.namaPemilik, matchStatus: 'MANUAL' }); jpReview(); }
  else if (a === 'dxl') jpDl('xlsx');
  else if (a === 'dcj') jpDl('jaspro');
  else if (a === 'dct') jpDl('transpo');
}
async function jpChange(e) {
  const t = e.target, d = t.dataset;
  if (t.id === 'jfl') { jpLaporan(t.files[0]); t.value = ''; }
  else if (t.id === 'jfm') { jpImport(t.files[0]); t.value = ''; }
  else if (d.period) {
    const next={...J.set,[d.period]:d.period==='bulan'?t.value:Number(t.value)},id=jpPeriodId(next);
    if(!id){t.value=d.period==='bulan'?J.set.bulan:J.set.tahun;return jpToast('Tahun harus berupa angka 1900 sampai 2200.','warning');}
    if(id!==J.periodId){
      const saved = await jpSetFlush();
      if(!saved){t.value=d.period==='bulan'?J.set.bulan:J.set.tahun;return;}
      jpLoadPeriod(id);jpRender();
      $('jmsg').innerHTML=J.laporan?note('Memuat arsip '+esc(jpPeriodLabel(id))+'.','info'):note('Periode '+esc(jpPeriodLabel(id))+' belum memiliki laporan.','info');
    }
  }
  else if(d.historyYear!=null){J.historyYear=Number(t.value);J.historySelected='';jpRender();}
  else if (d.i != null && J.rows) {
    const r = J.rows[d.i];
    if (d.f === 'gol') { r.golongan = t.value; Object.assign(r, JX.classifyRow(r, J.set)); jpReview(); }
    else if (d.f === 'rek') { r.rekening = t.value.trim(); r.matchStatus = 'MANUAL'; const m = J.master.find(x => x.noRekening === r.rekening); if (m) r.namaPemilik = m.namaPemilik; jpReview(); }
    else if (d.f === 'own') r.namaPemilik = t.value.trim();
  }
}
function jpInput(e) {
  const t = e.target;
  if (t.id === 'jq') { J.q = t.value; const r = jpMRows(), body = $('jmt'), count = $('jmc'), clear = $('jmclear'); if (body) body.innerHTML = r.html; if (count) count.textContent = jpMCount(r.n); if (clear) clear.disabled = !J.q; }
  else if (t.dataset.t) {   // perubahan tarif menurut tanggal: kolom mulai | jaspro | transport pada baris ke-k
    const e = J.set.tarifRiwayat[+t.dataset.k]; if (!e) return;
    if (t.dataset.t === 'mulai') e.mulai = t.value;
    else { const v = parseFloat(t.value); e[t.dataset.t] = t.value.trim() === '' || !Number.isFinite(v) ? null : v; }
    J.stale = true; jpSetSimpan(); jpProcBtn(); jpTarifRefresh(); jpReview();
  }
  else if (t.dataset.s) {   // pengaturan: ketikan beruntun digabung jadi satu simpan
    J.set[t.dataset.s] = 'n' in t.dataset ? (parseFloat(t.value) || 0) : t.value; J.stale = true;
    jpSetSimpan(); jpProcBtn(); jpTarifRefresh(); jpReview();
  }
}


// ---- Daftarkan halaman ke router (core.js) ----
Object.assign(pages, { jaspro: pageJaspro });
