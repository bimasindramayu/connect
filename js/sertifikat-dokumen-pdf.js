/* =====================================================================================
   sertifikat-dokumen-pdf.js: mesin pembuat PDF (jsPDF) untuk semua dokumen Sertifikat
   Piagam, Surat Keterangan, Surat Rekomendasi (Masjid/Musala); Sertifikat Kalibrasi, Data Verifikasi, Berita Acara (Arah Kiblat).
   Dipakai bersama oleh sertifikat-masjid.js dan arah-kiblat.js. jsPDF diberikan dari luar (pabrik) agar tidak bentrok dengan jsPDF milik BOP/BAST.
   ===================================================================================== */

function buatDokumenGenerator(jspdf) {
      return (function () {
        var LOGO_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKoAAACkCAYAAAAHfLXyAABbZUlEQVR42u19e3gU5d32PbOzye7mfFiSkEBAjiEgYADBiK1QfEuBKClS0BS0aKFvtR6KgG9LKfr5AvVUK1rQWpVGoaigAdRXDVIhiIQAgURIQsRAzgnZHPc4M8/3x8zz7MxmAzkCKs91zUVIdmdnn7nnd7h/J+Da6vFKTok1CgIPANbklNjM5JTYfwGwCgKP5JRY47Udurau9OKkyjBO/fnmjPS4w/lvhJH8N8JIRnrcVwBuAoA9zwdyALhr23VtXYnFa35+ZO2q6xrbToYT+bxVks9bpbaT4WTtqutsAH7XwXuurWurb6VoRnqcQVX1sckpsf/e83wgkc9biaMoWrSfjib209FEPm8V5fNWsuf5QJKcEvs2gH6CwCMjPc5wTbpeW30uRTWqfnpGelxR7YFgIp+3yo6iaMl+Opo4ipRD/VmSz1vl2gPBJCM97jSAWwFAPcc16doV6XBtCzoPUkHgZVGUBUHgV6xePmjNY/c0B5iCONnZRnhO3UlC1I3V/J++5uk3Ql1PPvPtn0VRfkYQeFEUZR6AfG1rrwG1txwmGPo3EQCDk1NiX/xLhm3WzHmhcNmJTAh4jlMAyXFAoEXZUpedsN+p/8qBFo7/6N1mrMiM2FWYV/07AN9KlWGcoX8TAJBrW30NqN1dBkHgJVGUASAtIz3uxecebRkYnWiWnG2EB8BRIJqCOLjsBH95PRQAsOLeZgRaODjbCAMrAGIK4uT6Mofh0edCyjJ3VD0IYJcg8BBF2QBAurblHdyIa1twSZAGCwL/5zUrBm/csNwRHmo1Sqqq14G0vsyBB/6fGa+cbsGB8w6UfhmIqaPaEGo1QnQrkpXjwIlucKFWo/yzH0kRAcGxCw4cagoQRfmwIPAuWSaGa5L1mkTtjqofk5wS++xfMmwzLqbqVXWOwjgH0D9QOUulC8lVZrz9oANjpgdcyhT4v8K86uUACq6ZAteA2lkNQ9XvLzPS4/73uUdbElRVb/BxkJiqX5fTAOfQAMAIwKO+W/3ZdMaNx1Mj25kCmvNIqilQnrmjahWAt/xcy7Ubc20LlJWcEivY6uySLJMQQeD/smbF4P9VVb3obCOCxs5sp+qdwwMAQQUprz7+kgJWMdKAQ8db25kClBkQ3eBDrUbxZz+SwgOCY28/cKgpXJZJjiDwrqTxMUJdVes1VuAaUBW8ZKTH8f/5olYSRXl8ckrsW588xd955y8kXvJAFt0waFW9KUhR9Rl/CUO2xQHxukBFLYnQM6MqWDkeEPsZcKLRiQ/fCcJgoQlJ40yQRO85RTd4joM8LdVtuGOMMGX/+YipNRUtx2x19sq77ojlT5xqvQbUH/j35wGQE6daiSyT+zPS497Y+kTryMHjTbKzjXC+DpPoBta9GooHPxFRlcQD4YIiRTuK5NPfSQDCBdRZCXbk8JCrw3HTOBc7p2oKcKIbiB8hyPOn2AdVNUb9/Hhhy4UTp1qPaq/1h3yjfpBSdO2q63hB4GUAEYLA/3PP84GvbHlBjKbUEwWo1qv/9f8YFXs0SWOP8p3cZY9iCjiTArAupwG//h8j6sscMAVx7HM4DnC2ET460SxteUG07nk+8B+CwP8DQLgg8PLaVdfxP1S/4of4pXmpMoyoXv3k5JTYzW8/6Lh+zPQA4rIT0pFX//MdZjjDCNA/EJwMEKkbj7kMcAaA8F5W4C8ZNqiMgj9WgDuZ7ebuetF8vDCvehmAr1RWgMMPLKL1QwMqDYPygsA/sCAt5n83r3UEmcONsrONcPAh8B2NHjzzVmR7r76nekhuzwosv7sB5nCjvwABcTR6+KVrzK3bsmoeF0X5Zfodfkhg/aEAVcuN9le50QX+uFHq1Z/MduOuF80otTjhTApQpGgvW4gcp0hX0yk35lnNeCzNjjHTA+BsI96/t+dctxbmVf8eQNUPiXP9IQBVGwadkZEe97fnHm0Z6S8M2pGq7xUpeinpWumCqYnDe+kOv6aAKl3lk9luw9NZllNq+DVb4xR/rznX77vXL6ggNQkCv3LNisGb1//eEaNyowZfr76x0olla8z4cx4UVU+9er6PRYXKCojhBuzI4VH0RSBuHWv3G36NHyFIM2+RYgKCY39x4FCTJMskVxB4jywT4ftsChi+5w+hJMtkWHJK7KZ/Lnf/dsk9nEESGTfK+ar6tLVBXm6UQ3tutI/ByhkUzrW4zIWsXRZMtboQP0LQBgg4DedqnJAgTs+vtybVVLQcBVCvfmdyDajfHcqNqEe6yo2mjr0p2C83KonAuldCsfgDJ6qiPV5Vf7mrnDScqxhjQB2ceONLDnJ1OKanunUBAqica9I4kzx/ij25qjFq5olTrecBnPLZg2tAvRqXJgwaKAj8E2tWDH5m/e8d/TSqvuMw6OVS9V00BQ7lt7YzBaijpWZiiTNvkawBwbF3HDjUZFLDryLPc4IsE/kaUK8yp3Dtquv4HTsrJFGURySnxGb+c7l78ZJ7OEESIYluCL5h0Cuq6jsLViMgWr3hV2oK+Am/StNS3QETEsRb8uutN9ZUtBzmea5uzYrB/L4Dtmte/1Wk6qnkWJCRHvfsc4+29I9ONBOV5vGb3Nzr3GhfLT+c60WSslFf5uAefS6kInNH1aMAtvvZo2sS9UpI0QOHmmRZJkGCwD+7ZsXg9RuWO0JDrUZax8QexHaqPilA+fZXM0h9pKsUZcCXxzrMxNImZYcFBMemHzjUFCnL5AtB4N3fden6XZWo2jDo2OSU2E1vP+iYfKkwqDa5udth0CsoWbsZfv2yMK96KYCT3+Xw63cRqFoC/1cZ6XHPPPdoS0R0ornTYdC+iDLpNpXru/PTaFZnw6/1ZQ7+0edCbKop8MZ3tT7ru6b6eQCyLJPo5JTYF95Y4Vm74vdGsyFAkFWnQgfSk9luPL7ZwlQ914eyhJ47Ld6CGlGG003A9ZW0Jt4810NHW/HNYfNF67PmzpQtkwZKd+TXW+NrKloOAmj7rlFYhu8QQCk3enNGetzbzy1yzEqdbZFVh4n3l9y87B8hzKtn3GhfSTlVPj03qB71CEdRs6fvgEqXyrm2S8r26FgBTvSAJI0zkalW14RWPnL6iVOtBQDO+eztNaD2cAmCwEuyTAyCwD+0ZsXgf6z7XUti/KgAv2FQT5uI9a+Ft09u7kPQcJxyq8ODDPjrxBZYnXZsrTdpCfq+dbR8krKnJLfBHGrwF34VfzrFlXCuJmL+1yX2NlkmRwSBl78L4VfDdwCkoijKA5JTYl/853L3iiX3cIGyzOtKRKhXfzLbjZ/+jxlZ1RpVfxm4UQrU22LMSI9vhgwLttYG9q369wErDb9SU2BogNM3/ArRDd4capDmzpRNExLEmfn11kE1FS25gsA3Xe1gvVqBStWRLMvktoz0uC3PLXL85FKqfsbbRlRFexRVL11md5Eoaj8xUkaE2Y28hsjLo/6135F467P2Z5s7rM/SmALjWvnInxwvbCkFcOZqNgWuOqAmp8QabHV2WZYJD+Dxtauue3Hd71oS4kcF0JJlHTfaYcbT5eQzVOpoxQgOEWZFhFmddrxdY7r8vIqPKVD0RSBm3+JmpoAqXVkm1k+nuOICw/rfse+AjQDIEQSeXI2NMK4moHIZ6XEGtRp0YHJK7JY3Vnh+s+QeLkCWeakjVa8Ng/YVga/aeR0fPDAnzoIlQ+s12LVgc7lw6fdyfSBdfcKvH2SavZlYHr0pwAu8NC3VbZo0UPpJfr11XE1FS44g8I133RFruJqqX68WoGqrQWdnpMf9e+sTrTeOvSmY+FP1HNc+44mT+9AelTWcQwcHVft0RZjdKGyORlGT55LvRR+BleMAhAosE+sG0tbOFCCEmQKYP8U+sqox6vbjhS2lJ061Fl1NpgB3lYBUBhAoCPyfVi8f9NiKe5uNgRZvO0ffjKdHnwvBu3UOpfFDH4ZBKe2UlmBBiodHnrFjX+PJITYMjtRLoP2lAjY3xF30M76wudDYJilRJ9JHD5kmV2Ce1YznHm1BdKK5XcmLKYiTXXbC/+X1UPeTz3z7tCjKTwBw4yrIFbiSQNWGQYcnp8S+/JcM2/SZ80I7DIPSOqbeCINqVW5HAKGvieB4/GuUDVOHiL26Ac8fTMQLF+ywqdl4fRYt8xN+7WRPrM8K86p/C6D4SodfrxRQtWHQX2Skx/31uUdbYjtq5+hsI3j6jdBeC4NqCXoAl5ZmMgCew1prEB65qeyS53dGmmFqcHT497MNwVhdGoGscrtXp0Df/LevaDTf8Otj9zSzPe6gPWZV5o6qhwC8cyXDr1fCRqUly+GCwK9fs2LwMxuWO4LVjCfDxdo59jQMSu1bIinkvCmAh0smCmgv8shyquLb1+ZGYWs0xptl5t37AykACA7/0nd/qYDbj4bgeKMbnKabv/KdlbICrbTvdWfLh3MtPdRhe0w+1GqUfvYjKTQgOPbOA4eaQkVR/koQeIfKyJDvq0TVlixPSE6Jff7tBx03qxlPIMR/NaiunWNPbFENuMODDHh89GgAQE5FiV870QscsHtCQR4pdM8UyMgdwKRou89SzwsADaKsgBjtTZteTXgx4JKZWKp0hZqJtb8wr/phAEcvd6n25ZKoBkHg5T8/7QSA+zLS415Xezx5+joMSiVwpMBjRn8zRoQacdfQJCyevQyTb1iB1P6NKDp7uj05L0OxL0AAmWN/43jAIRFsrTehsDka6fHNl7yGsw3BeLAgBlnldnAG5Ry+vf5BADPP4fNUB+Kc4fi8xQ0QxZGra5PgIPSauN6Tsp3oiaXhXD3zp9gHVzVG/fzEqdaGJ551HRUEHpeLc70cQKUly9HJKbHPqRlPFku4UeqoneOD64L0ql7sPkipml81bgxW3/UHzJnwXxg3fAIirHNgNAaAoA278j5hQKXADg8yYO34sZgRHwcL14KiFlEFigo0CShu8+BmwaOjpfytN47FYXNVG5OSWjNEa144JII4ZzgeuakMNwd48PEFC+YGBuCBwbV4uzoQkQIPJ4gO5D0CLXdpU0DDuRpCrUZp7kw5eNJAKS2/3hpbU9HylSDwbZcj/NqnFevqmBpRFOWbMtLjPnz7QcfSmfNC4WwjRFtspw2D3vpQMDLddn13Er7rANWq7lsiArF49jJEWOeww+Fo072Hql1COEQKPA7ftwhLF2zH0gXbkRo/DGn9zQgPMuiAEWYydEr9T4ipQKTAMweOEA5EQrsDPIcXLthxtiEYU4eI+NcoG/KMMqYOEZGWYAEA7E5uQiSv9EojhOu5GaBKd05WGrhluu249aFgfPSu4mRp75GzjRicbYTMnBeKtx90LMtIj/tQFOUpAMS+nk7I9+F5KfX0u7Wrrtu9ea1j4pjpAZLqXXLUuzUFcZDdIhY9JODnO8wovF5m9mhXbwLzmiWNV8/rH3SHo42B1OFogyl4Gl5Z+ixujjWpKp9ADuQQGj0JZnMQzOYgLF2wHa8sfRaH71uEOXEWBqpHgs2duq6pQ0TIgZz3QeA5rI0Jxp7rm9ixNiYYkTyHBlFGuc3J3rc0sgoAkDnxPG6ONSEhwoR/jbIBMkEkzymglXsuXQlR+ej+gSi8XsbPd5jx5EshkN0i6zio7jHnbCMYMz1A2rzWMTEjPW43gAdmPeKi4Ys+wVRvq34uIz3O8HWJXZZlEpOcEvuPN1Z4HltyD2e+WBj0p/9j7lEYVCtBOU5JXh4RalQTmIEaScaikdEgaEND5b8RFH4ze6/ZHATwCag9txe5DfVweghuizGjofosRiSEAnwCACAkbDQCg29E7bm9yK6uAcDhsevq2qn9/aUCztn4dr+nSSogwIz+Zvz38AaMjXfiupQgDOCcmDKgCQ+PsKOwNRp5jhBm+56z8ZBhQYTZjbKyCAQbFCdu85lgPBRlUcyCGhOLcvUoCcYn/LqvtAXn9lu8mVh+wq93ppGgSQOln+XXW4fXVbUeEAS+tS/Cr70JVF6qDMO8++plWSa3ZqTHvbP1idYfj70pmBL4hotlPPUoDKpxfDZMHIeHbpuB20aNRrRbwpHGejS2SSirKEZD9VmcLq/C6EFRaKj8NwyCG+agEag88yRe++oL5F9wIzzIgLuGJmHu5BsQm7gMRmMARNEDUfTA2boX+cVH8FllDcLNSu6pr8O0psSArfUmmC70w5QBTezvNEmFMwDFrR78/ayAwtZojHM6dFRXenwzysoicOh8OKYMaMI5G49Qs4AIsxuiuw0JESZEmN1IEdyobAvFL8basPlMMMw8BzPPwSGRXgErDb+eaLx4+FUSIY8ca8JUq+v6Vj5y1vHClq9PnGo9K1WGcU886+o1GsvQi6pefuJZl6D2eHpl/e8dsdpq0E71eOqilUNVXaSBx4w4C341MhmLZy9DbOIyhFunIc50Gq99eRwOmaCo2QML14KBoVHILz6C0+VVuC5SRlP959h56CjOtzQwRgAAkhLiQNAGp70YIWGj0dr4f3hz9ybkVJSgqMmDxyODGBB9uVFCgH2tes5VhgXb6gPhdKlA4jgUnWnFdpsZKYIb52w8O/oHt6CyLZQBc3VpBMabZTQ7RTQ7RSRGypBhQbDBhsRIGUeaozAwWMBTA+vUhG2u506WhhW4WE8sgLEC8sxbpH60J9afn3YepKGS3gBrT4HKqU8OATAwOSX2zX8ud/+32viB1jGh73o8cYCsqNJXlj6LyTesgBAwmEnAoPCbYWr4AkcaFZU+ItSIgaFRjD/948GjKDp7GgNDozAwNArnWxrw1rkqHKitRdHZ02ioPovJN6yA0RgAp70YL3++lfGgjw1R1P7zBxOx8pzAuE+WOMMDRU0ebKsPxAS4MDbeCdREY1+bGxwPRPI83r2xFelWJxIiTBgb70RipIxzNh4JESaMjHZgb1kMZg6vw3izYrdubogDmsMwZUATGh0BDLRWpx0vnDXi+cmtukSYHufCdr4nFkQ3OLUnVsCEBPEn+fXWcXVVrQcBNKoY4XoqCXvCjVKHaXZGetx/Pn+hdc7MeaGSs00fq6fe45MvheDG1zgdgU96an7zMlLjhyHCOqfdn6gjRMl9uijJf0tEIFLjhyGnogTrCgrY7wAwQDpb98LhaMObuzfhC5uLBQwogb+mplUHUuqYEKLc4MY2CbMLw/D8wURMiKlg12AjMktYKbc5sb9UwNmGYCREmFBuc+L901HIM8rIyB2AwZGtzLHylxiTEGFizuDSyCqkJViQlqA4fT3mXH1YgcI4B258TTHbqAmnNQVUVkD6/IXW2zPS4/YB+JmhfxMRBJ70RDAaegBSSRTlIEHg16xZMfjl9b93RHRmqp1rRAAQ2lt1TEoNyIz4OEwefzdaG/8PQsBg9ldqX+YVvIPPKmqYRD3f0oC7hiYxCZp/wQ1TgEJJzbvlVwhpPIcjjfU4UFuLE4XZOPfFq/iq7QJONCokvCmAxw6bGfkX3O0IfH/hVyIB+xwefNhigSmAZ+q/qEnhSusMEZhgbsXYeCcizG4kRsqYMqAJ6fHNsDrt2HF6AF6qDsUd/UVMi1ReU1CpADYxUlaka61iiiRGyigri0CatRIfX7DACdLrAQIx0oAdB3i/0wkBcKJHqX6deYsUGRAcu/DAoSZBDb+6uxsg6CpQubWrruP3HbDJskySk1Ni//nP5e57l9zDcZIIQkuWL9rjiUVYegpQ9QQyBwvXghuttdi2dxcmjL4TAFD77Xrm5S/++FNYCIeFIxT7c2BoFNYVFCD/ghtOD0GkwGPVuDH40c0vICRsNMaOvAPm2v9gd1kFippE7GtzKx67+rFON4HTQzqdmkdVMH0feG+d1Yz+ZkZBybCgoFJmtqoMC5qdIvoHtwDNYQg22BQTQmUDjtTEMzPgdL2F2cyiuw1Th4g40hyFoqZeLIdRr5nj9COJWE8sLytA22OSaalufkKC+KP8emtKTUXLMQC1Kob6LNavzZq5KyM9boM61Y4NDNNyo33a40mj/TiDN2c0NX5Yu5euKygAAJ36z6ko0b0mxcPDNGgIFs9eBlPwNAb05e/9G1/YXGhySl6uEd3PcvI3Kp3yvZxBSSe8OdaEpZFVSIgwtctvpVlXKR4ej9xUhv2lAjMVNjfEIXPieQBK+iD9+y+/joCNyL2fkdWJnlgaPIj1ZQ7h0edCzmfuqFoBYFtXM7E6JVE17RyD1Yyn9Z2faheon2rXw83heA1PKslwiaoabRFhQbPOWXq5uBwmge8QpKnxwzAwNApCeKQOpAAQFH6zNw+gqe+K9DjeK3EdkuLwUTOAgrPREYCCShlPV1oBAFUGgh2VYXhkdCMizG78oTSeUVv7SwVUtoViyoAmyLCg1BOCu0yB2Nfq7t3voJtOKHR2OmFEQHDsXDUT66Ag8K7Otsc0dOJyeFudXRJFeaw61e4XPZ5q142YPfWk108Yy2L2IY3nFJJetfmKWz34Sf9YAMBLp8oRblGypHIqSpg3T23TrMpWfFZeiyON9Zjarx/yi49g9KAoZuOazUFoqv8cfzx4VFHzl6Hkmtqtb9eYsO60BYWt0fjcZkZzbRAmDfBgydB6pMc3Iz2+GePNim0aYXZjvFnG5zYzxpsVMKdZK1k1bFlZBO4YeQHbKwLg6O0+A92fTnjT/vMRqTUVLXk8z1WraYPd9vpZybIoyr/KSI/75PMXWqeOmR7QrmSZen5PvhTiPwzaCzeZSEpsfe7kG1i8fvHsZbglIhDhQQbF05a86p6m8uVUlDAPnsbvX1n6LNL6ByM8yIBGh8TMA1PwNCVSBaDs1Gosf+/faHR4mOfbl0vLFGiTV54cYsMjN5XpzICzDcGMLcjIHYBym5Op/QPVCt2lXYMjW/FQlAWgube9HCzvKPxKNaymEQevhl/lz19o/VFGetwnoijfA29VGt8Viapt5xgmCPxLu54NWLPi98ZgNePp4p2be7udo0bd3zU0CTeOux3gEyCKHggBgzHz+uGKl25TuFIL14JEs4C7hiYxkHIGYO246/Gjm19gIdOZ1w/HopHRSCAEu8sqYEErZl4/XAmnqvZpVmUrrkRuOXW06uwS3jxvxJHmKJSVReCl6lAWRg01Cwg1C5gW6WSRqwizG+SClQUCtGaA6G7DxxcsmNHfrPCsfVz9eujoRU0BTs3ECp00UErbnk0SZJn8RxB4Z0fhV85PGJRyozeq7RzHXal2jjR+H25WqKN+g1a140kBwFa3C7/e/Htkldux4caxzBalIJ0T53W0tLao2RyEslOrMfmlN2EjMntdR8nUl32plhtN1KaSsiMna2lkFaYOEZmTtbo0ghUd0kLDJ4fYcGuOGQ0yAceRPnGyutgek1dr4Y6q0wlz/dVnaeHECwIvG/o3QRD4BzPS4z47/IZzHFX1vgS+7Bb7VNX7WxSYdNFMqOb6w/jC5mJEPKBUd6YlWLB+wli/IKXv33noqOoVc8gqt2Nl7jFkldvR2CZdFpV/0QdVNQNsRMYvv47A+6ejdMGBsw3B2F8q4P3TigNJAwhTh4hYXRqhA7XWHKBmQJ8svnOZWNoAwZjpAfLhN5w3ZKTHZQP4bzVAIGuRZNCGQWWZxCWnxG7+53L3ihW/NwaoPZ7adW7usJ1jH2UjuiSCBJlgREKoLvtp87b5yCt4hyWU3BZjZl4/71E4xfMtDex310XKMAhuFrt/bcdKrCsoYM6Y4jCp2fxXUedYjlMYgRMukYVc6Qo1C5g5vE4XHJgyoAlWpx15jhCWa1BQKQPNYZg5vA6iu03t4sL1XRM3yrnyl+yJxYlucLzAy3emEdOkgdKs/HrrsJqKlhwArTT8qr3M6RnpcX97LM0+Ss0bvfJT7XzUPw15+vKkjW0S41Gp2gaARocMjiMIMxnYe5cu2A6zOQh/fX0WVuYeA2T+yqr3ruyDWlel5VqpU3WkRqGoaIg1c+J5ZOQOaGcOUDPgl19HsFBun3/37k0n/DpzR9UDAD6nuDcLAv+71csHPbH87oYAc7h3qp2WwNc1frgMQxp8n3SiRrS0xD61Q+nv1hUU6MBMQUxXu/dWOvrGTutjsALAnuub/AYFACWbi5oA9P9HauJZqTe1V5dGVmF2YZiSE9DXD+slGmH4gFVyNHqEZ96KdD35zLerRVHeaFBH3Ty85B7OoGnneOmpdn2o6tkN0bS94VSyrEaSMbVfPwZSmj9KQUqzqEYPikJI4zlYuBbUSDKcHiXV77OqKnxWWY2iJvE72RiemihvVZtQKYXC6rSzxGq6aBog5Vl/lBOFBwbXsmTuP5TGM0m7uTgYDvRxH1ct52rwH371nU7ICzydTjgjv956HQ8gUc14YlOWKVhMQVzHGU99ySmqBXk0Cyg8yMAkCQ1n0kW5Ut5FkBo/jHGhpuBpWDx7GV5Z+iweHz1aw08aAPA6rvK7tLR8a1a5nTlQ1LGix/uno7C6NAJnG4Lxr1E2Zho8fzARKR6eSdubY01951hdytHSZGLRDDuvuQfe2UbkmfNCJQADDbY6uzwhQZybNM4kix69Z7/oIeGyTrWjEahwiwGH71uEjJ9lYub1w3GiMBs1kswyj2YkxLJE54GhUXi5uByBJh5T+/VDXsE7GJEQipCw0TAHjYA5aATiTKfxrxMn4fQAHPf9mLxII1l1bRLC7WEYGe1gOa0yLBgZ7cBwrhHNThFTh4iYMqAJ+0sF7HIH4+nJ59h5dlSGoc4u9bwyoDucq09S9p1pRJuFBVMQJ3/0brNh479a/iSIovzlkZr4tplosRCPSLgAQacEnGHksg4NI5JSNUqL64BpeObnv0Bo9CQ01x/GpH9sQU5Fic4Ope/RUlC0gM/Zuhc7Dx1Fk1Pqe/V2mSUrADRIMtbUtCLPGIGlNqfObh0cqX+Pv4ZtB6qdeCjKghcu2PuOW+0o7ulR7FZnWPsPJB6RAEbDkZr4FlH85kseQFlJseMzR6OHM4cbJe1FPpZmh6mJu2wSgnq1vp59YtKTiLDOQb9BqxggqUPU6JB0TlJz/WE4W/ey17y5exMDs/YGf1+Wrwmj5Vn3lwp4/mAinj+YCEDJEtOu5w8m4uZYE+4YeeGKfgdTE4fH0uy6h9AcbpQcjR6UFDs+A3CeB+DYllXz+Zk8AvgktMYNlTDEbro8ICUcOAOwMmVMO6noW4NPV2r8MGyYOJbRUgCw89BRFhygAYJGh6frXq3sc/SlN9wLn3Og2ltiTe3PhAgTJsRUIM+ohFMfuamMgXV/qYA8o4wnh2jyQmVy+R8yicMQuwlxQ9slIZB9nzmwLavmcwAOg5oXiLiR8ek/muQOFj2KPy+JQIBFQFNLMPaVtig2qtQ3nr6ikpUa9WfTZyI2cRlEWpurqm+nvRgNlf/GHw8eRaJZaJfOV9QiIruqGmbSwkqdN29/VCH03V2oH1JzCyCofpd6cBRUvdF4V9YwGf4+pxtMgEMieLvGxAoKB0e2smoBWhhIKwdonddTA+swNt6JRkcASj0hqLNLcF6u3mey+t2rXXhgShimpUos8RqALARwwrbPo+v3ftGwXhD4SsF1LoQz9G/KLyl25DsaPbeaw5XKUepQTYipgCnHDGf/vr/2BlnEzkNHsXSQ176MsM6BsxWsApRKUu3PqfHAhryTkAN5fGFzIavyGFYd+Q0IkQGZ73woVOX6iEfZQN3jHWMCjOpJPBo7q4s3hzMAxEjtMO/nmJo4OMMIiDWwy9KfsgBEUtT7+6ejMCFGH8FSflZs1xcu2PFQlAVTh9QxcwFQQqt/rr+87dBNTQrGAi2hrLGwKYiTHY0evqTYcQLASde5EE4w9G8SADi3ZdUcfCwt5NYx0/XbP3GiEUMyTSj0yH1GCivRCQIi8UrK3bb5mDv5Bp2d6fy2FFk13qSTL2wuHL5vERKTnoTD0Ya5k9cjNHoSs0mVhBIehO+aKiKMkLZg2HAzSoqVPqfvqv+yiBw636OVZbsbASJxQKUTpiZF5Y1PVFr1DEtVPuvdMw4lA62bzmueUWYpf/tLnTpHKuV0FB65qUyJ9fs4WbRq4IVdVjRIct+PPFL3eojdhIkT27VF4s/kEWzLqskB4DL0bzIKKlEAUZQ/fP901ENjprcEAyC0dUt0ohnjEzkU1rlA+jhkSqs2V+Ye00SZjrIbQJNOcipKGDNAV79Bq9Sq02nIeXY8strsXZZ2xKhIuHlWC16+pxaGwSGQzipNJh5rCEa5zYmt+yPx7imHIv1iTICBdJgxRhvnElUKm4rcGGI3Yf6MKEyIqUBCBGEeumFwCM7kERx70dwtoaDlVjMwAE8OsWHqEK10rMIvv47AHQ3BuGPkBSZFM3IHMJC29xv6Tu3TvR6faNFFp1Tjin//dFSLKDZ9qL5D4gHIUmUYl5Eed6ik2HHWZSfgOL2hsnBqQ4deZm96/NShAgxodMjYVaUHG/X46e+b6w/DVreLOU8OR5vO4++u9zxsuNJTioLUGWnG0BQOP/6JGS/fU4uvlhCsHR2F5OMcUOlSQGrUOEOyT3fnU24kn+DxXroDX66pw29m1+LHP1HOSRv/SmdbMDiyFeMTOaDOpby3h04c9f6pk/V5qkOlrVqREGFCRu4AAOhUF+2+Yiq02KLPnMtOsP1T+zcADq9ddR0PxYADFj9g4TJ3VMnbsmo+aqlzEsAbQqXqP7nK7LXN+igSFW7m1Zg+YdnoNPteS0lRqknr4VNm4M3dmxQPmO+GW+JRbCZfusbU4IB0tgXS2RYG2t/MrsWXa+oUwJ7ggUqX0rKdU+1cSQ/Qz19oxcSJRhgGhzBgSmdbYGpwMDBpH5JuCwWew4FqJ8ptTkwdIuroKtovgNqlB6qdOq9/f6mAm2NNSufBvvapPEBylRkTJxrhshOmFQItHNdS5yRF+bUfApDXrP/G6w5k7qiil/Xu33f34wItqh+utBpk6p896b3p7auJJo+PHo3HR49GWn+LLnza2CYxgj81fhjLjNIuW90uOFv3wmwOwtzJN6BBFgF0j7geYjf5Lfug+Z9VZww4k0dganDAGWnG8rsb8PaDDmQEWGA65VYeokoXkk/weDw1El+uqcOPf+IF35k8gqozXgRSiUrXHSMvdFsoUFu/QVTyV/eXCjq6ippQ9PesgyGgS6ym4aO+CpAQHkCdC+MTOUQnmn1nxnJ/392PA/AufTlUgoD9RxTlkyXFjiIAI3yJmGHDzUCBvXdBqkqN1PhhjDud++167Dx0FItnL0Nz/WFALVlOjfe+V0vwv7l7EwBg6YLtLBHaG6frJFI1NtP8GVF+X+Ivqx4NwODIFgyOBF6+pxULSwWsyFQcpIUZDcyrls62oEoFvO95TA0OxA014+yZYAyObFXVvwWFPXFMDUp7dSW+X8GiVYMjgalDzuP5g4mYOqSMZf8/fzBRx6neHGtCVqWj76SpxGnUfqju8gFwJcWOr0VR/lqlTnVApct1rIzsPJntXqVm9hsAwGUn+M3sWqzLEeCKVTDQG6pBabSr6HHakqffoFVYOki9icHTkBp/FAeqT+rsVN+808dHj8bmbfMBqKaCzIMzdF2i+lP7FFhUdVKqR/t7+rqpQ0T8JcPGbELfv2ull+95fH2Cd3eYe+T906XkojpRbhMYXUVtUgpSAIwpONsQzIIHfRfcITA1ce3UPs1FPVZm2AnApU7N0TOBqtFKivJrP3n/dBQhBjeIR2TeX4jVhHlWc69VMVI1pZrJsNXt0kWgaGRJS1PRtfKrfFYu0tgmYeVX+VhXUIBVR/K7VefEqcWI86xmv2pfC0Rfu88XsO2krvpebXZTQoQJU4eIiBsqMdWv/VzfKtJuLZ7DmppWpuapXUorV+nD8sIFu+7hLLc5lV5afZm8Iyt7HWL1joonHpEQgxvvn46SC/OqPwFAVEzqgbpm/TdEFbWnSoodX7tbjAbOKDBIB1o4LJzaANMZd694pNr++nMn36CrZaLALTu1GjsPHWXdmnMqSnCg2qk4XkEGbLhxLDbcOFYpe6YJ0nzXQ6WEV7hTrSPjCzgtEKcOEVmHEi1YL7W0AAWAqjMGVJ0xsJlUWmDPs5qBSle3HComBFSOVGur0oeAJqho7VT6+7QEC+us3at2qmavF05tQKDFe3I+QJDdLUZDSbGjAECRIPBYs/4bAj+xFeI6F8IDqD1WRj5rqXPCFMRJvt5/b69bIgIZB6qVps31h7Hz0FHGmdJ16LeLcXrVRjw+ejTrsX/4vkWqp9ozB0DbbU8LQPovlYj0b1OHiJ0GKbU/ASA314P9pQIzJfythVMbYGrieiwUaGxf+xBkTjyPFA+Psw3BzE492xDM6Cr6975cWiyp3r5c/KUHx8pINoBaFYt+gQpD/yaDIPByYV51Tm6uR1RtWELt1KAwQXnSPeizxOPab9czEyCnooRxptTzp5lUSxdsZ6AOjZ7EpG5Xn3BayzPPau5wcIQz0syASSWplqPszNKqfiqVL6X+eyMhiA6r8L1m2tSC2qm35ijN2qiterG5r92VppzBu9dBYQKzT1WMCeU2p1iYV31QbWeqw6bvY0Mt0P1HauLPONsIx3HK86ymXmHYcHOvqX9AyfrZvG0+o5h2HjqKzdvmM+9daxPnVJTAVrerHcn/5u5NSkcTdM/JMzVxF1X7lE7yB9jOgrVczRWlAKXgpOrfn107PpFj/GxX91obqVK8fK+dur9UYHbq2YZgrKlp1Q146yuHivDevTaHG7XN4mRnG+G27o8sAbBfI0Y6BKo8Ymw/AUD19k/tR1vrnTo7gvJ8vRGlovX/DaKMdQUF+PXm3+PXm3+PnIqSdt32KH/6hc3F6CjAm/43d/INiOQFHe3VaSdKaq/2KVAoMKnapypb61xRtdkZ71vrePmqf18+lVKCPckHpmCl19+Rnbo2JljnwNGeAL1hTvnDii+zEmjh0FrvxLEykgegRsXgRYGKwrxqSJVhXGFe9ceq+jdo1f/QFI4Z+r3iVBmUsuascjt2VdnZv1TVa5tK0PXm7k2o/XY9I/mZ6u9iPiXhAdRcXO0DSl6u9gZrVXhXFlX/Wuk6caIRgyNbWQDB12YeYjf1mqmlfci0dig1A6idmlVux79G2Xqvnkr2dk6ZZ1Uiez5q35Cb6xEL86o/UrHX7hT+dltSO1V8vHV/5IWZ88QYL//lVf+9S/4T1uKJ3hDFNi1hLSNp7T5dOw8dxdzJXuAqzcwMIL1A8FJnydTgUOikBgMA5XdxQ806L72zzpQ25q6sVhY0oBznYLQC0LMLuoQgqav7qphOL1yw49ubRB09RiUbBSiddh0pOLHn+ialQrWh930QRe2LviXS2Lo/sl4Qav5PbScldQaoRO39U3esjHzlaPSk8QFCuyfdlGOGM4brFrGu/7CO/6aNSGlr95ucEsJMBqwrKADvehMNogzwXRu+oXB3is20ML3BrwMFAFPhwNkGykEKQKkHCRHBOi++s16/b+AA8GblOyMlOGEGGtrf2O4KBW2Uijb3pZ9/pCZeSQmMbMX7p6OQVdOKtTHBugSV3rJTWfokC6gE6O6Do9GDY2WGg6IoX1Cx1+5G+uUg1KnBXFF+7fZ9nzkQaPFObnO2Edw6M0RRSTLpVuzfO8pc1pVEpyVYsOHGsez/NM5P7VQFmAQRnNI15fB9i7AyZYwiaeXucX5D7Ca/al/Lb1LVr32dr9ffGdDS1ydEmHSq359TpbXnTE2cov65bkhUdWSmVgNMHSJiQkwFssrtzBxIS7DoQLq/VICN9E5eKsXIELsJw6cYWYK0Skth32cOFOXXvqPBXqdUPzu/KMp7t+6PbJ05T2Q5qjTzn6okmkTcnZXWPxivLH0WpuBpqP12PQAlhLq4da/SnU+TU6ptMEFXhHWOUg2wbT4OVJ9sN53kojbTRWL7cUMlPQnfAKb6FbC2qhWerZeUohcDs++5mSRv0J9jnrUfMtHNkKBMYOMIJsRUoNymmBn0oVtbEwygCRNiKjDB57o2N0SASPbeS5avU/Y60NKiVfsEALd1f2SzKFb952Jv7xCoapSq7lgZ+cTR6JnLBwgyId5moY+l2fHua1yXS1TYMF1e0o3doS0laYl0avwwZJXne0W/i+CVpc+y19NOfmZzEBbPXoZ1BQ8ona27SEtNiKlo57XHRUowDA5BW5Oo2o0KgM6e6ZoEvZhU1Z7DGWmGIUxJ/0OTqGvUq73RXU1c15ao0B7/WkdQsVFF3bWV25z45ddm3ByrsAFralp7Rar6qn3adrK+zMEfKwv+PwD1tH6vK0AlrnMhvKF/k1iUX7tr32fG9JnzQgl9Eqj3P+RFEwolJXe0u1/GVrdL16/UVrdLyZqCnj+VAzk01x/WhVrp63vqTPlGiMpzAcCDhAgT4oYq5DSavKFPbQ5pV50pSnspFqr33Ps+02YrKZzwkZp4RpuZmrhu161xBsXeVKZWe3ulHvjaic9TvZSUYpOa8VCUBY9MLGMJKz31+KnaH5rihJqYT9U+2Zvr4Yrya/cA8KiY84vUjltR92/iVIQfOVITf4HSVBQHfICA+TMsQI2zS4S0Nhklp6KkHSipR+/LpTY6PFj+3r+ZiUClKgVuuNkIyN2bqURtRnpoAfz33f18QKRIwLihUqc5VGobakFKAb/vMwf+vruf3+u5Y+QFZhezJg1dHGZMJGXaykNRFt3UahqBoj1Xs8rtuDnWhM9THcxWpdGpbvOoNPJX48L8GRZQp5w2QwNgOFITXyuKcq4g8FCb96JLQAUgu86FcADOlBQ7curLHJwpiJO0RjAz9Lul+pWJe9ou0lrgtb8a76U6W/cywHaUYdWZ5QwjrCdTR8ClEu3vu/shN9fDbFdtpKpTnxVp1kWjcnM9TGIp9VPtHxSdqWBVhxp3Q5o2iDL7DC3/qy3yS0uwIHPieV2Ao9uVEh2ofa1TbgripPoyB1dS7MgBcEbFmtxlGxUAuX6O2Qg0Obdl1Rx4LC0kLTqxvdMxxB7cowpV7XAHb9Jzx0t5zVE4vy2FadBRzJ18gzIUoivpfZrHs6TYgcE3+U/to6BV/r2AchvYqEhtUsXFwMqK98KUQkGlBWQ/TIipUG020yXfe6zMDIzrQiK4TnuBRaEyh5xHuc3LpWqjcXQoGwXpL7+O6LxzeglaSmkw0eqXWdmWVXMAgFvFWod1DReNd9RVtXKCwBNRlD20QYUkKg0qRA8QGCSgsTkY+75tUcZGdrJBhbJ5BBa0YkbSIDjtxdi2dxdyKkpYh+iBoVE4WlOHgcECUuOH6UZErisowMc2Fz6rqsKLh48pLSS7aiMTGaZKglFBRuw5HoQ9x4NQbI/G6XoLG+bgu0LNAhume6Q4CAm8E+Z4AwSH1yE5Z1MuhLZ4pNL04AEXdpwegP7BLZg0wOP3/NTcaHaK2FsWg0Pnw/Gv7EBUNwEtzS6I/QxdbgKiHVxxu5XH2Hgnztl4ZWZVcxh+MdbGhgWfs/H4Q2k8XjhrxENRFoRGCN0fTKE2mDAVu7Hsx6GYliqxBmgcB1kwcoZXPgqv2/tFw1OCwFfVVLRc9Em8VBxQWr18EL9m/TfHS4odpxyNnpvN4UZCebBASw8aVMg8dlXZ8evNv2fkPo1AHag+iZtjTbpcyfAgA1Ljh2HVkXxdAIBm+jc5pS41mTCdErH27olYPHsZ3ty9CVtePYnMHd9AEHiMGKvYjOMTlRxcX3VMy43fPx2PCbYKTB1y8Y+kNmhHEpSWYR8rIwDMKMqvhSgq1/LUxun40+Qb8MQTW5BZae9Sl2/fLtXlNptajiJCWz6tePoRqjnAY+koG6YOqcPzBxORhe6VTnMGL+q0DSZUepM4Gj3Y/qn9NID8BWkxhswdVRfl3zrzrAhQiJ8n898I+8OY6QFwthFOtTNQX+bArQ8Fo/D67qgJjnF9ui9IlLi979jIdQUFaHR4sGHieCyevQwR1jm6iSid+Xxl02UkHxeQk31KV2ZNAUtjzYJKlC9Ii/ELWOqMANB1c6YOC+30TO1DfwBdkRmBovxaAIAoKqUGgsBjQVoM/vSnRQiNnsS+56CFS7pUnsIIf57Dv0bZmClDTQraOp1GqWhuKl2Ddlm7rf7pQ5J8gsfnL7Sy2n2Km5PZbjL2nqYnAPxZgzF0S/VTJUkd77iR8ff+aJJboG2hRA8QajXi0JcGnGhxKuqfdO3L0D6f9CAS/ZZAUbMHFq4FA0OjkFNRgkSzgF+NTMbcyTcgNnEZHI42CAGDUXtuLz6rquqkS8wBBg4tTS6cqHoTM5IGISRsNMAnYPSgKCxeOAvW4TZUVdlRU9ECnudwvNCJ7dkimhGB1BF6M2pktAPBBht2nB6A2CAJzU6RmQBHauJxx8gL7dR8uc2JZf8IwV9ft6OuygGeJxBFGYIAJI2PwaOrJ2PFQ39CWL9fIiRsNByONry2YyX2nayEaDV0uts37ell5jikW5Xy6YJKmZklVqcdCREmBBtsurGWFMTHG93dS4ahfaVqXPivqADcvcDAQAoAQgCHVz4Kd+07YPs9gJrOGN9duYzqOkfg/P9eQGJEjxKloh9qamvE22cFcEECerTU0ukRIUaMCDWizi5hYLDARpc/8/Nf4Kcz/oHA4Bt1TdQGBpeirLwExa0edKrMlyjtuYtKWrHxrSyYpX2YMPpOHWDnzrDCVvsNCoraIMsSA+z+86G4cXirDnyhZgHBBhv2lsWgsi0U/zlmhMsU6bed49NZFvxxYzNqKpwQBImBNDklFo+unozn1qzB5BtWQAgYzOZgrXz013j5UBmcQ9UJNF20USlQaZPfgkqZ2ctj452QYWFD1c42BOPBghjFR1Eb/HbVRmVTZVokrPtxC4aNCoToDQETIYDjHvhfqbCuqnVtZ8/ZKRdEqgyjl7rzZLYbpiCO8akuO8HEiUalbKI7NTYsRi8zO/SVpc/ilaXPYmXKGF0dv7aFj3YlJj2JV5Y+izCTofNpaWp7budwASt3H0bq9CT89fVZrK16v0Gr8MzfNuKpjdORnBKrmgISCvMu4PbHPEzla9mBO0ZeQEmxA8OGmzsEaeaOenYuUZQxYmw/bNg0A9kfvISlC7az1u7O1r1YsjAR1z+4GZluuzImqRutMyM4nql9LZPwwgVvW/XVpRG4NceM5w8m4v3TUUjx8HhyiI35CN3iUTtoMGEK4sjJbDeK8mt3+GCr5xL1iWddnBJFsrfGDO9//48muSF6vKN9Qq1GFH0RiBOmzrfXpokp4UEGrB13PV7++SxEuyXMnXwDU3kjEkKx8cCHbGYUbScpus9CCBgMZ+teCAGDYTQGwGkvxonCbBQ1d3ISNBs4ywGhAupiJBzYV44zH23EtOlJ7cyBqKENqKhoQ11VM2RZwIFDNr+mQOoID0ZGt6+Jv+tFM7L3XmAA5XkOd90Ri7e2vIRxwycwgIqiBy9lzsUda/6Oo0YPxEQjEGZUHqyuAkadT3V3jAsJESY2fCIxUsaRZgWQsUESHjlJ8O7oRkwaoFz7zOF1KKiU8edvDN1ql06Zhv8y8bh7gUHX7lwI4MgrH4WTLw42LpdlUk2x1SsSVRP7Ly4pdpxU3ydrn+6FUxu61UnllohALJ69DIlJT2Lpgu3tpKa2sG9dQQHL8Kf8K62x6lYrH1qxKgEcx8OZFIBMtx2DFi7BX1+fxdpe0sEV2R+8hA2bZjCwZe6ox9NZlkt+zF0vmlGYd4GFRjPS4/D1kcfwzN82whQ8jeUv/PX1WYidMxgrdx9WnKb+geA4vlu1/douNFSSakPFKR5eTVRxYm1MMKtAoNG2X34d0e0u3dpKUy2nC0B22QlfUuw4LoryGeqsdgp/nf1stY9qy7EyknUy2309HZpGY/8TJxph2qHGo2V0O/YfYZ0Dh6ONxfy/sLlY04ms8ny1F9UmzJ18WBNqVbqpNPagB712WoezP7DmrVxsefUkFt2/CUsXbGfXtXi2UvryxBNbkLmjCpk7qgDE6Vp7twdpNQPomNtGt5vH+tfXZ2HLqydRanHCOVwADF5wEqBHSSFaIh/wBiy0CSlTh+jT+zY3RIDmynbLkVL1NFX7mgEm0slsN3+sTNgFoKVhB8eHpnUu+N5p78fQv4kXBF4qyq/dX24zYgwCaIkKBwDB0SbMsxqR6elaAwhaB7V4NnTt0GkU6paIQJZAra3fX/7ev1mFKiHq7shq3lh3oyk8E3pwJgWg0COrgE1C9gcvqZJvGkzB0/DM3yZhzG0KnbUtqwZAjK6f6rDhZmz/1I7CvGokp8Ri0f1j2gHUVrcLqdN/qwA0Tu27KnGAh/QInFqb0kuL0RTFCvzy6wjcHGtCZmQrK5H2BXeKJ17JnOqqv6FGo+ZZzQiO9viyR8L7p6OkovxvDwgCj9A0ievKrem00FG4Pjl/6/7IY6o0lencI1NQ1xpU0BQ0Wj2qVecAOoz50xqqL2wuTXWAARxHEB5kYGlt3V68ekjespjCvGokDLoTSxYmsjotrTnw1MbpOFZGsGb9N9iWVYNtWTWgXeioo0RBqnWUEgbdiaL8WmU8EiXyQXonWdnnQfWd5pfi4bG/VEBWuZ2B88khNmROPI+ECBNeuGDvVpxfq/bpgF41lCs52winqv0TPtRnrwJVXpAWIwCoOVZGvlQrVGV/cfGuEMLhZqNO5VO7k/aS0hL+t0QEMpuVxvaVcxHMiVM6As6JU6oDequTi/hlMyP+M3dUIWHQnfjr67PYNZuCp2Hpgu3Y+dpiZKR7x+Ns2DQDO19bzDx5pcX7Xvz19VlIGHSnajLQWLULvb04Tm+favMY6CSUIzXx2HN9EzInntdVya4ujWBtfbob5/fFgqbS9EsAtWqlaafP3tVHRhAEXhRFef6e5wPfnDkvNFAlcjmOA2S3iKVrzMh0XzrUp23pQ7ue0CgRBal2KUkoSqySjpcE741gPfPzX6DfoFWo/XY9lr/3705Hqi7Kh1S6IHzc0u5PlPfc+dpi1pqdXafaSNhXI2zeNp9FvXydCGFKKFwjAnolk943GqWNRPk2Z9P2pdLasGtqWrs3RUZt5pERYMHmtQ7wAYJ2vin30bvNzlmPuDIEgX9PFOVLRqO6ZaNSSlWJoPDZW/dHlk/7mWeo2qCC0zWoyHFcMvbPVD+ti1L79lMHScuf3hIRiNRBw3R2LQDdxGnaFkhhDf7dLW/V1yEwNXF+d1IQeBTmVWPUhKcxYuybzH51ONp0FQiUsJ+75E0GUH+ervhlM8jQ6D6ZkVBuc7LBaFOHiErYFFUYHKkA9myD93WbG+IAo1LH1t2BxqYmDsNS9ZWmULpIc1v3R54XhJq9ahZ/lwy0rgKVJKfECoV51ReOlZEjLXXOodGJZm2NNu4YeQHrcjhAunSFKm1CkVVuxxe2AgbQRofEVHekwONAtRNf2ApY6TS1VR8fPRpzJ9/AKC0q2RRzQWkH5K+3fmeX+GXzpeg69v+OZmKFRk/C+MQtKMq/xEV0syTa30rrb9ap4LMN7dsFPX8wCnlGmdX205/vGHkBt+aYuy7JVSeKYkBbaRpoUXJCtmU1HBZF2aZiSOyqguvSqqtqBQBSV9Vq+PEYbt6wUYE8nQwseoCoBANKDwXiRLOj87F/DnC6lenPTg9RZjAZgLR4CxaOSMLN/WPAe5pYCiDvaUKZU8JzaT9FYtKTMAeNYCFVIWAwJoy+E6n9G1F2vrjzAQDfEKAI8Cf8U06iKCNpfAyWr5mCl5/+D0LCRkMUPYywp46hw9GGkLDRuH3eI8hId+Gzr86w/AHfFWA1KXH8HkhU6u0/l1gPNIexEGlBpcwmUI83Kw/X6XoLnp58DlMGNGHKgCakxzdjyoAmPFgQo8T4u9oV0aDE9heEWnDvPWDTolWSn/vPZw5kfiQ+AeBUXVVrl78l303FCAD/t3V/JI3NEc2g1Q77OF3qiaSSMi3Bgj9HByM1fhjr2PfMz3/B7FPqYO08dJT1ovLtBqg1Ebr67Wjrbn8ApY5STvYpPHzvHt3f//r6LKROT8IDvxqluyaHow2JSU8iJ/sUNmyaoTtXh7vbHU9f8jIe2qToqUNErC6NwPMHExmp7ztgQtslpScmyLDhZtYGSjPlBFv3R9YD+Kyr3n5PgEpX07Ey8qmj0UM4Tl9T19VadF/H6pWlz+KhVXnMwfLanl7w3RIRiJyKEry5exPe3L0JDkcba/NDW6Tzru5TPdoSGwqqjPQ4lH/7Dh6+d4/uwSg7tRqp05OwcvdhFF4v66Jb1FalJsHD9+5B+bfvIDklFqIos3OLXzZ3u3WPNgpFPX1frzvFw7MaKDoflfZ93V8qYHVpBHZV2bud0udvUIdKS5H6Mgc5VkY+AdDUbW3RnTep3SwgCPy8D542bp85L1SmUSpa/jDhLqHTOapaoB6+b5GuXyoFIC1T8c6fUpKo58RZ2g35pa/rTvdpb2K1G879jQDQzsPX5rAu/90DeLfOoXChvu1jK11IrjJj0f1jdKyGlt3QMgHiT0O6lBjtu39rY4KZJKX5sL4/09xTGkKl/6d5qd3x+LW5pyffl3TtekxBnPTRu82G2x/z/FwU5Z1SZRj8dULpE4mqVqgSUZQPb90f2aCeh2iN5/kzLF2O/Wvj+v4cE1+vf06cpd0sqpyKkm63SGcUi0eRcMkpsUzNa0Fqq9uFRc+Ox6CFS1hmE3hOcYTYwQH9A1E4TsSat3J15oBWumZ/8BIy0uMginKPJ3lPiKnQ0U1Th4g4UhPP2k7SDimZE8/jkZvKMHWIiEduKtOT/N0xOVRTaf4Mi78gkWHr/sgLaqUpuVilaV+ofnr7KwF8Ul/maNedWleh2km76wubCzsPHdU18wWUNL7Fs5cxMGtH+lBwUimaVW73Nl7opp1lOuPGUxunMztUq+b/+vosDFq4BFnHbCxxhEWUfLfIo3gZvskuWmcrwjoHG//5NYqPr1TaJHWxH6pv2x5/4KUAPNsQ7Dcos79UwK055u5l88teU8lX7auVpgDwMYCq7tqnPQKqGlnwbMuq2Zubq091c9mJd4S6xF3S7vLlVLWDzpyte1mTCUo90XmoVKpSsFIp2tPxiLSGXmt+6DKbhgtegF5MTfMawPrJfdU6f6xsvDtl0WoOrhaE2mraf42y4WxDMG7NMbO80/2lAp4/mIiM3AHekvFuhEy1o8x92kkCUNrAb8uq2QtA7Go0qic8KluFedV0OMVXR2riq2eiJRaAzHHK7QmxmjB/hgVrCi70aIYq7eXvu6g09ZWqHRL9ciceTZqU0j8Qa97KBTALcyffgLlL3tRlNnGyyhnyXRAHHihDhPsHojBGMQdOfjKKpfo98KtRKIxzAMbAzp1bpsBq/2XpyJ73Tyey1pL7S5341yinz1ihCjxC7dcLEd1jSIyA6ZQL82dEgg8QvVNOiFKQcqQmvlIUvzmsBkm6LT56Ujsiqy1YTpUUO/LqyxyzohPNsrNNsUq7O0KdZkrVfqtMi6Yg9Y1WsYiVH0eqnWrkvYzxJSdCqwkprhEBWPNWLta8lQvnOAEwBLDMqm6l3mlyXxVzgEdmpR3vLlyCIXaTAtKuPNBGAJJaeWtU8gG1UagjNfFYU3ABd4ykKl9P+tMBab1Vw680mAjQVprK9WUOfvunhjwApz942miY9Yir2+RbT9tgCABEQeBX5f0jZN2Y6QG0lJrrdoWqJtlXC142nsdnUUqrnadPB+lKMlDjYfYyHWPe0URofyDvzGu7xUYbvewAFxvYqS6E4DnAQBijAECR9kMDdP1Nad4pAFYK7dun//3TUXjhgr0vKk2JWmnKpdzXslIU5b943dTuLb4XtpuOUG/QAt/vDFXZz7u1BziA51h7dNoqndmefo7GNokN9n189GiEBxm8IPUApmIRG2ZPwrdbX8OJF5d6Z5by6k2XL2Y7K1wwDfX26qJmhsoOdAaknAGAgcB0yo2MAAtysk8hJ/sUTry4FKYzbrxwwdvv9JGbypAQYcKRmnh8nurA56kOHKmJR0buAGTkDsDq0gjkGWWlCbL6XWnVqrdAkvO5P+0DI6Yzbsyf0W6UOVx2wr1/OuqCKMofUVazp9vVk0Wnq53Y/qm9mI5Q15L8dF6SNvqk23ij5jAQ5TCqc+55798Ir2ymMi7de+gSW1RzIDzIwAbnfrv1NTx87x5EWOcgMelJbPzn11h790SYTrmVZm0X9bBJ7wO0I2erE9KXEBmmU26svXsiNv7za+bsJSY9iRMvLoX9tBOzCkJ0vfq1Y3oeuamM5ZyyHv6avVeMNoVfI0Rm94Idcse0mI+kJQCw/VN7MYCTdJR5T7aqxyMM9h1QetjY6uxx824Qbu0/QuBonFcSgehwgqxdFtRZfQr/BABVLpjKZQj10iUP0SMCwRwgcACvPvd08C8PFLd6YCYtSI0fhoPna3BdiVGX1WQ0BjDKa+rEe2CW9mH/5+chhhuUm0A4XLHFXeKPgmIemCoJ1t49EQ/fuwei6GH5BQ5HG6Lj/gtmaR+qPqzHE3OVuidazKdd2pLoN/fbdHs84pwR/ap5drQ0ufT7H+7N3aD5ECPKjfifJRIMmvb5piCOO/WFB//7qu3vskxyVIz0KC9M6IVtltWL2PH+6ag/j5newnv5PTD1rx+YwMF0yoV5Vgv+9OKiDsug6aLUFKsrCiMg1kCAl71euEQDASX42QUOz3ywkXUYmX77b7Ho/jF4+N49rAHww/fuweLZyt+oI9MntmiPbVivPap98LThW0ptPXzvHsydvBr//cQWfBhFVLtU8fRpk17aOmh8ogtr756oyz4D9Hm0NLcWAKbf/luUNjlZ3izhAVS7MD5Rr/apCfP+6SgJaNmpYqPHE8l6A6i0RKWopNhxDEAKfEaoL5zagMxskzr+WinAc4YRtdeSd7J0R+vhe5Wbs3QBWOudk58U4N06txe0RsCZ70CoFUwtOhxtChDzqrEFwNzJ3ptKyfacbIUaeveUJgwqcT1qTtxjgPIcYFRMAtMZN277cQS2ZB7ThWBp8GHlsk+RtvrfeOePxSz5ZcxtR/HuW7lwjQjArGwTTDsUnnN8ogV/+tMin+7eHS+z2VsdSx02dlMvMcp8+6f2PFGUz/SE5O9NG1W5ZqWJgHisjOxQG1TIlE/TNqigjXaJBBZevP7BzSx5gwLI38FUl3UOHr53D17bWoZvt76GDbMnIVLg29luDkebwk1qiutGTXgaqdOTdJEhszkIr20tw9q7JyL5hHIeZpvJl9kC4KgUlWA65UbyCR5r756Id/5YrLveslOrYavbhbmTb4Ag8Phw3TnWPINqi7V3T0RgkRtp4yOw9u6JyMk+hde2lilpkZpAxsX221a3C0sWJioUXVKAaifTJBj9KHNNbF8+me0GgB0AxM42mOhreooBXhB4GcCNq5cPOrj6ty1wNHp4WopgCuKw6CEBmWGa+DstqTYoCSDzrGYdyDqz6IYvWZiIMbeNZml3NOFj5bJPIQg8vj7yGMuypyXLVFXS12sTRda8lctoLLZRsrd5W6/xJTynZNHTc0kyTMUKfbT27okdJrL84YFsjBjbDznZp3Tfs/zbd5hpQMuwfb9nZ/eVmkzt+F3ZOxcgo8mALS+Ivkko8pMvhZA167+ZIgh8rijKvTKMtLeUG1X/JSXFjiPONsLzAYLk26BCV6FKP9kDFgtPnZ7ULrf0YptJQ5sUpPRG+IJ056GjTLICwMpln+IPD2S3k+RmcxAevncPk9SmU24l9l7pau8FG+CfwrnYQWkfg8bTllRH6ZQbyccFrL17ImMqtPtAs8hWLvuURgaROj0JSxdsZ0kt02//re77UIAuWZioMxk6A9JBC5d0GIToqMGEWmnKlxQ7cgGU9pba71WgfvC00QCg4VgZ+azkkKddhWqHI9Q1YcvCOAfb7Ittqla6zJ18AwMpayqm3synNk5HaPQk9v+i/Fpk7qhCckosnto4HVtePYno6Cid00Bt14fv3YPqXWexYfYkZARYkHxcYKDtELyXOgxEeY/mHMkneGQEWHDixaUsCUZrs9vqdmHztvlInZ6E0OhJ7GFLTolFYV41HviVEobV/j91ehJrHf/wvXsw5rbReOBXozq1r1SS6kq4O0CJ7z0NtHByySEPjpWRTwE0qJjoFaAKvWVfzXrExQsCLxXmVeeU2wKdYxAQQA1r7Qj1zEp7+yiMFqxwYPO2+e2y531BSm1N39fRm0lzQOnraI1TckosU5lUyip9UX/Lck61avLhe/cA94J1btEOwjhQ7YT9lL6jCBsKQb1on6w2y0gTbh4fzEK/VL1rbUYKGMp40Aftzd2bsPO1xRg+bgPGJ3IYnxiHzB1VGHPbJmR/8BIrw6Zg1krWJZ8kInV6kq4nrO9yONqw/HcPsJwDvyBlY+MtCApz+Btl7izMa/pSEHjMesTFo1eqwHrPRgUAThB4AiBiQVrM3lf+1zOO4yDR2VSmIA4fvduMn+8w+29Ga/CGO4WPW3T2li9QqbdLOzL7s+UA4IFfjdLduMK8alSXvwdT8DRER0cxqUuTlzdsmoGTnxRgzG1K+bY/e1h7U6kk7ihxRru0NBBtRKE9lxasNKEaABbdPwZ/eCBb7Z+q2KHTb/8tivJrsSAtBtuyaiCKMitxOflJAZ7528Z2tio9x4ZNM3Rmkq80TRh0p5LAHWNUWgtJ7Skz0yk33kt3YOa8UNb3lOMgyW7RsHSN+WjmjqppgsA3iaLM9ZZE7dWVnBIrqNLrldoDwUQ+bxXtp6OJ/XQ0kc9bSf4bYcQ0NZxw9/Uj3H39CJb0I1gSQ/DrfgSzlb9lpMeR6vL3SGOjze/hcrlJckosEQSeqA8GyUiPY3/T/puRHkeSU2LJhk0ziCDwJDklljQ22siGTTOIuoEkOSWW/Ut/T19Hz+P7M/1/R0dXXkOP4uMr2XfPSI9j10e/A/2uGzbNaHf9dC+0+6bdAwDsNRnpcX4/nx7V5e+RDZtmENPUcILZYcq9WRJDsITesxhimhpO8t8II/J5K9HcX7H2QDARBH6TFgu9GsTrrUWbgYmi/HFurseNDkaok2pN7F8Tu/5262t4bWsZIqxzLmpLLbp/DKs1EgQemTuqdI4YlRavbS1D9gcv0WvCovvHwNm6F394IBuCwDO7ThB4LLp/DE5+UsDOrzUxtPmjWsnXEcWjlZT+lvb3ZnMQUqcnYfi4DcjcUYU3d2/CM3/byHoAZO6oQlF+LUaM7YfklFj84YFsLJ69jGmJRfePwVMbp+PrI48x29bb1yoJmTuqWC8BUZQZ49GRWUXt82+3vsbyImAg3qLHGifmWc0YNtmo7SJNR5m7RFH+UMXC1SdJtepf5c1CM9LjytQnTnYUeaXq2lXXeZ/UX/cjpqnhZMOmGR1KGn8StbHRxiShVrImp8SS4uMr20k1KqW00iojPU4nQavL39NJJpfLrZNcAJi0yUiPIxnpce0+y1eSaqUUPej7k1NimeT2lXr0dVqJT6WhIPAkbfUg9nffvXO53KT4+Eq/+0M1T2cOek4mXdX7hdlhZO2q65g0Ve+tLJ+3koz0uLMAgnuLO+3TpSYgIDklNrP2QLDsKIqW/al/+qW1G90VsFaXv9fuZtBjw6YZfk0BLRg3bJrB3l98fCW78VrVqFWrFMy+N5+ClYKDHhs2zWDXSM+jVen0s6kqp59Br4Fea3JKrO7h0l6zP1VPz9URSC+1v/7MlA2bZjDh4k/tO4qi5doDwXJySuybWgxc7YtTHau0Pc8H+j55RD5vVTZ7dhi7+RREF5NKnZWsWulKJaOvDVZ8fCVJWz1IdwMpmCjwtBKNHsXHV7YDF33QtK/X2pPanylw6fsoeOkDQCW1VnrT92ofAH8PYkcPbmdA6k9IaLVA8fGVzGbNSI/ze0/3PB9IBIGfxfIEvyNABYCIjPS4+oupf9PU8HZHckosU20UvBfbYK2UpAfdVGpW+N5U7Y31VbP03FpAaYFGgeB7fVrg+gJM6+hQIGolamOjjUlPf1KVPkAdaQqt82OaGq7bC3+Oob8Hnp4/Iz3O732h5/ej9omq9msBhPcBm9T7zhQ1rFXjvflYGdmtVqjK/ipUnUkB7Y7CcSKyjtmw5q1cDFq4BIueHY+yU6tZIwpfpyTCOgcL0mK8ztWUUFYd6kwK8FuqTN939OA5XbZQUX4tNm+bj9pv17PZT5QmonkGGzbNgCjK+MMD2e1oK1GUseXVk9jy6kkkp8SyyllRlJEw6E5s3jZf58xQ58jZuhcjxvZDYV41ivJrmRP15u5NeGrjdCxIi0G/Qat0nDF1mB741SgWi+dile8sTAnVOZD+eFNtYssDvxqF6x/cjJW7DyMzwuP3vjiTAi5aaXqsjOwC0Kzee/JdACpWLx/EA5CK8mt3qxWqhCZduOwEwyYblQpVWsWpPWBgG+5MCkDWMRuuf3Az7vx/wxnYtAcAdvOFKaFwDldTCdXs+YuVKtObt3TBdlSXv4efPT4QAPDEE1vYxBIKnLmTb8Cd/284AOhClv5WUX4tA/r4REW4jBjbD4tnL9MNGKbsxZu7N2HR/WMAAD97fCCbxDJ38g1YumC7LgdCGzrW9RWg7XwkwDk8kIFVC0ztoQU5O4d2ZoCfY4jdhOFTvEkoFK+5uR4U5dd+CEBW7z2+E0Bds/4bGgk6fqQmvkKNgMnaLCHaoILVDdFOz1Dj35oyDQpYCjZb3S4GNFvdLmx59SRMU8OVzQbR5BJcvFRZC/YI6xy888diLF2wHWNuG43klFgdtRUaPQkfrjuHLa+exJjbRqOjQQmULqIApA/RovvHIMI6B6HRk9q9d8urJ1kmFO23lZN9ym86Xodl2/AmjQAErhEBME0Nx5ZXT7bbryULE/Ug15R+s7IbXoMOI3QNJjTakVaanhdF+bgg8KzTdm8voY/sVDqcoqyk2PGf+jLHXdGJZklboUrbU/qtUOU19Jzaj4n0D4QzRsbK3Yex5q1cDLGbMORnJnyyrxGwKFWjLIrCtw/P+pYqb3k1CTtfW8zaB2lV48P37sHD9yqmxVMbp+PkJwUwBU9j6nmLRq3qNlPgGRerBaMg8Njy6kmc/CQRz/xtIzsP7h/DulT3G7QK9fX6a/EXrbpk2TbvVcuuEQEoLXJikFrpWmpxesO8SYHevNJO5N56R5nrKk2l+jIHX1Is/AfAOfWe9wl/2mfemSDwRlGUPYLA/+aDp40v0/5UFKjtKlQ7kVnPSp/hDbeyVDypC19ZreI0NSkBCBoy9SXz/RH8m7fNbxdm1YZ1tau6/D0Wq6fDgLM/eImFXLV9/bVqnX4mbbzR0cSUTi2DZr8MvCZlsXOpiPTedDDTVP7o3Wb+9sc8ywBsBmAURdnznQIqzVEVRXnM2lXXfbzi3ub+UGZTMbA++VII1uU0dGkQLTUgaKEgyxHt0jQC6EqVAWXK3JCfmfDK0md1sfiOQOv7M01a0SbHUEfNt136xeL8gNLT4IkntijN18IIoFYwdKtURrNfXd4rTWz/8dRIrP5tiza2LwPg//J6aMWa9d/cJgj8172Ve3o5VT9L/Zv1iOvk9k/tBcvvFvtrR6gDtHqxi71UNaqNmQfdaAbB7DpVIhfGiCg8ZsMnqpr0N26nozCow9GmG2zm+xrfdun+Qqra6da0LgzDjToVT3h077uy/ep+eY1yr0K1KX10lPkJAF+ro8z7rCair4lZg6qUV+S/EbZuzPQArvdGqPfyRvgxK0xNHAMtAEY3+WY/dWVRUGpTBks/dHrBSbOWgCtfbKhMZWdqP8RqYvdInWlKxt7TtBLAM5p7je+aRGWKRxD4ne+fjvrTmOktQVC6U3PaBhWsQtVz5W6Kt92Oeof683D2BwolESt3H4apicOat3KVfFJ1mK22nZCWdtIubfpfTkUJQgtd+DCKwH5a49ikBIL2vGfgRM+n9vX4zhkUb99PpSkBwL1/OqpNEFp2qhx2n1aY9XmoS236S5JTYr88+b402dlGCMcpU1RojuqsbJO3XPlqybnR2nZasFAnridLIzV1nveVBKYfDQMApNqFPdOdLPeUAlVt1nywMK/6ZnqP+/J6hMv1xYvya987mR0yecz0AGaQ0wrV5EwzCq1yL7TD6H2Gmc1IBdRiPIXmandjZTrqUqs6/aNOkZpacJKrBqA6LSMpTuaPf8L5jjLHyWw3V5Tf8N5lvh19aOb0b6Kk+YdKUwKNTahpUNEX0+t6dZdoMIKaCB7lX05WJCIhStUex/FKdAcGRVJKnPf16nt0js3VnGdU58L4RA7mcKO3TFpd75+O8tC+UvQef6eBqiG/vy0pdnzlshPO156h/alIn5EbfSxxvSmrrCeW9nd6sH8HFm2A1sTpKk0pLaXONP0KQFlXRplf7UAlDTs4HoDjWBnJKv7Sw9qoaxtUXFtX5/JtMBFo4SS10jQLgFO9t+T7AFSEpkmcIPCkMK865/3TUboSFUDpTj3Palb6hBqugeOKO1LqHNh5VjNCrLqe/wSA4f3TUa7CvOqDgsCTrowyv+qBqgHlyZJiR66j0cNTqao+pd9N9f99XD5qP9DiHWVuCuIkR6OHLyl2HAZQ4HNvvxdAldVBA03bsmpyzuQRvyrm2rpKpGnH94Q7k0ewLavmIIAm9Z7K3yegojCvGlJlGCeK8n/Kbc42KNQYq1ClDSq6Or7m2up9aUrVflCY4NtgwlBuc7aKoryPTti+zL7rZVmSygAc2Lo/8qxKHhNqpJvDjbru1NfWlVtU7WtpKY4DcbYRbN0feVYQ+BzXuRAOfRgyvZJAJYb+TQZRlJu3ZdUcaq13Aj6RMTYnqZszQa+tXlD7Hp97oflza70T27JqDoqi3GLo39RrfaWuNqCqygWcKMo7c3M9UqCF4+gT62wjGD7FqKh/OpzCcO24nAcdFTnPagaNIGpoKS431yOJorxTqyEv1xKuAFCRnBK7d+t+rnrmPDEemu7UgRZlhLopxwEnXNdE3BVS+8NSzQBafFkbbuv+yKrkFLJPtU3J9xmo1LFyArEf1Zc5lmhTx1x2gt/MrgXQ7xpiruD6zexauOyK6qcaTxllHvxhYV71FZEgV8Jz4QHIgsD/9IOnjR/5G6EeaLnmUF3J5bIT7ahIbcnJf4mi/Ak0ZYTfZ4lKZ6ge37o/slyr/unGaKsArq0r5Fhx7dT+OVGsylfv3WW/QcIV3Iu6Y2Xk4/oyx33RiWaPs40YVRrk2rpKlipNxfoyh/FYWfBHAOqv1LVciXweIv40xAClQQUdoc4Tj6ibyHftuAoOjwgAvNpgYi8ASb13PxCJuruJqv8jR2riy2aiJdEcbpTx3UmE+4EsowzAcKQm/qwofnNUEHiIu5uuiF12pVQ/Wb18EL9m/Tel2z+1HyopFhKhn5VybV0dSwLAHyuzfwXgG7XSVLoSF/L/AV3750zJ4KfMAAAAAElFTkSuQmCC';
        var PAGE_W = 595.28;

        // Jarak vertikal (pt) antara token ${ttd_pengirim} dan ${nama_pengirim} di
        // blok tanda tangan. Sengaja lega: di antaranya nanti ditempati gambar/QR
        // tanda tangan elektronik (TTE).
        var TTE_GAP = 50;

        // Teks tipologi yang dicetak. Dropdown menyimpan nama lengkapnya (mis.
        // "Masjid Jami", "Mushalla Perumahan / Pemukiman") -> dicetak apa adanya.
        // Data lama yang hanya berisi "Jami" diberi awalan "Masjid " (atau "Musala "
        // untuk Musala) supaya hasil cetaknya tetap rapi.
        function tipologiLabel(masjid, entitas) {
          var t = String(masjid.jenisTipologi || '').trim();
          if (!t) return '-';
          if (entitas === 'musola') {
            return /^(mushalla|musholla|musala|mushola|musola)\b/i.test(t) ? t : 'Musala ' + t;
          }
          return /^masjid\b/i.test(t) ? t : 'Masjid ' + t;
        }

        function sanitizeFilename(text) {
          return String(text || 'Dokumen').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 60);
        }

        function getQrDataUri(text) {
          if (!text || typeof qrcode === 'undefined') return null;
          try {
            var qr = qrcode(0, 'M');
            qr.addData(text);
            qr.make();
            return qr.createDataURL(6, 2);
          } catch (e) {
            return null;
          }
        }

        function drawKopSuratSurat(doc) {
          doc.addImage(LOGO_B64, 'PNG', 45, 24, 68, 66);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.setTextColor(0, 0, 0);
          doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', PAGE_W / 2, 37, { align: 'center' });
          doc.setFontSize(12);
          doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU', PAGE_W / 2, 50, { align: 'center' });
          doc.setFontSize(11);
          doc.text('PROVINSI JAWA BARAT', PAGE_W / 2, 63, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text('Jl. Olah Raga No. 03 Indramayu Tlp. (0234) 272033 & 272073 Fax (0234) 272073', PAGE_W / 2, 76, { align: 'center' });
          doc.text('Website: www.indramayu.kemenag.go.id   E-mail: kabindramayu@kemenag.go.id', PAGE_W / 2, 89, { align: 'center' });
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(1.4);
          doc.line(40, 98, 555, 98);
          doc.setLineWidth(0.6);
          doc.line(40, 101.5, 555, 101.5);
        }

        function drawLabelValue(doc, y, label, value, opts) {
          opts = opts || {};
          var labelX = opts.labelX || 135;
          var colonX = opts.colonX || 222;
          var valueX = opts.valueX || 230;
          var maxWidth = opts.maxWidth || 325;
          var lineHeight = opts.lineHeight || 14;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.text(label, labelX, y);
          doc.text(':', colonX, y);
          doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
          var lines = doc.splitTextToSize(String(value), maxWidth);
          lines.forEach(function (line, i) {
            doc.text(line, valueX, y + i * lineHeight);
          });
          return y + lines.length * lineHeight;
        }

        function drawTandaTangan(doc, y, urlProfil, opts) {
          opts = opts || {};
          var rightLimit = opts.rightLimit || 555;
          var colWidth = opts.colWidth || 205;
          var colX = rightLimit - colWidth;

          // Permintaan eksplisit: 4 elemen di blok tanda tangan ini (Nomor,
          // tanggal, tanda tangan, nama+NIP) DITULIS LITERAL sebagai token
          // "${...}" apa adanya di PDF -- bukan nilai asli.
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.text('Indramayu, ${tanggal_naskah}', colX, y);
          doc.text('Kepala Kantor Kementerian Agama', colX, y + 15);
          doc.text('Kabupaten Indramayu,', colX, y + 30);

          // Ruang tanda tangan -- token placeholder, bukan gambar/garis kosong.
          var ttdY = y + 30 + 50;
          doc.text('${ttd_pengirim}', colX, ttdY);

          // Nama + NIP digabung jadi satu token placeholder, dengan jarak lega
          // (TTE_GAP) dari token tanda tangan di atasnya.
          var nameY = ttdY + TTE_GAP;
          doc.text('${nama_pengirim}', colX, nameY);

          if (urlProfil) {
            var qr = getQrDataUri(urlProfil);
            if (qr) doc.addImage(qr, 'GIF', 85, y - 8, 72, 72);
          }

          return nameY + 15;
        }

        function buildSuratPdf(jenis, masjid, pengaturan) {
          // Catatan penamaan: "jenis" (parameter) = jenis DOKUMEN ('sk'/'rekom').
          // "entitas" (di bawah) = jenis OBJEK yang didata ('masjid'/'musola'),
          // diambil dari masjid.jenis. Dua hal yang berbeda, jangan tertukar.
          var entitas = masjid.jenis === 'musola' ? 'musola' : 'masjid';
          var labelEntitas = entitas === 'musola' ? 'Musala' : 'Masjid';

          var doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });

          drawKopSuratSurat(doc);

          var judul = jenis === 'sk' ? 'SURAT KETERANGAN' : 'SURAT REKOMENDASI';
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text(judul, PAGE_W / 2, 152, { align: 'center' });
          doc.setLineWidth(0.7);
          var judulWidth = doc.getTextWidth(judul);
          doc.line(PAGE_W / 2 - judulWidth / 2, 155, PAGE_W / 2 + judulWidth / 2, 155);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          // Permintaan eksplisit: ditulis literal "${nomor_naskah}", bukan nilai aslinya.
          doc.text('Nomor : ${nomor_naskah}', 280, 172);

          var y = 212;
          doc.text(jenis === 'sk' ? 'Yang bertanda tangan di bawah ini :' : 'Yang bertanda tangan dibawah ini :', 85, y);
          y += 30;

          y = drawLabelValue(doc, y, 'Nama', pengaturan.namaKepalaKantor || '-', { bold: true }) + 6;
          y = drawLabelValue(doc, y, 'NIP', pengaturan.nipKepalaKantor || '-') + 6;
          y = drawLabelValue(doc, y, 'Jabatan', 'Kepala Kantor Kementerian Agama Kabupaten Indramayu') + 22;

          doc.setFont('helvetica', 'normal');
          doc.text(
            jenis === 'sk'
              ? 'Menerangkan dengan sesungguhnya bahwa ' + labelEntitas + ' di bawah ini :'
              : 'Dengan ini memberikan rekomendasi kepada :',
            85, y
          );
          y += 30;

          // Musala (keduanya SK & Rekom) dan Rekom-nya Masjid memakai kata
          // "Desa"; SK-nya Masjid secara historis memakai "Ds/Kel." -- lihat
          // PANDUAN-INSTALASI.md kalau ini ternyata perlu diseragamkan juga.
          var kataDesa = (entitas === 'musola' || jenis !== 'sk') ? 'Desa' : 'Ds/Kel.';
          var kecKab = (masjid.kecamatan || '-') + ' Kabupaten Indramayu Jawa Barat';
          var alamatLengkap = (masjid.alamat || '-') + ' ' + kataDesa + ' ' + (masjid.desa || '-') + ' Kecamatan ' + kecKab;

          if (jenis === 'sk') {
            y = drawLabelValue(doc, y, 'Nama ' + labelEntitas, masjid.namaMasjid || '-', { bold: true }) + 6;
            y = drawLabelValue(doc, y, 'Tipologi', tipologiLabel(masjid, entitas)) + 6;
            y = drawLabelValue(doc, y, 'Alamat', alamatLengkap) + 22;

            doc.setFont('helvetica', 'normal');
            var sistemInfo = entitas === 'musola' ? 'Masjid/Musala' : 'Masjid';
            var konfirmasi =
              'Adalah benar telah terdaftar pada Sistem Informasi ' + sistemInfo + ' Kementerian Agama dengan Nomor Identitas ' +
              'Nasional ' + labelEntitas + ' : ' + (masjid.noIdNasional || '-') + '.';
            var kLines = doc.splitTextToSize(konfirmasi, 470);
            kLines.forEach(function (line, i) { doc.text(line, 85, y + i * 15); });
            y += kLines.length * 15 + 26;
          } else {
            y = drawLabelValue(doc, y, 'Nama ' + labelEntitas, masjid.namaMasjid || '-', { bold: true }) + 6;
            y = drawLabelValue(doc, y, 'Nomor ID', masjid.noIdNasional || '-') + 6;
            y = drawLabelValue(doc, y, 'Tipologi', tipologiLabel(masjid, entitas)) + 6;
            y = drawLabelValue(doc, y, 'Alamat', alamatLengkap) + 22;

            doc.setFont('helvetica', 'normal');
            var tujuan =
              'Untuk dapat mengajukan permohonan dan menerima bantuan dana dari Pemerintah Pusat / Pemerintah Daerah, ' +
              'dalam rangka meningkatkan kualitas sarana dan prasarana rumah ibadah bagi masyarakat muslim di sekitarnya.';
            var tLines = doc.splitTextToSize(tujuan, 470);
            tLines.forEach(function (line, i) { doc.text(line, 85, y + i * 15); });
            y += tLines.length * 15 + 14;
          }

          var penutup = jenis === 'sk'
            ? 'Demikian Surat Keterangan ini dibuat untuk dapat digunakan sebagaimana mestinya.'
            : 'Demikian Surat Rekomendasi ini dibuat untuk dapat digunakan sebagaimana mestinya.';
          doc.text(penutup, 85, y);
          y += 40;

          drawTandaTangan(doc, y, masjid.urlProfil);

          var prefix = jenis === 'sk' ? 'SuratKeterangan' : 'SuratRekomendasi';
          return { doc: doc, filename: prefix + '_' + sanitizeFilename(masjid.namaMasjid) + '.pdf' };
        }

        function buildPiagamPdf(masjid) {
          // "entitas" = jenis objek yang didata ('masjid'/'musola'), dari masjid.jenis.
          var entitas = masjid.jenis === 'musola' ? 'musola' : 'masjid';
          var labelEntitas = entitas === 'musola' ? 'Musala' : 'Masjid';

          var doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
          // Permintaan: tanpa bingkai/frame dekoratif -- hanya margin biasa.
          var SAFE_LEFT = 82, SAFE_RIGHT = 516;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          // Permintaan eksplisit: ditulis literal "${nomor_naskah}", bukan nilai aslinya.
          doc.text('Nomor : ${nomor_naskah}', SAFE_RIGHT - 40, 70, { align: 'right' });

          doc.addImage(LOGO_B64, 'PNG', 252.1, 40, 91, 88);

          var y = 152;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', PAGE_W / 2, y, { align: 'center' });
          y += 14;
          doc.setFontSize(12);
          doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU', PAGE_W / 2, y, { align: 'center' });
          y += 13;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text('Jalan Olah Raga No. 03 Telp. (0234) 272033 Indramayu', PAGE_W / 2, y, { align: 'center' });
          y += 12;
          doc.text('Email : kabindramayu@kemenag.go.id', PAGE_W / 2, y, { align: 'center' });
          y += 24;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(18);
          doc.text('PIAGAM', PAGE_W / 2, y, { align: 'center' });
          y += 20;
          doc.setFontSize(14);
          doc.text('IDENTITAS ' + labelEntitas.toUpperCase(), PAGE_W / 2, y, { align: 'center' });
          y += 26;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.5);
          // Redaksi mengikuti contoh PDF masing-masing: Masjid menyebut nomor
          // identitasnya langsung di kalimat; Musala memakai kalimat umum
          // "Nomor Identitas Masjid/Musala" (nomornya ada di butir 3).
          var dasar = entitas === 'musola'
            ? 'Berdasarkan KMA Nomor 394 Tahun 2004 tentang Penetapan Status Masjid Wilayah dan Keputusan Direktur ' +
              'Jenderal Bimbingan Masyarakat Islam Nomor: Dj.II/802 Tahun 2014 tentang Standar Pembinaan Manajemen ' +
              'Masjid dan Musala, dengan ini Kepala Kantor Kementerian Agama Kabupaten Indramayu memberikan Piagam ' +
              'dan Nomor Identitas Masjid/Musala kepada:'
            : 'Berdasarkan KMA Nomor 394 Tahun 2004 tentang Penetapan Status Masjid Wilayah dan Keputusan Direktur ' +
              'Jenderal Bimbingan Masyarakat Islam Nomor : Dj.II/802 Tahun 2014 tentang Standar Pembinaan Manajemen ' +
              'Masjid dan Musala, dengan ini Kepala Kantor Kementerian Agama Kabupaten Indramayu memberikan Piagam ' +
              'dan Nomor Identitas Nasional ' + (masjid.noIdNasional || '-') + ' kepada :';
          var dasarLines = doc.splitTextToSize(dasar, SAFE_RIGHT - SAFE_LEFT);
          dasarLines.forEach(function (line, i) { doc.text(line, SAFE_LEFT, y + i * 14); });
          y += dasarLines.length * 14 + 12;

          var numX = SAFE_LEFT, labelX = SAFE_LEFT + 20, colonX = 268, valueX = 276;
          var maxW = SAFE_RIGHT - valueX;
          var n = 1;

          // Butir bernomor; nilai yang panjang otomatis turun ke baris berikutnya.
          function itemRow(label, value, bold) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.text(n + '.', numX, y);
            doc.text(label, labelX, y);
            doc.text(':', colonX, y);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            var lines = doc.splitTextToSize(String(value), maxW);
            lines.forEach(function (line, i) { doc.text(line, valueX, y + i * 13); });
            y += Math.max(18, lines.length * 13 + 5);
            n++;
          }

          // Rincian di bawah butir "Alamat Lengkap" (bertanda "-", tanpa nomor).
          function subRow(label, value) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.text('-', labelX, y);
            doc.text(label, labelX + 14, y);
            doc.text(':', colonX, y);
            doc.text(String(value), valueX, y);
            y += 16;
          }

          itemRow('Nama ' + labelEntitas, masjid.namaMasjid || '-', true);
          itemRow('Jenis Tipologi', tipologiLabel(masjid, entitas), false);
          itemRow('Nomor Identitas Nasional', masjid.noIdNasional || '-', false);

          // Sama seperti contoh PDF (Masjid maupun Musala): alamat apa adanya,
          // lalu rincian Kelurahan/Desa, Kecamatan, dan Kabupaten.
          itemRow('Alamat Lengkap', masjid.alamat || '-', false);
          subRow('Kelurahan/Desa', masjid.desa || '-');
          subRow('Kecamatan', masjid.kecamatan || '-');
          subRow('Kabupaten', 'Indramayu');
          y += 2;

          itemRow('Tahun Berdiri', String(masjid.tahunBerdiri || '-'), false);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.5);
          doc.text(n + '.', numX, y);
          var lembagaLabelLines = doc.splitTextToSize('Lembaga/Organisasi/Masyarakat', colonX - labelX - 4);
          lembagaLabelLines.forEach(function (line, i) { doc.text(line, labelX, y + i * 13); });
          doc.text(':', colonX, y);
          var lembagaLines = doc.splitTextToSize(masjid.lembagaOrgMasyarakat || '-', maxW);
          lembagaLines.forEach(function (line, i) { doc.text(line, valueX, y + i * 13); });
          y += Math.max(lembagaLabelLines.length, lembagaLines.length) * 13 + 16;

          doc.setFontSize(10.5);
          doc.text('Demikian Piagam ini diberikan, agar dapat dipergunakan sebagaimana mestinya.', SAFE_LEFT, y);
          y += 36;

          drawTandaTangan(doc, y, masjid.urlProfil, { rightLimit: SAFE_RIGHT, colWidth: 185 });

          return { doc: doc, filename: 'Piagam_' + sanitizeFilename(masjid.namaMasjid) + '.pdf' };
        }

        /* BEGIN KiblatPdf */
        /* ===================================================================
         *  SERTIFIKAT / DATA VERIFIKASI / BERITA ACARA  -  ARAH KIBLAT
         *
         *  Tata letak diukur dari PDF contoh (ukuran huruf, posisi baris,
         *  kolom tabel). Permintaan eksplisit: TANPA bingkai/frame di semua
         *  PDF -- hanya garis tabel (Data Verifikasi) dan garis kop surat.
         *  Perhitungan (azimut, tabel matahari, Hijriah) ada di KiblatHitung.
         * =================================================================== */

        var PAGE_H = 841.89;
        // Ikon Ka'bah (dari berkas Excel contoh), PNG 192 warna.
        var KAABAH_ICON_B64 = 'data:image/png;base64,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';

        /* ---------- teks campuran: Helvetica + font Symbol untuk ′ ″ λ ----------
         * Helvetica standar PDF tidak punya tanda menit/detik busur (′ ″) maupun
         * huruf lambda (λ). Font Symbol bawaan PDF punya ketiganya, tetapi tabel
         * lebar huruf milik jsPDF untuk Symbol keliru, jadi lebarnya diberikan
         * manual di sini (dalam satuan em, dari metrik Adobe Symbol). */
        var SIMBOL_PDF = {
          '′': { kode: '¢', lebar: 0.247 }, // ′
          '″': { kode: '²', lebar: 0.411 }, // ″
          'λ': { kode: 'l', lebar: 0.549 } // λ
        };

        function potongSimbol(teks) {
          var hasil = [];
          var buf = '';
          for (var i = 0; i < teks.length; i++) {
            var ch = teks.charAt(i);
            var sim = SIMBOL_PDF[ch];
            if (sim) {
              if (buf) {
                hasil.push({ t: buf, s: false });
                buf = '';
              }
              hasil.push({ t: sim.kode, s: true, lebar: sim.lebar });
            } else {
              buf += ch;
            }
          }
          if (buf) hasil.push({ t: buf, s: false });
          return hasil;
        }

        // Lebar teks Helvetica TANPA kerning. doc.getTextWidth() jsPDF memakai tabel
        // kerning (mis. "Te", "Ta" lebih rapat 1-1,5 pt), padahal teks di PDF digambar
        // tanpa kerning; kalau dipakai apa adanya, kata yang diletakkan satu per satu
        // (rata kiri-kanan) jadi menempel ke kata berikutnya. Menjumlah per huruf
        // menghindari tabel kerning itu.
        function lebarHelv(doc, teks, ukuran, gaya) {
          doc.setFont('helvetica', gaya || 'normal');
          doc.setFontSize(ukuran);
          var total = 0;
          for (var i = 0; i < teks.length; i++) total += doc.getStringUnitWidth(teks.charAt(i));
          return total * ukuran;
        }

        function lebarCampur(doc, teks, ukuran, gaya) {
          var total = 0;
          potongSimbol(String(teks)).forEach(function (p) {
            total += p.s ? p.lebar * ukuran : lebarHelv(doc, p.t, ukuran, gaya);
          });
          return total;
        }

        // Menulis satu baris teks campuran; rata: 'left' (bawaan) | 'right' | 'center'.
        function tulisCampur(doc, teks, x, y, ukuran, gaya, rata) {
          teks = String(teks);
          var lebar = lebarCampur(doc, teks, ukuran, gaya);
          var cx = rata === 'right' ? x - lebar : rata === 'center' ? x - lebar / 2 : x;
          potongSimbol(teks).forEach(function (p) {
            if (p.s) {
              doc.setFont('symbol', 'normal');
              doc.setFontSize(ukuran);
              doc.text(p.t, cx, y);
              cx += p.lebar * ukuran;
            } else {
              doc.setFont('helvetica', gaya || 'normal');
              doc.setFontSize(ukuran);
              doc.text(p.t, cx, y);
              cx += lebarHelv(doc, p.t, ukuran, gaya);
            }
          });
          doc.setFont('helvetica', gaya || 'normal');
          doc.setFontSize(ukuran);
          return lebar;
        }

        // Memecah teks jadi baris-baris selebar-lebarnya 'lebarMaks'.
        function bungkusCampur(doc, teks, ukuran, gaya, lebarMaks) {
          var kata = String(teks).split(' ');
          var baris = [];
          var cur = '';
          kata.forEach(function (k) {
            var coba = cur ? cur + ' ' + k : k;
            if (cur && lebarCampur(doc, coba, ukuran, gaya) > lebarMaks) {
              baris.push(cur);
              cur = k;
            } else {
              cur = coba;
            }
          });
          if (cur) baris.push(cur);
          return baris;
        }

        // Rata kiri-kanan (justify): sisa lebar dibagi rata ke semua spasi.
        function tulisRata(doc, teks, x, y, ukuran, gaya, lebar) {
          var kata = String(teks).split(' ');
          var nSpasi = kata.length - 1;
          if (nSpasi < 1) {
            tulisCampur(doc, teks, x, y, ukuran, gaya);
            return;
          }
          doc.setFont('helvetica', gaya || 'normal');
          doc.setFontSize(ukuran);
          var lebarSpasi = lebarHelv(doc, ' ', ukuran, gaya);
          var totalKata = 0;
          kata.forEach(function (k) {
            totalKata += lebarCampur(doc, k, ukuran, gaya);
          });
          var tambah = (lebar - totalKata - nSpasi * lebarSpasi) / nSpasi;
          if (tambah < 0) tambah = 0;
          var cx = x;
          kata.forEach(function (k) {
            if (k) tulisCampur(doc, k, cx, y, ukuran, gaya);
            cx += lebarCampur(doc, k, ukuran, gaya) + lebarSpasi + tambah;
          });
        }

        // Paragraf rata kiri-kanan; baris terakhir rata kiri kecuali 'rataAkhir'.
        // Mengembalikan y baris berikutnya.
        function tulisParagraf(doc, baris, x, y, ukuran, gaya, lebar, jarak, rataAkhir) {
          baris.forEach(function (b, i) {
            var terakhir = i === baris.length - 1;
            if (terakhir && !rataAkhir) tulisCampur(doc, b, x, y, ukuran, gaya);
            else tulisRata(doc, b, x, y, ukuran, gaya, lebar);
            y += jarak;
          });
          return y;
        }

        /* ---------- dokumen jsPDF: baru, atau halaman tambahan pada PDF yang sudah ada ---------- */

        // Mengembalikan jsPDF A4 (baru, atau 'docLuar' bila halaman ini ditambahkan ke PDF
        // gabungan) dengan keadaan gambar yang bersih supaya halaman tidak mewarisi
        // font/garis/warna dari halaman sebelumnya.
        function bukaDokumenKiblat(docLuar) {
          var doc = docLuar || new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
          doc.setTextColor(0, 0, 0);
          doc.setDrawColor(0, 0, 0);
          doc.setFillColor(0, 0, 0);
          doc.setLineWidth(0.2);
          doc.setLineDashPattern([], 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          return doc;
        }

        /* ---------- data & teks bersama ---------- */

        function hitungKiblatAtauGalat(rek) {
          var h = KiblatHitung.hitungRekaman(rek, 12);
          if (!h.ok) throw new Error(h.pesan);
          return h;
        }

        function labelEntitasKiblat(rek) {
          return rek.jenis === 'musola' ? 'Musala' : 'Masjid';
        }

        function singkatanHemisfer(hem) {
          return { S: 'LS', U: 'LU', T: 'BT', B: 'BB' }[String(hem).toUpperCase()] || String(hem);
        }

        function namaHemisfer(hem) {
          return { S: 'Lintang Selatan', U: 'Lintang Utara', T: 'Bujur Timur', B: 'Bujur Barat' }[String(hem).toUpperCase()] || '';
        }

        // "6° 20′ 29.72″" dari field derajat/menit/detik tersimpan.
        function teksKoordinatKiblat(rek, jenis) {
          var d = jenis === 'lintang' ? rek.lintangDerajat : rek.bujurDerajat;
          var m = jenis === 'lintang' ? rek.lintangMenit : rek.bujurMenit;
          var s = jenis === 'lintang' ? rek.lintangDetik : rek.bujurDetik;
          return KiblatHitung.teksKoordinatSertifikat(+d, +m, +s);
        }

        // "6°20'29.72\"" (ASCII, tanpa spasi) untuk halaman Data Verifikasi.
        function teksKoordinatAscii(rek, jenis) {
          var d = jenis === 'lintang' ? rek.lintangDerajat : rek.bujurDerajat;
          var m = jenis === 'lintang' ? rek.lintangMenit : rek.bujurMenit;
          var s = jenis === 'lintang' ? rek.lintangDetik : rek.bujurDetik;
          return KiblatHitung.teksDms({ d: +d, m: +m, s: +s }, false);
        }

        function teksBarisAzimut(h) {
          var b = h.kiblat.bDms;
          return '360 - ' + KiblatHitung.teksKoordinatSertifikat(b.d, b.m, b.s) + ' = ' + KiblatHitung.teksDmsSertifikat(h.kiblat.azimutDms);
        }

        function kopTengah(doc, yLogo, tinggiLogo, b1, b2, b3, b4) {
          var lebarLogo = tinggiLogo * 1.039;
          doc.addImage(LOGO_B64, 'PNG', PAGE_W / 2 - lebarLogo / 2, yLogo, lebarLogo, tinggiLogo);
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', PAGE_W / 2, b1, { align: 'center' });
          doc.setFontSize(12);
          doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU', PAGE_W / 2, b2, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11.4);
          doc.text('Jalan Olah Raga No. 03 Telp. (0234) 272033 Indramayu', PAGE_W / 2, b3, { align: 'center' });
          doc.text('Email : seksibimasislamindramayu@gmail.com', PAGE_W / 2, b4, { align: 'center' });
        }

        /* =================================================================
         *  1. SERTIFIKAT KALIBRASI ARAH KIBLAT
         * ================================================================= */

        var SERT_PARAGRAF_1 = [
          'Berdasarkan KMA Nomor 373 Tahun 2002 tentang Organisasi dan Tata Kerja',
          'Kantor Wilayah Departemen Agama Provinsi dan Kabupaten/Kota yang telah',
          'diubah dengan KMA RI Nomor 480 Tahun 2003 tentang Standar Pelayanan',
          'Penetapan Arah Kiblat, dan UU Nomor 3 Tahun 2006 Tentang Perluasan',
          'Kompetensi Peradilan Agama, yang secara Keilmuan menjadi Kewenangan Dirjen',
          'Bimas Islam Kementerian Agama Republik Indonesia.  Dengan ini Kepala Kantor',
          'Kementerian Agama Kabupaten Indramayu memberikan Sertifikat Kalibrasi Arah'
        ];

        function buildSertifikatKiblatPdf(rek, docLuar) {
          var h = hitungKiblatAtauGalat(rek);
          var label = labelEntitasKiblat(rek);
          var doc = bukaDokumenKiblat(docLuar);

          var UK = 11.4;
          var KIRI = 88, KANAN = 507.5, LEBAR = KANAN - KIRI;
          var NUM_X = 87.6, LABEL_X = 105.2, COLON_X = 242.9, NILAI_X = 254.2;
          var LEBAR_NILAI = KANAN - NILAI_X;

          // Isi yang panjangnya berubah-ubah (alamat, paragraf tanggal) dibungkus dulu
          // supaya tinggi total diketahui sebelum menggambar.
          var alamatBaris = bungkusCampur(doc, rek.alamat || '-', UK, 'normal', LEBAR_NILAI);
          var penyBaris = bungkusCampur(doc, rek.penyelenggaraPendiri || '-', UK, 'normal', LEBAR_NILAI);
          var namaBaris = bungkusCampur(doc, rek.namaMasjid || '-', UK, 'bold', LEBAR_NILAI);
          var p2Teks =
            'Telah dilakukan Kalibrasi Arah Kiblat secara hakiki oleh Kantor Kementerian Agama Kabupaten Indramayu pada Tanggal ' +
            h.tanggalPanjang + ' M. /' + h.hijriTeks + '. Pukul ' + h.jamTeks +
            ' WIB. Adapun Hasil Perhitungan Rumus Kalibrasi Arah Kiblat sebagaimana terlampir.';
          var p2Baris = bungkusCampur(doc, p2Teks, UK, 'normal', LEBAR);
          var p3Baris = [
            'Demikian Sertifikat Kalibrasi Arah Kiblat ini diberikan, agar dapat diketahui dan',
            'dipergunakan sebagaimana mestinya.'
          ];

          var P1_JARAK = 16.85, BARIS_JARAK = 16, P2_JARAK = 17, P3_JARAK = 18.1;
          // Baris butir: Nama (n baris), Alamat (n baris) + 3 sub-baris, Lintang, Bujur, Azimut, Penyelenggara (n baris)
          var jumlahBarisButir = namaBaris.length + alamatBaris.length + 3 + 1 + 1 + 1 + penyBaris.length;

          // Baris pertama paragraf 1 pada PDF contoh berada di 252,85 pt. Paragraf 1
          // sekarang 8 baris (kalimat dilengkapi "Kiblat kepada :"); butir-butirnya
          // tetap berada di tempat yang sama dengan contoh.
          var YP1_AWAL = 252.85;
          // Baseline ${nama_pengirim} paling bawah: sisakan >= 42 pt dari tepi bawah.
          var BATAS_NAMA = PAGE_H - 42;

          // Menyusun posisi vertikal pada skala jarak 's' (1 = persis contoh).
          // TTE_GAP (jarak ${ttd_pengirim} -> ${nama_pengirim}) tidak ikut diskalakan.
          function susun(s, yAwal) {
            var p = { s: s, p1: P1_JARAK * s, bj: BARIS_JARAK * s, p2: P2_JARAK * s, p3: P3_JARAK * s };
            p.yP1 = yAwal;
            p.yButir = p.yP1 + p.p1 * 7 + 19.7 * s;
            p.yP2 = p.yButir + (jumlahBarisButir - 1) * p.bj + 18.7 * s;
            p.yP3 = p.yP2 + (p2Baris.length - 1) * p.p2 + 19.0 * s;
            p.yTgl = p.yP3 + p.p3 + 18.5 * s;
            p.yKepala = p.yTgl + 18 * s;
            p.yTtd = p.yKepala + 50 * s;
            p.yNama = p.yTtd + TTE_GAP;
            return p;
          }
          var pos = susun(1, YP1_AWAL);
          if (pos.yNama > BATAS_NAMA) {
            // Isi lebih panjang dari contoh: rapatkan jarak antarbaris dulu (paling
            // banyak 18%), kalau masih kurang geser seluruh halaman ke atas.
            var lentur = pos.yNama - YP1_AWAL - TTE_GAP;
            var skala = Math.max(0.82, (lentur - (pos.yNama - BATAS_NAMA)) / lentur);
            pos = susun(skala, YP1_AWAL);
            if (pos.yNama > BATAS_NAMA) pos = susun(skala, YP1_AWAL - (pos.yNama - BATAS_NAMA));
          }
          var yP1 = pos.yP1;

          // --- Nomor (kanan atas) + kop ---
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          // Permintaan eksplisit: ditulis literal "${nomor_naskah}", bukan nilai aslinya.
          doc.text('Nomor: ${nomor_naskah}', 483.3, 74.4, { align: 'right' });

          kopTengah(doc, yP1 - 196.2, 68, yP1 - 112.2, yP1 - 95.5, yP1 - 81.1, yP1 - 65.0);

          doc.setFont('times', 'bold');
          doc.setFontSize(26);
          doc.text('Sertifikat', PAGE_W / 2, yP1 - 38.7, { align: 'center' });
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text('Kalibrasi Arah Kiblat', PAGE_W / 2, yP1 - 19.3, { align: 'center' });

          // --- Paragraf 1 (rata kiri-kanan) ---
          var y = yP1;
          SERT_PARAGRAF_1.forEach(function (b) {
            tulisRata(doc, b, KIRI, y, UK, 'normal', LEBAR);
            y += pos.p1;
          });
          tulisCampur(doc, 'Kiblat kepada :', KIRI, y, UK, 'normal');

          // --- Butir 1..6 ---
          y = pos.yButir;
          function butir(nomor, labelTeks, nilaiBaris, tebal) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(UK);
            if (nomor) tulisCampur(doc, nomor + '.', NUM_X, y, UK, 'normal');
            tulisCampur(doc, labelTeks, LABEL_X, y, UK, 'normal');
            tulisCampur(doc, ':', COLON_X, y, UK, 'normal');
            nilaiBaris.forEach(function (b, i) {
              tulisCampur(doc, b, NILAI_X, y + i * pos.bj, UK, tebal ? 'bold' : 'normal');
            });
            y += nilaiBaris.length * pos.bj;
          }
          butir(1, 'Nama ' + label, namaBaris, true);
          butir(2, 'Alamat Lengkap', alamatBaris, false);
          butir(null, 'Kelurahan/Desa', [rek.desa || '-'], false);
          butir(null, 'Kecamatan', [rek.kecamatan || '-'], false);
          butir(null, 'Kabupaten', ['Indramayu'], false);
          butir(3, 'Lintang Tempat (Ø)', [teksKoordinatKiblat(rek, 'lintang') + ' ' + singkatanHemisfer(rek.lintangHemisfer)], false);
          butir(4, 'Bujur Tempat (λ)', [teksKoordinatKiblat(rek, 'bujur') + ' ' + singkatanHemisfer(rek.bujurHemisfer)], false);
          butir(5, 'Azimut Kiblat', [teksBarisAzimut(h)], false);
          butir(6, 'Penyelenggara/Pendiri', penyBaris, false);

          // --- Paragraf 2 (tanggal, Hijriah, jam) & 3 ---
          tulisParagraf(doc, p2Baris, KIRI, pos.yP2, UK, 'normal', LEBAR, pos.p2, false);
          tulisParagraf(doc, p3Baris, KIRI, pos.yP3, UK, 'normal', LEBAR, pos.p3, false);

          // --- Tanda tangan: 4 token DITULIS LITERAL (permintaan eksplisit) ---
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(UK);
          doc.text('Indramayu, ${tanggal_naskah}', 356, pos.yTgl);
          doc.text('Kepala,', 356, pos.yKepala);
          doc.text('${ttd_pengirim}', 385, pos.yTtd);
          doc.text('${nama_pengirim}', 356, pos.yNama);

          return { doc: doc, filename: 'SertifikatKiblat_' + sanitizeFilename(rek.namaMasjid) + '.pdf' };
        }

        /* =================================================================
         *  2. DATA VERIFIKASI ARAH KIBLAT (perhitungan + tabel matahari + kompas)
         * ================================================================= */

        // Busur lingkaran sebagai garis patah-patah halus (1 titik per 'langkah' derajat).
        // Sudut berupa azimut (utara = 0, searah jarum jam); arah +1 = searah jarum jam.
        function titikBusur(cx, cy, r, azMulai, azAkhir, arah) {
          var titik = [];
          var total = arah > 0 ? ((azAkhir - azMulai) % 360 + 360) % 360 : ((azMulai - azAkhir) % 360 + 360) % 360;
          var n = Math.max(2, Math.ceil(total / 1));
          for (var i = 0; i <= n; i++) {
            var az = (azMulai + arah * total * i / n) * Math.PI / 180;
            titik.push([cx + r * Math.sin(az), cy - r * Math.cos(az)]);
          }
          return titik;
        }

        function garisTitik(doc, titik, gaya) {
          var rel = [];
          for (var i = 1; i < titik.length; i++) {
            rel.push([titik[i][0] - titik[i - 1][0], titik[i][1] - titik[i - 1][1]]);
          }
          doc.lines(rel, titik[0][0], titik[0][1], [1, 1], gaya || 'S', false);
        }

        // Segitiga panah dengan ujung di (x, y) menghadap arah (dx, dy).
        function kepalaPanah(doc, x, y, dx, dy, panjang, lebar) {
          var n = Math.sqrt(dx * dx + dy * dy) || 1;
          var ux = dx / n, uy = dy / n;
          var bx = x - ux * panjang, by = y - uy * panjang;
          doc.triangle(x, y, bx - uy * lebar, by + ux * lebar, bx + uy * lebar, by - ux * lebar, 'F');
        }

        function gambarKompas(doc, cx, cy, h, rek) {
          var az = h.kiblat.azimut; // derajat, 270..360
          var azRad = az * Math.PI / 180;
          var R = 94, RING = 102;

          doc.setLineDashPattern([], 0);
          doc.setDrawColor(0, 0, 0);
          doc.setFillColor(0, 0, 0);
          doc.setTextColor(0, 0, 0);

          // Lingkaran utama
          doc.setLineWidth(1.5);
          doc.circle(cx, cy, R, 'S');

          // Sumbu U-S dan B-T (garis titik-strip tipis)
          doc.setLineWidth(0.7);
          doc.setLineDashPattern([11, 2.5, 1.2, 2.5], 0);
          doc.line(cx - R, cy, cx + R, cy);
          doc.line(cx, cy - R, cx, cy + R);

          // Garis arah kiblat & garis shaf (tegak lurus), titik-strip tebal
          doc.setLineWidth(2.4);
          doc.setLineDashPattern([15, 4, 4, 4], 0);
          var tipLen = 122;
          var qx = cx + tipLen * Math.sin(azRad), qy = cy - tipLen * Math.cos(azRad);
          doc.line(cx, cy, qx, qy);
          var sx = Math.sin(azRad + Math.PI / 2), sy = -Math.cos(azRad + Math.PI / 2);
          doc.line(cx - sx * 110, cy - sy * 110, cx + sx * 110, cy + sy * 110);
          doc.setLineDashPattern([], 0);

          // Kepala panah hitam di ujung garis kiblat
          kepalaPanah(doc, qx, qy, qx - cx, qy - cy, 10, 4.2);

          // Busur merah: dari Utara searah jarum jam sampai arah kiblat (= azimut)
          doc.setLineWidth(0.9);
          doc.setDrawColor(255, 0, 0);
          doc.setLineDashPattern([3.2, 2.6], 0);
          garisTitik(doc, titikBusur(cx, cy, RING, 0, az, 1), 'S');
          // Busur hijau: dari arah kiblat searah jarum jam kembali ke Utara (= 360 - azimut = B)
          doc.setDrawColor(0, 176, 80);
          garisTitik(doc, titikBusur(cx, cy, RING, az, 360, 1), 'S');
          doc.setLineDashPattern([], 0);

          // Kepala panah: merah (tiba di arah kiblat dari selatan-barat), hijau (dari utara)
          var ex = cx + RING * Math.sin(azRad), ey = cy - RING * Math.cos(azRad);
          doc.setFillColor(255, 0, 0);
          kepalaPanah(doc, ex, ey, Math.cos(azRad), Math.sin(azRad), 8, 3.2);
          doc.setFillColor(0, 176, 80);
          kepalaPanah(doc, ex, ey, -Math.cos(azRad), -Math.sin(azRad), 8, 3.2);

          // Belah ketupat hijau (bergaris merah) di titik Utara
          doc.setFillColor(0, 176, 80);
          doc.setDrawColor(255, 0, 0);
          doc.setLineWidth(0.8);
          doc.lines([[4.5, 4.5], [-4.5, 4.5], [-4.5, -4.5], [4.5, -4.5]], cx, cy - RING - 4.5, [1, 1], 'FD', true);

          // Titik pusat
          doc.setFillColor(0, 0, 0);
          doc.setDrawColor(0, 0, 0);
          doc.circle(cx, cy, 3.6, 'F');

          // Label arah
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11.5);
          doc.setTextColor(0, 0, 0);
          doc.text('U', cx, cy - 83.6, { align: 'center' });
          doc.text('360°', cx, cy - 69.8, { align: 'center' });
          doc.text('S', cx, cy + 77.2, { align: 'center' });
          doc.text('180°', cx, cy + 91, { align: 'center' });
          doc.text('B 270°', cx - R + 4, cy + 8.6);
          doc.text('T 90°', cx + R - 4, cy - 2.4, { align: 'right' });

          // "SHOF" sejajar garis shaf
          var sudutShof = Math.atan2(-sy, sx) * 180 / Math.PI; // sudut berlawanan jarum jam
          if (sudutShof > 90) sudutShof -= 180;
          if (sudutShof < -90) sudutShof += 180;
          var rad = sudutShof * Math.PI / 180;
          doc.text('SHOF', cx + 4 * Math.sin(rad) + 3 * Math.cos(rad), cy + 4 * Math.cos(rad) - 3 * Math.sin(rad) + 6, { angle: sudutShof });

          // Ikon Ka'bah dekat ujung panah
          doc.addImage(KAABAH_ICON_B64, 'PNG', qx - 38, qy - 27, 32, 32);

          // Label sudut (tebal)
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(h.kiblat.teksAzimut, 60.5, 588);
          doc.text(h.kiblat.teksB, cx - 76, cy - 94 - 4, { align: 'center' });
          doc.text(h.kiblat.teksSudutQ, cx - RING - 6, cy + 3.5, { align: 'right' });
          doc.setFont('helvetica', 'normal');
        }

        function buildDataVerifikasiPdf(rek, pengaturan, docLuar) {
          pengaturan = pengaturan || {};
          var h = hitungKiblatAtauGalat(rek);
          var label = labelEntitasKiblat(rek);
          var doc = bukaDokumenKiblat(docLuar);
          doc.setTextColor(0, 0, 0);

          // --- Kop (logo kiri, teks di tengah kanan) + garis ganda ---
          doc.addImage(LOGO_B64, 'PNG', 55.5, 24.2, 71.7, 69);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14.5);
          doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 361.6, 40.8, { align: 'center' });
          doc.setFontSize(12.4);
          doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN INDRAMAYU', 361.6, 58.8, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11.5);
          doc.text('Jalan Olah Raga No. 03 Telp. (0234) 272033 Indramayu', 361.6, 75.9, { align: 'center' });
          doc.text('Email : seksibimasislamindramayu@gmail.com', 361.6, 90.8, { align: 'center' });
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(2.9);
          doc.line(55.75, 102.25, 560.5, 102.25);
          doc.setLineWidth(0.9);
          doc.line(55.75, 104.85, 560.5, 104.85);

          // --- Judul ---
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.7);
          doc.text('DATA VERIFIKASI ARAH KIBLAT', 308.6, 139.8, { align: 'center' });

          // --- Data masjid & hasil ---
          var UK = 10.5;
          var LABEL_X = 40.3, COLON_X = 113.6, NILAI_X = 121.2, HEM_X = 204.2;
          var LEBAR_ISI = 574.5 - NILAI_X;
          var alamatLengkap = (rek.alamat || '-') + ' Desa/Kel. ' + (rek.desa || '-') + ' Kecamatan ' + (rek.kecamatan || '-') + ' Kabupaten Indramayu';
          var namaBaris = bungkusCampur(doc, rek.namaMasjid || '-', UK, 'bold', LEBAR_ISI);
          var alamatBaris = bungkusCampur(doc, alamatLengkap, UK, 'normal', LEBAR_ISI);
          // Jarak antarbaris 16 pt seperti contoh. Kalau nama/alamat lebih panjang dari
          // contoh (1 + 2 baris) jaraknya dirapatkan supaya baris "Azimut Q." tetap
          // berada di atas tabel (baseline <= 305 pt).
          var jarak = Math.min(16, (305 - 169) / (namaBaris.length + alamatBaris.length + 6 - 1));
          var y = 169;
          function barisData(labelTeks, nilai, tebal, hem) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(UK);
            doc.text(labelTeks, LABEL_X, y);
            doc.text(':', COLON_X, y);
            doc.setFont('helvetica', tebal ? 'bold' : 'normal');
            doc.text(nilai, NILAI_X, y);
            if (hem) {
              doc.setFont('helvetica', 'normal');
              doc.text(hem, HEM_X, y);
            }
          }
          // Nama (tebal; membungkus kalau panjang)
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(UK);
          doc.text('Nama ' + label, LABEL_X, y);
          doc.text(':', COLON_X, y);
          namaBaris.forEach(function (b, i) { tulisCampur(doc, b, NILAI_X, y + i * jarak, UK, 'bold'); });
          y += namaBaris.length * jarak;
          // Alamat: kalimat lengkap, rata kiri-kanan, baris lanjutan sejajar nilai.
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(UK);
          doc.text('Alamat', LABEL_X, y);
          doc.text(':', COLON_X, y);
          y = tulisParagraf(doc, alamatBaris, NILAI_X, y, UK, 'normal', LEBAR_ISI, jarak, false); // y = baris berikutnya

          var yLintang = y;
          barisData('Lintang', teksKoordinatAscii(rek, 'lintang'), false, singkatanHemisfer(rek.lintangHemisfer));
          y += jarak;
          barisData('Bujur', teksKoordinatAscii(rek, 'bujur'), false, singkatanHemisfer(rek.bujurHemisfer));
          // Metode & peralatan (kolom kanan, sejajar baris Lintang dan Bujur)
          function barisKanan(yy, labelTeks, nilai) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(UK);
            doc.text(labelTeks, 317.2, yy);
            var cx = 317.2 + lebarHelv(doc, labelTeks + ' ', UK, 'normal');
            doc.text(':', cx, yy);
            doc.text(nilai, 381.9, yy);
          }
          barisKanan(yLintang, 'Metode', 'Sinar Matahari & Spherical Trigonometry');
          barisKanan(yLintang + jarak, 'Peralatan', 'Mizwala, Kompas, GPS & Laptop');
          y += jarak;
          barisData('Hari / Tgl', h.tanggalPendek, false);
          y += jarak;
          barisData('Waktu', h.jamTeksDetik, false, 'WIB');
          y += jarak;
          barisData('Sudut Q.', h.kiblat.teksSudutQ, true, 'BU');
          y += jarak;
          barisData('Azimut Q.', h.kiblat.teksAzimut, true, 'UTSB');

          // --- Tabel REKAP DATA MATAHARI (garis tabel dipertahankan) ---
          var kolX = [37.75, 118.75, 201.5, 277.5, 314.5, 379.5, 442.5, 508.5, 578.5];
          var yTabel = 317.4, tJudul = 16, tHeader = 16.1, tBaris = 16;
          var yHeader = yTabel + tJudul, yData = yHeader + tHeader;
          var yBawah = yData + tBaris * h.tabel.length;
          var lebarTabel = kolX[kolX.length - 1] - kolX[0];

          doc.setFillColor(146, 208, 80);
          doc.rect(kolX[0], yTabel, lebarTabel, tJudul, 'F');
          doc.setFillColor(252, 213, 180);
          doc.rect(kolX[0], yHeader, lebarTabel, tHeader, 'F');
          doc.setFillColor(242, 242, 242);
          doc.rect(kolX[5], yData, kolX[7] - kolX[5], tBaris * h.tabel.length, 'F');

          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.8);
          // garis horizontal
          var ys = [yTabel, yHeader, yData];
          for (var r = 1; r <= h.tabel.length; r++) ys.push(yData + r * tBaris);
          ys.forEach(function (yy) { doc.line(kolX[0], yy, kolX[kolX.length - 1], yy); });
          // garis vertikal (judul tidak dibelah kolom)
          kolX.forEach(function (xx, i) {
            doc.line(xx, yHeader, xx, yBawah);
            if (i === 0 || i === kolX.length - 1) doc.line(xx, yTabel, xx, yHeader);
          });
          // bingkai luar tabel sedikit lebih tebal
          doc.setLineWidth(1.5);
          doc.line(kolX[0], yTabel, kolX[kolX.length - 1], yTabel);
          doc.line(kolX[0], yBawah, kolX[kolX.length - 1], yBawah);
          doc.line(kolX[0], yTabel, kolX[0], yBawah);
          doc.line(kolX[kolX.length - 1], yTabel, kolX[kolX.length - 1], yBawah);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          tulisCampur(doc, 'REKAP DATA MATAHARI', (kolX[0] + kolX[kolX.length - 1]) / 2, yTabel + 11.5, 10.5, 'bold', 'center');
          var judulKolom = ['Jam', 'RA', 'Deklinasi', 'EoT', "Irtifa'", 'Azimut', 'Mizwah', 'Sel. AQ-A'];
          judulKolom.forEach(function (t, i) {
            tulisCampur(doc, t, (kolX[i] + kolX[i + 1]) / 2, yHeader + 11.5, 10.5, 'bold', 'center');
          });
          doc.setFont('helvetica', 'normal');
          h.tabel.forEach(function (b, i) {
            var yy = yData + i * tBaris + 11.3;
            var sel = [b.jam, b.ra, b.dekl, b.eot, b.irtifa, b.azimut, b.mizwah, b.selisih];
            sel.forEach(function (t, k) {
              tulisCampur(doc, String(t), (kolX[k] + kolX[k + 1]) / 2, yy, 10.5, 'normal', 'center');
            });
          });

          // --- Kompas ---
          gambarKompas(doc, 230, 680.15, h, rek);

          // --- Petugas ukur (tanpa kotak): judul, gambar tanda tangan, nama, keterangan ---
          var cx = 478.9;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10.5);
          doc.text('Petugas Ukur,', cx, 633.3, { align: 'center' });
          var ttd = String(pengaturan.ttdPetugasUkur || '');
          if (/^data:image\/(png|jpeg);base64,/.test(ttd)) {
            try {
              var fmt = /^data:image\/png/.test(ttd) ? 'PNG' : 'JPEG';
              var props = doc.getImageProperties(ttd);
              var maxW = 130, maxH = 52;
              var skala = Math.min(maxW / props.width, maxH / props.height);
              var w = props.width * skala, hh = props.height * skala;
              doc.addImage(ttd, fmt, cx - w / 2, 637 + (maxH - hh) / 2, w, hh);
            } catch (e) {
              /* gambar tanda tangan rusak -> dilewati; PDF tetap dibuat */
            }
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.6);
          doc.text(pengaturan.petugasUkur ? String(pengaturan.petugasUkur) : '...............................', cx, 696.5, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.6);
          doc.text('(KEMASJIDAN DAN HISAB RUKYAT SEKSI', cx, 714, { align: 'center' });
          doc.text('BIMAS ISLAM KANKEMENAG INDRAMAYU)', cx, 726.5, { align: 'center' });

          return { doc: doc, filename: 'DataVerifikasiKiblat_' + sanitizeFilename(rek.namaMasjid) + '.pdf' };
        }

        /* =================================================================
         *  3. BERITA ACARA KALIBRASI ARAH KIBLAT
         * ================================================================= */

        function buildBeritaAcaraKiblatPdf(rek, pengaturan, docLuar) {
          pengaturan = pengaturan || {};
          var h = hitungKiblatAtauGalat(rek);
          var label = labelEntitasKiblat(rek);
          var doc = bukaDokumenKiblat(docLuar);

          var UK = 12;
          var KIRI = 60, KANAN = 552.8, LEBAR = KANAN - KIRI, TENGAH = 306.6;
          var NILAI_X = 192.8, COLON_X = 180.4, TEKS_X = 77.7;
          var JARAK0 = 18;
          doc.setTextColor(0, 0, 0);

          var t = h.tanggal;
          var pembuka =
            'Pada Hari ini ' + h.hari + ' Tanggal ' + KiblatHitung.pad2(t.d) + ' Bulan ' + KiblatHitung.NAMA_BULAN[t.m - 1] +
            ' Tahun ' + t.y + ' Telah dilaksanakan kalibrasi arah kiblat :';
          var pembukaBaris = bungkusCampur(doc, pembuka, UK, 'normal', LEBAR);
          var namaBaris = bungkusCampur(doc, rek.namaMasjid || '-', UK, 'bold', KANAN - NILAI_X);
          var alamatLengkap = (rek.alamat || '-') + ' Desa/Kel. ' + (rek.desa || '-') + ' Kecamatan ' + (rek.kecamatan || '-') + ' Kabupaten Indramayu';
          var alamatBaris = bungkusCampur(doc, alamatLengkap, UK, 'normal', KANAN - NILAI_X);

          // Posisi vertikal pada skala jarak 's' (1 = persis PDF contoh: jarak baris 18 pt).
          // Contoh berisi nama 1 baris + alamat 2 baris; kalau lebih panjang, jarak
          // dirapatkan (paling banyak 20%) supaya baris NIP tetap di dalam halaman.
          var Y_NAMA = 281.8, Y_NIP_MAKS = 822;
          function susun(s) {
            var J = JARAK0 * s;
            var p = { s: s, J: J, yNama: Y_NAMA };
            p.yAlamat = p.yNama + namaBaris.length * J;
            p.yHasil = p.yAlamat + alamatBaris.length * J;
            p.yK1 = p.yHasil + (JARAK0 + 3.6) * s;
            p.yK2 = p.yK1 + J;
            p.yA1 = p.yK2 + J;
            p.yA2 = p.yA1 + J;
            p.yAlat = p.yA2 + (JARAK0 + 6) * s;
            p.yAlat1 = p.yAlat + J;
            p.yPenutup = p.yAlat1 + 4 * J + 5 * s;
            p.yTempat = p.yPenutup + 2 * J + 10 * s;
            p.yPetugas = p.yTempat + (JARAK0 + 1) * s;
            p.yNama1 = p.yPetugas + 22 * s;
            p.yNama2 = p.yNama1 + 51.7 * s;
            p.yM = p.yNama2 + 36 * s;
            p.yNm = p.yM + 2 * J + 54 * s;
            p.yNip = p.yNm + 17.2 * s;
            return p;
          }
          var pos = susun(1);
          if (pos.yNip > Y_NIP_MAKS) {
            var lentur = pos.yNip - Y_NAMA;
            pos = susun(Math.max(0.8, (lentur - (pos.yNip - Y_NIP_MAKS)) / lentur));
          }
          var J = pos.J, sk = pos.s;

          kopTengah(doc, 19.8, 64.5, 100.0, 117.8, 132.2, 149.2);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text('BERITA ACARA', PAGE_W / 2, 193.8, { align: 'center' });
          doc.text('KALIBRASI ARAH KIBLAT', PAGE_W / 2, 210.8, { align: 'center' });

          // Pembuka (rata kiri-kanan)
          tulisParagraf(doc, pembukaBaris, KIRI, 238.8, UK, 'normal', LEBAR, JARAK0, false);

          // Nama & alamat
          tulisCampur(doc, 'Nama ' + label, KIRI, pos.yNama, UK, 'normal');
          tulisCampur(doc, ':', COLON_X, pos.yNama, UK, 'normal');
          namaBaris.forEach(function (b, i) { tulisCampur(doc, b, NILAI_X, pos.yNama + i * J, UK, 'bold'); });
          tulisCampur(doc, 'Alamat', KIRI, pos.yAlamat, UK, 'normal');
          tulisCampur(doc, ':', COLON_X, pos.yAlamat, UK, 'normal');
          tulisParagraf(doc, alamatBaris, NILAI_X, pos.yAlamat, UK, 'normal', KANAN - NILAI_X, J, false);

          // Hasil
          tulisCampur(doc, 'Dengan hasil sebagai berikut :', KIRI, pos.yHasil, UK, 'normal');
          var lintangTeks = teksKoordinatKiblat(rek, 'lintang') + ' ' + singkatanHemisfer(rek.lintangHemisfer);
          var bujurTeks = teksKoordinatKiblat(rek, 'bujur') + ' ' + singkatanHemisfer(rek.bujurHemisfer);
          tulisCampur(doc, '1.', KIRI, pos.yK1, UK, 'normal');
          tulisCampur(doc, 'Diketahui bahwa letak tempat tersebut berada pada koordinat ' + lintangTeks, TEKS_X, pos.yK1, UK, 'normal');
          tulisCampur(doc, '(' + namaHemisfer(rek.lintangHemisfer) + ') dan ' + bujurTeks + ' (' + namaHemisfer(rek.bujurHemisfer) + ').', TEKS_X, pos.yK2, UK, 'normal');
          tulisCampur(doc, '2.', KIRI, pos.yA1, UK, 'normal');
          tulisCampur(doc, 'Azimuth / sudut arah kiblat ' + teksBarisAzimut(h), TEKS_X, pos.yA1, UK, 'normal');
          tulisCampur(doc, 'ditarik dari titik Barat ke Utara.', TEKS_X, pos.yA2, UK, 'normal');

          // Alat
          tulisCampur(doc, 'Alat yang dipergunakan :', KIRI, pos.yAlat, UK, 'normal');
          ['Kompas', 'Pedoman menentukan arah kiblat', "Rubu' / Mizwala", 'GPS & Laptop'].forEach(function (alat, i) {
            tulisCampur(doc, (i + 1) + '.', KIRI, pos.yAlat1 + i * J, UK, 'normal');
            tulisCampur(doc, alat, TEKS_X, pos.yAlat1 + i * J, UK, 'normal');
          });

          // Penutup
          tulisParagraf(doc, [
            'Demikian Berita Acara Kalibrasi Arah Kiblat ini dibuat, agar dapat diketahui dan',
            'dipergunakan sebagaimana mestinya.'
          ], KIRI, pos.yPenutup, UK, 'normal', LEBAR, J, false);

          // Tempat, tanggal
          tulisCampur(doc, 'Indramayu, ' + h.tanggalPanjang, KANAN, pos.yTempat, UK, 'normal', 'right');

          // Petugas & saksi (garis titik-titik untuk tanda tangan)
          tulisCampur(doc, 'Petugas :', KIRI - 0.3, pos.yPetugas, UK, 'normal');
          tulisCampur(doc, 'Saksi-saksi :', 298.3, pos.yPetugas, UK, 'normal');
          var petugas = String(rek.petugas || '').trim();
          var saksi1 = String(rek.saksi1 || '').trim();
          var saksi2 = String(rek.saksi2 || '').trim();
          function garisTitikTitik(x1, x2, yy) {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(1);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(x1, yy, x2, yy);
            doc.setLineDashPattern([], 0);
          }
          // Nama petugas/saksi yang panjang dikecilkan sedikit agar tidak menabrak kolom sebelah.
          function namaTtd(teks, x, yy, maksLebar) {
            var uk = UK;
            while (uk > 8 && lebarCampur(doc, teks, uk, 'normal') > maksLebar) uk -= 0.5;
            tulisCampur(doc, teks, x, yy, uk, 'normal');
            doc.setFontSize(UK);
          }
          if (petugas) namaTtd(petugas, KIRI - 0.3, pos.yNama1, 128);
          garisTitikTitik(190.2, 295.2, pos.yNama1 + 4.8 * sk);
          tulisCampur(doc, '1.', 298.5, pos.yNama1, UK, 'normal');
          if (saksi1) namaTtd(saksi1, 312, pos.yNama1, 132);
          garisTitikTitik(446, 555.2, pos.yNama1 + 4.8 * sk);
          tulisCampur(doc, '2.', 298.5, pos.yNama2, UK, 'normal');
          if (saksi2) namaTtd(saksi2, 312, pos.yNama2, 132);
          garisTitikTitik(446, 555.2, pos.yNama2 + 5.1 * sk);

          // Mengetahui
          tulisCampur(doc, 'Mengetahui :', TENGAH, pos.yM, UK, 'normal', 'center');
          tulisCampur(doc, 'Kepala Seksi Bimbingan Masyarakat Islam', TENGAH, pos.yM + J, UK, 'normal', 'center');
          tulisCampur(doc, 'Kabupaten Indramayu', TENGAH, pos.yM + 2 * J, UK, 'normal', 'center');
          tulisCampur(doc, pengaturan.namaKasiBimas ? String(pengaturan.namaKasiBimas) : '...............................', TENGAH, pos.yNm, UK, 'bold', 'center');
          tulisCampur(doc, 'NIP. ' + (pengaturan.nipKasiBimas ? String(pengaturan.nipKasiBimas) : '...............................'), TENGAH, pos.yNip, UK, 'normal', 'center');

          return { doc: doc, filename: 'BeritaAcaraKiblat_' + sanitizeFilename(rek.namaMasjid) + '.pdf' };
        }

        /* =================================================================
         *  4. PAKET: beberapa dokumen dalam SATU PDF (halaman berurutan)
         *     daftar: urutan dari 'sertifikat' | 'verifikasi' | 'ba'
         *     (bawaan: Sertifikat + Data Verifikasi sebagai lampirannya)
         * ================================================================= */

        function buildPaketKiblatPdf(rek, pengaturan, daftar) {
          pengaturan = pengaturan || {};
          daftar = daftar && daftar.length ? daftar : ['sertifikat', 'verifikasi'];
          var doc = new jspdf.jsPDF({ unit: 'pt', format: 'a4' });
          daftar.forEach(function (jenis, i) {
            if (i > 0) doc.addPage();
            if (jenis === 'sertifikat') buildSertifikatKiblatPdf(rek, doc);
            else if (jenis === 'verifikasi') buildDataVerifikasiPdf(rek, pengaturan, doc);
            else if (jenis === 'ba') buildBeritaAcaraKiblatPdf(rek, pengaturan, doc);
            else throw new Error('Jenis dokumen tidak dikenal: ' + jenis);
          });
          var awalan = daftar.length > 2 ? 'PaketKiblat_' : 'SertifikatDanVerifikasiKiblat_';
          return { doc: doc, filename: awalan + sanitizeFilename(rek.namaMasjid) + '.pdf' };
        }
/* END KiblatPdf */

        return {
          buildPiagamPdf: buildPiagamPdf,
          buildSuratPdf: buildSuratPdf,
          buildSertifikatKiblatPdf: buildSertifikatKiblatPdf,
          buildDataVerifikasiPdf: buildDataVerifikasiPdf,
          buildBeritaAcaraKiblatPdf: buildBeritaAcaraKiblatPdf,
          buildPaketKiblatPdf: buildPaketKiblatPdf
        };
      })();
      }
