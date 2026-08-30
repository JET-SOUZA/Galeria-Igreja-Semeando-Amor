'use client';

import { FormEvent, useEffect, useState } from 'react';
import { KEY, SB, readSession } from '../../../../lib/sb';

export default function WhatsAppIntegration() {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [version, setVersion] = useState('v23.0');
  const [template, setTemplate] = useState('semeando_alerta_operacional');
  const [lang, setLang] = useState('pt_BR');
  const [testPhone, setTestPhone] = useState('');

  async function token() {
    const s = readSession();
    if (!s?.access_token) {
      location.href = '/acesso';
      throw new Error('Sessão expirada.');
    }
    return s.access_token;
  }

  async function load() {
    setBusy(true);
    setMsg('');
    try {
      const t = await token();
      const r = await fetch(`${SB}/functions/v1/meta-whatsapp-admin`, {
        headers: { apikey: KEY, Authorization: `Bearer ${t}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao carregar integração.');
      setData(d);
      setEnabled(Boolean(d.gateway?.enabled));
      setPhoneId(d.gateway?.settings?.phone_number_id || '');
      setWabaId(d.gateway?.settings?.waba_id || '');
      setVersion(d.gateway?.settings?.graph_version || 'v23.0');
      setTemplate(d.gateway?.settings?.template_name || 'semeando_alerta_operacional');
      setLang(d.gateway?.settings?.template_language || 'pt_BR');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const t = await token();
      const r = await fetch(`${SB}/functions/v1/meta-whatsapp-admin`, {
        method: 'PATCH',
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          settings: {
            phone_number_id: phoneId,
            waba_id: wabaId,
            graph_version: version,
            template_name: template,
            template_language: lang,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao salvar.');
      setMsg(
        d.configured
          ? 'Integração salva e pronta para uso.'
          : 'Configuração salva. Ainda falta o token secreto ou o Phone Number ID.'
      );
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg('');
    try {
      const t = await token();
      const r = await fetch(`${SB}/functions/v1/meta-whatsapp-admin`, {
        method: 'POST',
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'test', to: testPhone }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha no teste.');
      setMsg(d.message_id ? `Mensagem de teste aceita pela Meta • ${d.message_id}.` : 'Mensagem de teste aceita pela Meta.');
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  const secretOk = Boolean(data?.secrets?.access_token_configured);
  const verifyOk = Boolean(data?.secrets?.verify_token_configured);
  const ready = secretOk && Boolean(phoneId) && enabled;
  const webhookUrl = data?.webhook_url || `${SB}/functions/v1/meta-whatsapp-webhook`;

  return (
    <main className="wa-page">
      <section className="shell">
        <div className="top">
          <div>
            <span>INTEGRAÇÕES</span>
            <h1>WhatsApp • Meta Cloud API</h1>
            <p>Configure o canal oficial usado pelos alertas automáticos da plataforma.</p>
          </div>
          <a href="/developer">← Developer</a>
        </div>

        {msg && <div className="notice">{msg}</div>}

        <div className="status-grid">
          <article className={secretOk ? 'ok' : 'warn'}><small>Access Token</small><b>{secretOk ? 'Configurado' : 'Pendente'}</b><span>Secret do ambiente</span></article>
          <article className={verifyOk ? 'ok' : 'warn'}><small>Verify Token</small><b>{verifyOk ? 'Configurado' : 'Pendente'}</b><span>Validação do webhook</span></article>
          <article className={phoneId ? 'ok' : 'warn'}><small>Phone Number ID</small><b>{phoneId ? 'Informado' : 'Pendente'}</b><span>Número conectado à Meta</span></article>
          <article className={ready ? 'ok' : 'warn'}><small>Gateway</small><b>{ready ? 'ATIVO' : 'INATIVO'}</b><span>{data?.gateway?.last_test_status ? `Último teste: ${data.gateway.last_test_status}` : 'Sem teste ainda'}</span></article>
        </div>

        <form className="card" onSubmit={save}>
          <div className="card-title">
            <div><span>CONFIGURAÇÃO NÃO SENSÍVEL</span><h2>Conta do WhatsApp Business</h2></div>
            <label className="switch"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Ativar gateway</label>
          </div>
          <div className="two">
            <label>Phone Number ID<input value={phoneId} onChange={(e) => setPhoneId(e.target.value)} placeholder="Ex.: 123456789..." /></label>
            <label>WhatsApp Business Account ID<input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WABA ID" /></label>
          </div>
          <div className="two">
            <label>Versão Graph API<input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v23.0" /></label>
            <label>Idioma do template<input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="pt_BR" /></label>
          </div>
          <label>Template operacional<input value={template} onChange={(e) => setTemplate(e.target.value)} /></label>
          <p className="hint">O template aprovado na Meta deve possuir dois parâmetros no corpo: <b>{'{{1}}'}</b> para o título e <b>{'{{2}}'}</b> para a mensagem.</p>
          <button disabled={busy}>{busy ? 'Salvando...' : 'Salvar configuração'}</button>
        </form>

        <section className="card">
          <span>WEBHOOK META</span>
          <h2>Status de entrega</h2>
          <label>Callback URL<input readOnly value={webhookUrl} /></label>
          <p className="hint">Cadastre esta URL no painel da Meta e assine os eventos de mensagens. O Verify Token deve ser o mesmo secret configurado no Supabase.</p>
        </section>

        <section className="card">
          <span>TESTE REAL</span>
          <h2>Enviar template de teste</h2>
          <div className="test"><input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="5522999999999" /><button type="button" disabled={busy || !secretOk || !phoneId} onClick={test}>Enviar teste</button></div>
          {data?.gateway?.last_error && <div className="error">Último erro: {data.gateway.last_error}</div>}
        </section>

        <section className="secret">
          <b>Secrets necessários no Supabase</b>
          <code>META_WHATSAPP_ACCESS_TOKEN</code>
          <code>META_WHATSAPP_VERIFY_TOKEN</code>
          <p>Esses valores não são gravados nesta tela, no GitHub nem em tabelas públicas.</p>
        </section>
      </section>

      <style jsx>{`
        .wa-page{min-height:100vh;background:#090b0e;color:#f6f7f9;padding:94px 18px 60px;font-family:system-ui,-apple-system,sans-serif}
        .shell{width:min(980px,100%);margin:auto;display:grid;gap:16px}
        .top{display:flex;justify-content:space-between;gap:20px;align-items:end}
        .top span,.card>span,.card-title span{font-size:10px;letter-spacing:.16em;color:#ff944d;font-weight:950}
        .top h1{font-size:38px;margin:6px 0}.top p,.hint,.secret p{color:#9da5af}
        .top a{color:#fff;background:#1d2229;text-decoration:none;padding:11px 13px;border-radius:11px;font-weight:850}
        .status-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .status-grid article{background:#12161b;border:1px solid #323943;border-radius:17px;padding:15px;display:grid;gap:4px}
        .status-grid article.ok{border-color:#295c40}.status-grid article.warn{border-color:#704126}
        .status-grid small,.status-grid span{color:#929aa5;font-size:10px}.status-grid b{font-size:17px}
        .card{background:#12161b;border:1px solid #303740;border-radius:21px;padding:21px;display:grid;gap:16px}
        .card-title{display:flex;justify-content:space-between;align-items:center;gap:15px}.card h2{margin:5px 0}
        .card label{display:grid;gap:7px;font-size:12px;font-weight:850}.card input{background:#090c10;border:1px solid #373e48;color:#fff;border-radius:12px;padding:14px}
        .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.switch{display:flex!important;align-items:center;gap:8px!important}.switch input{width:auto}
        .card button{background:#ff7417;border:0;color:#fff;border-radius:12px;padding:13px 16px;font-weight:950}.hint{font-size:11px;margin:0}
        .test{display:grid;grid-template-columns:1fr auto;gap:9px}.error,.notice{padding:12px 14px;border-radius:12px;background:#291710;border:1px solid #713619;color:#ffc9a5}
        .secret{background:#0d1116;border:1px dashed #414954;border-radius:18px;padding:18px;display:grid;gap:8px}.secret code{background:#171c22;padding:10px 12px;border-radius:9px;color:#7ed5a5}
        @media(max-width:760px){.wa-page{padding-top:88px}.top{display:grid}.top h1{font-size:30px}.status-grid,.two{grid-template-columns:1fr 1fr}.card-title{display:grid}.test{grid-template-columns:1fr}}
        @media(max-width:480px){.status-grid,.two,.test{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}
