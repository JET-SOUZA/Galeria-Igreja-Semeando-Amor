export const dynamic='force-dynamic';

const C={bg:'#070708',panel:'#121318',orange:'#ff7417',white:'#f7f7f8',muted:'#a7adb7',green:'#76dfa8',border:'#343b45'};

function esc(s:string){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function base(step:string,title:string,sub:string,body:string){
 return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
 <rect width="720" height="1280" fill="${C.bg}"/>
 <text x="38" y="58" fill="${C.orange}" font-family="Arial" font-size="20" font-weight="800" letter-spacing="2">${esc(step)}</text>
 <text x="38" y="112" fill="${C.white}" font-family="Arial" font-size="42" font-weight="900">${esc(title)}</text>
 <text x="38" y="150" fill="${C.muted}" font-family="Arial" font-size="20">${esc(sub)}</text>
 <rect x="55" y="190" width="610" height="1010" rx="36" fill="#090b0e" stroke="#464b55" stroke-width="4"/>
 <rect x="75" y="210" width="570" height="60" rx="20" fill="#11141a"/>
 <text x="105" y="248" fill="#fff" font-family="Arial" font-size="19" font-weight="700">semeando-memorias.vercel.app</text>
 ${body}
 <text x="38" y="1246" fill="#69707a" font-family="Arial" font-size="16">Legacy Semeando Memórias • Fotos que contam histórias</text>
 </svg>`;
}
function btn(x:number,y:number,w:number,label:string,primary=true){return `<rect x="${x}" y="${y}" width="${w}" height="58" rx="16" fill="${primary?C.orange:'#292f38'}"/><text x="${x+w/2}" y="${y+37}" text-anchor="middle" fill="${primary?'#111':'#fff'}" font-family="Arial" font-size="20" font-weight="900">${esc(label)}</text>`}
function photo(x:number,y:number,w:number,h:number,selected=false,label='+ Carrinho'){return `<defs><linearGradient id="g${x}${y}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c7b6a0"/><stop offset=".45" stop-color="#684b36"/><stop offset="1" stop-color="#1f2937"/></linearGradient></defs><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20" fill="url(#g${x}${y})" stroke="${selected?C.orange:'#39414b'}" stroke-width="${selected?6:2}"/><circle cx="${x+w*.38}" cy="${y+h*.42}" r="${w*.13}" fill="#d6b18f"/><circle cx="${x+w*.62}" cy="${y+h*.42}" r="${w*.13}" fill="#c08a67"/><rect x="${x+w*.23}" y="${y+h*.58}" width="${w*.54}" height="${h*.26}" rx="18" fill="#111827"/><rect x="${x+w-122}" y="${y+10}" width="110" height="34" rx="17" fill="${selected?C.orange:'#0b0d10'}"/><text x="${x+w-67}" y="${y+33}" text-anchor="middle" fill="${selected?'#111':'#fff'}" font-family="Arial" font-size="13" font-weight="900">${esc(selected?'✓ Selecionada':label)}</text>`}

function scene(id:number){
 if(id===0)return base('TUTORIAL','Como comprar e baixar suas fotos','Versão paga • passo a passo',`
  <text x="110" y="400" fill="#fff" font-family="Arial" font-size="52" font-weight="900">Comprar</text>
  <text x="110" y="468" fill="${C.orange}" font-family="Arial" font-size="58" font-weight="900">baixar suas fotos</text>
  <text x="110" y="530" fill="${C.muted}" font-family="Arial" font-size="24">do início ao download</text>
  <rect x="110" y="650" width="500" height="210" rx="28" fill="#14171c" stroke="#343b45"/>
  <text x="145" y="710" fill="#fff" font-family="Arial" font-size="22" font-weight="800">Entrar  →  Encontrar  →  Selecionar</text>
  <text x="145" y="765" fill="#fff" font-family="Arial" font-size="22" font-weight="800">Conferir  →  Pagar  →  Baixar</text>
  <circle cx="570" cy="1010" r="52" fill="${C.orange}"/><text x="570" y="1024" text-anchor="middle" fill="#111" font-family="Arial" font-size="34" font-weight="900">▶</text>`);
 if(id===1)return base('PASSO 1','Abra o link do evento','Recebido pelo WhatsApp',`
  <rect x="105" y="350" width="510" height="250" rx="26" fill="#102019" stroke="#2b7e50" stroke-width="3"/>
  <text x="135" y="412" fill="#fff" font-family="Arial" font-size="32" font-weight="900">Congresso 2026</text>
  <text x="135" y="458" fill="#d8e5dc" font-family="Arial" font-size="20">Suas fotos já estão disponíveis.</text>
  ${btn(135,510,450,'Ver fotos do evento',false)}
  <text x="115" y="690" fill="${C.green}" font-family="Arial" font-size="22" font-weight="700">✓ Não precisa instalar aplicativo</text>`);
 if(id===2)return base('PASSO 2','Entre ou faça seu cadastro','Primeiro acesso ou Já sou cadastrado',`
  ${btn(110,335,235,'Primeiro acesso',true)}${btn(365,335,235,'Já sou cadastrado',false)}
  <text x="115" y="455" fill="#fff" font-family="Arial" font-size="18" font-weight="800">CPF</text><rect x="110" y="475" width="490" height="62" rx="13" fill="#080a0d" stroke="#454b55"/><text x="132" y="514" fill="#737985" font-family="Arial" font-size="19">000.000.000-00</text>
  <text x="115" y="585" fill="#fff" font-family="Arial" font-size="18" font-weight="800">Data de nascimento</text><rect x="110" y="605" width="490" height="62" rx="13" fill="#080a0d" stroke="#454b55"/><text x="132" y="644" fill="#737985" font-family="Arial" font-size="19">DD/MM/AAAA</text>
  <text x="115" y="715" fill="#fff" font-family="Arial" font-size="18" font-weight="800">WhatsApp</text><rect x="110" y="735" width="490" height="62" rx="13" fill="#080a0d" stroke="#454b55"/><text x="132" y="774" fill="#737985" font-family="Arial" font-size="19">(22) 99999-9999</text>
  ${btn(110,845,490,'Entrar no evento',true)}`);
 if(id===3)return base('PASSO 3','Encontre suas fotos','Busca facial temporária',`
  <rect x="110" y="330" width="490" height="85" rx="18" fill="#21160e" stroke="#5d3922"/><text x="135" y="382" fill="#ffb27f" font-family="Arial" font-size="20" font-weight="900">🔒 Evento pago e protegido</text>
  <text x="110" y="490" fill="#fff" font-family="Arial" font-size="31" font-weight="900">◎ Encontrar minhas fotos</text>
  <rect x="110" y="535" width="235" height="190" rx="18" fill="#1b2027"/><text x="137" y="590" font-size="40">🤳</text><text x="135" y="635" fill="#fff" font-family="Arial" font-size="22" font-weight="900">Tirar selfie</text><text x="135" y="672" fill="${C.muted}" font-family="Arial" font-size="16">De frente e boa luz</text>
  <rect x="365" y="535" width="235" height="190" rx="18" fill="#1b2027"/><text x="392" y="590" font-size="40">🖼️</text><text x="390" y="635" fill="#fff" font-family="Arial" font-size="22" font-weight="900">Escolher foto</text><text x="390" y="672" fill="${C.muted}" font-family="Arial" font-size="16">Use uma foto do celular</text>
  <rect x="110" y="755" width="490" height="76" rx="15" fill="#14251c" stroke="#2b7e50"/><text x="135" y="802" fill="#fff" font-family="Arial" font-size="18" font-weight="800">☑ Autorizo a busca facial temporária</text>
  ${btn(110,865,490,'Encontrar minhas fotos',true)}`);
 if(id===4)return base('PASSO 4','Selecione as fotos','Toque em + Carrinho',`
  <text x="110" y="330" fill="#fff" font-family="Arial" font-size="30" font-weight="900">5 fotos encontradas</text>
  ${photo(110,370,230,245,true)}${photo(370,370,230,245,true)}${photo(110,635,230,245,false)}${photo(370,635,230,245,false)}
  <rect x="95" y="930" width="530" height="105" rx="20" fill="#15191f" stroke="#8f4a21" stroke-width="2"/><text x="120" y="970" fill="#fff" font-family="Arial" font-size="22" font-weight="900">🛒 2 fotos</text><text x="120" y="1000" fill="${C.muted}" font-family="Arial" font-size="17">R$ 20,00 · Ver minhas imagens</text>${btn(415,952,185,'Finalizar compra',true)}`);
 if(id===5)return base('PASSO 5','Abra, deslize e selecione','Tela cheia com navegação lateral',`
  <rect x="95" y="320" width="530" height="600" rx="22" fill="#202b37"/>
  <circle cx="310" cy="525" r="75" fill="#d6b18f"/><circle cx="450" cy="525" r="75" fill="#c08a67"/><rect x="220" y="620" width="320" height="180" rx="30" fill="#0f172a"/>
  <rect x="466" y="345" width="135" height="45" rx="14" fill="#08090bdd" stroke="#fff"/><text x="534" y="374" text-anchor="middle" fill="#fff" font-family="Arial" font-size="16" font-weight="900">☐ Selecionar</text>
  <rect x="112" y="575" width="50" height="75" rx="16" fill="#11151acc"/><text x="137" y="625" text-anchor="middle" fill="#fff" font-family="Arial" font-size="42">‹</text><rect x="558" y="575" width="50" height="75" rx="16" fill="#11151acc"/><text x="583" y="625" text-anchor="middle" fill="#fff" font-family="Arial" font-size="42">›</text>
  <rect x="315" y="290" width="90" height="40" rx="20" fill="#15191f"/><text x="360" y="317" text-anchor="middle" fill="#fff" font-family="Arial" font-size="16" font-weight="900">4 / 5</text>
  <text x="150" y="960" fill="${C.muted}" font-family="Arial" font-size="18" font-weight="800">Deslize para os lados para ver as demais</text>`);
 if(id===6)return base('PASSO 6','Confira Minhas imagens','Veja o que está comprando',`
  <text x="110" y="330" fill="${C.orange}" font-family="Arial" font-size="17" font-weight="900">MINHAS IMAGENS</text><text x="110" y="380" fill="#fff" font-family="Arial" font-size="34" font-weight="900">Sua compra</text>
  ${photo(110,430,150,160,true,'')}${photo(285,430,150,160,true,'')}${photo(460,430,150,160,true,'')}
  <rect x="110" y="630" width="500" height="100" rx="16" fill="#0b0e12" stroke="#303740"/><text x="135" y="675" fill="#fff" font-family="Arial" font-size="24" font-weight="900">3 fotos</text><text x="135" y="705" fill="${C.muted}" font-family="Arial" font-size="16">Total da compra</text><text x="560" y="690" text-anchor="end" fill="${C.orange}" font-family="Arial" font-size="32" font-weight="900">R$ 30,00</text>
  ${btn(110,780,235,'← Voltar às fotos',false)}${btn(365,780,245,'Finalizar compra',true)}`);
 if(id===7)return base('PASSO 7','Faça o pagamento','Abra o pagamento seguro',`
  <rect x="110" y="330" width="500" height="245" rx="20" fill="#17191f" stroke="#4b382a"/><text x="135" y="372" fill="${C.orange}" font-family="Arial" font-size="17" font-weight="900">PAGAMENTO</text><text x="135" y="420" fill="#fff" font-family="Arial" font-size="30" font-weight="900">Aguardando confirmação</text><text x="135" y="458" fill="${C.muted}" font-family="Arial" font-size="22">R$ 30,00</text>${btn(135,490,450,'↻ Atualizar',true)}
  <text x="135" y="625" fill="#ff9b58" font-family="Arial" font-size="24" font-weight="900">Abrir pagamento seguro →</text>
  <rect x="110" y="675" width="500" height="300" rx="20" fill="#f8f9fb"/><text x="140" y="725" fill="#15171b" font-family="Arial" font-size="27" font-weight="900">Pagamento seguro</text><text x="140" y="768" fill="#59616c" font-family="Arial" font-size="18">3 fotos • Congresso 2026</text><text x="140" y="825" fill="#15171b" font-family="Arial" font-size="42" font-weight="900">R$ 30,00</text><rect x="140" y="855" width="440" height="55" rx="14" fill="#eaf8f2" stroke="#1e9d6b"/><text x="165" y="890" fill="#15171b" font-family="Arial" font-size="20" font-weight="900">◉ Pix</text>`);
 return base('PASSO 8','Baixe os originais','Após o pagamento aprovado',`
  <text x="110" y="330" fill="${C.orange}" font-family="Arial" font-size="17" font-weight="900">MINHA CONTA</text><text x="110" y="380" fill="#fff" font-family="Arial" font-size="34" font-weight="900">Meus downloads</text>
  ${[0,1,2].map((_,i)=>`<rect x="110" y="${430+i*150}" width="500" height="120" rx="16" fill="#14251c" stroke="#2b7e50"/><rect x="125" y="${445+i*150}" width="90" height="90" rx="12" fill="#6f5c49"/><text x="240" y="${483+i*150}" fill="#fff" font-family="Arial" font-size="22" font-weight="900">Foto ${i+1}</text><text x="240" y="${515+i*150}" fill="${C.green}" font-family="Arial" font-size="16">Original liberado</text><rect x="480" y="${462+i*150}" width="105" height="52" rx="13" fill="#23794b"/><text x="532" y="${495+i*150}" text-anchor="middle" fill="#fff" font-family="Arial" font-size="17" font-weight="900">↓ Baixar</text>`).join('')}
  <rect x="110" y="920" width="500" height="110" rx="18" fill="#102019" stroke="#2b7e50"/><text x="140" y="970" fill="${C.green}" font-family="Arial" font-size="28" font-weight="900">✓ Pronto!</text><text x="140" y="1005" fill="#fff" font-family="Arial" font-size="18">Salve as fotos no seu celular.</text>`);
}
export async function GET(_req:Request,{params}:{params:{id:string}}){
 const id=Math.max(0,Math.min(8,Number(params.id)||0));
 const svg=scene(id);
 return new Response(svg,{headers:{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public, max-age=3600'}});
}