// Envia as notificações no celular (Web Push).
// POST {id}: envia o aviso "id" da tabela notificacoes (uma vez só) para os aparelhos inscritos.
// GET: devolve a chave pública que o site usa para inscrever o aparelho.
// As chaves de envio são geradas aqui na primeira vez e guardadas em push_chaves (só o servidor lê).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function chaves() {
  let { data } = await db.from("push_chaves").select("publica, privada").eq("id", 1).maybeSingle();
  if (!data) {
    const k = webpush.generateVAPIDKeys();
    await db.from("push_chaves").upsert({ id: 1, publica: k.publicKey, privada: k.privateKey }, { onConflict: "id", ignoreDuplicates: true });
    ({ data } = await db.from("push_chaves").select("publica, privada").eq("id", 1).single());
  }
  return data!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const k = await chaves();
    if (req.method === "GET") return json({ chave: k.publica });
    const { id } = await req.json().catch(() => ({}));
    if (!id) return json({ erro: "id" }, 400);
    // Marca como enviada antes de enviar: o mesmo aviso nunca sai duas vezes.
    const { data: n } = await db.from("notificacoes").update({ enviada_em: new Date().toISOString() })
      .eq("id", id).is("enviada_em", null).select().maybeSingle();
    if (!n) return json({ ok: true, ja: true });
    const { data: subs } = await db.from("push_inscricoes").select("endpoint, p256dh, auth").in("usuario", n.para);
    webpush.setVapidDetails("mailto:familiaalcancar@gmail.com", k.publica, k.privada);
    const corpo = JSON.stringify({ titulo: n.titulo, corpo: n.corpo, url: n.url, tag: n.tipo + (n.tipo === "chat" ? "" : "-" + n.id) });
    let ok = 0, falhas = 0;
    const mortos: string[] = [];
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, corpo, { TTL: 86400, urgency: "high" });
        ok++;
      } catch (e) {
        falhas++;
        const st = (e as { statusCode?: number }).statusCode;
        if (st === 404 || st === 410) mortos.push(s.endpoint);
      }
    }));
    if (mortos.length) await db.from("push_inscricoes").delete().in("endpoint", mortos);
    await db.from("notificacoes").update({ resultado: { ok, falhas, removidos: mortos.length } }).eq("id", id);
    return json({ ok, falhas });
  } catch (e) {
    console.error(e);
    return json({ erro: String(e) }, 500);
  }
});
