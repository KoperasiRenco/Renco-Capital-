// Edge Function: catat-partisipasi
// Deploy:  supabase functions deploy catat-partisipasi
// Secret opsional:  supabase secrets set PESERTA_SALT="isi-acak-panjang"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "json" }, 400); }

  const jenis = b?.jenis, no = String(b?.no_bukti ?? ""), jml = Math.round(Number(b?.jumlah));
  if (jenis !== "aset" && jenis !== "abadi") return json({ error: "jenis" }, 422);
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(no)) return json({ error: "no_bukti" }, 422);
  if (!Number.isFinite(jml) || jml < 1 || jml > 10_000_000_000) return json({ error: "jumlah" }, 422);

  const nama = b?.nama_pembayar ? String(b.nama_pembayar).slice(0, 80) : null;
  const kk = b?.kk_id ? String(b.kk_id).slice(0, 80) : null;
  const hash = kk ? await sha256((Deno.env.get("PESERTA_SALT") ?? "") + kk) : null;

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Nomor bukti ganda diabaikan (aman dikirim ulang).
  const { error } = await sb.from("partisipasi_renco").upsert(
    { no_bukti: no, jenis, peserta_hash: hash, jumlah: jml, nama_pembayar: nama, status: "berhasil" },
    { onConflict: "no_bukti", ignoreDuplicates: true },
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
