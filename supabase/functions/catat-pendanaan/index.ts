// Supabase Edge Function: catat-pendanaan
// Dipanggil RencoPay setelah nasabah berhasil mendanai program. Menulis ke
// pendanaan_proyek (dibaca Aren Jariyah) dan pendanaan_pembayar (data pribadi, tertutup).
// Deploy:  supabase functions deploy catat-pendanaan
// SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY otomatis tersedia di Edge Function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "metode tidak didukung" }, 405);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "JSON tidak valid" }, 400); }

  const no_bukti = String(b.no_bukti ?? "");
  const kode_usulan = String(b.kode_usulan ?? "").toUpperCase();
  const jumlah = Number(b.jumlah);
  const nama = b.nama_pembayar == null ? null : String(b.nama_pembayar).slice(0, 100);

  if (!/^[A-Za-z0-9_-]{6,64}$/.test(no_bukti)) return json({ error: "no_bukti tidak valid" }, 400);
  if (!/^(AK|PR)-\d{2,}$/.test(kode_usulan)) return json({ error: "kode_usulan tidak valid" }, 400);
  if (!Number.isInteger(jumlah) || jumlah < 1000 || jumlah > 1_000_000_000) return json({ error: "jumlah tidak valid" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let id: string | undefined;
  const ins = await db.from("pendanaan_proyek")
    .insert({ no_bukti, kode_usulan, jumlah }).select("id").single();
  if (ins.error) {
    if (ins.error.code !== "23505") return json({ error: "gagal menyimpan" }, 500);
    // no_bukti sudah ada: kiriman ulang, bukan catatan baru
    const ex = await db.from("pendanaan_proyek").select("id").eq("no_bukti", no_bukti).single();
    if (ex.error) return json({ error: "gagal menyimpan" }, 500);
    id = ex.data.id;
  } else id = ins.data.id;

  if (nama) {
    const p = await db.from("pendanaan_pembayar").upsert({ pendanaan_id: id, nama_pembayar: nama });
    if (p.error) return json({ error: "gagal menyimpan pembayar" }, 500);
  }
  return json({ ok: true, duplikat: !!ins.error });
});
