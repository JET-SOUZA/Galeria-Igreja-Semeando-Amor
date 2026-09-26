import {ImageResponse} from 'next/og';
export const runtime='edge';

const photos=[
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381927/semeando-memorias/eventos/congresso-2026/jhxojmrqqkjaq2ougbtk.jpg',
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381927/semeando-memorias/eventos/congresso-2026/vq9ambjytsbnxsaaqvxi.jpg',
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381926/semeando-memorias/eventos/congresso-2026/vimwygxaqgvafqrnu2tv.jpg'
];
const C={bg:'#070708',panel:'#121318',panel2:'#0d1116',orange:'#ff7417',white:'#f7f7f8',muted:'#a7adb7',green:'#76dfa8',border:'#343b45'};
const box={display:'flex',flexDirection:'column'} as const;

function Header({step,title,sub}:{step:string,title:string,sub:string}){
 return <div style={{...box,gap:10}}>
  <div style={{display:'flex',alignItems:'center',gap:14}}>
   <div style={{padding:'9px 18px',border:'2px solid #ff7417',borderRadius:999,color:C.orange,fontSize:24,fontWeight:900,letterSpacing:2}}>{step}</div>
   <div style={{fontSize:20,color:'#777d87'}}>LEGACY SEMEANDO MEMÓRIAS</div>
  </div>
  <div style={{fontSize:58,lineHeight:1.04,fontWeight:950,letterSpacing:-2}}>{title}</div>
  <div style={{fontSize:25,color:C.muted,lineHeight:1.35}}>{sub}</div>
 </div>
}
function Button({children,primary=false,green=false}:{children:any,primary?:boolean,green?:boolean}){
 return <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:62,padding:'0 22px',borderRadius:15,background:green?'#23794b':primary?C.orange:'#292f38',color:primary?'#111':'#fff',fontSize:23,fontWeight:900}}>{children}</div>
}
function Phone({children}:{children:any}){
 return <div style={{display:'flex',width:820,height:1220,borderRadius:52,padding:20,background:'#050607',border:'5px solid #4a4f56',boxShadow:'0 30px 80px #000b'}}>
  <div style={{display:'flex',flex:1,flexDirection:'column',borderRadius:34,overflow:'hidden',background:'#08090b',border:'1px solid #20242b'}}>
   <div style={{display:'flex',height:76,alignItems:'center',justifyContent:'space-between',padding:'0 24px',background:'#090a0d',fontSize:22,fontWeight:800}}>
    <span>09:41</span><span style={{fontSize:20}}>semeando-memorias.vercel.app</span><span>●◔</span>
   </div>
   <div style={{display:'flex',flex:1,flexDirection:'column',overflow:'hidden'}}>{children}</div>
  </div>
 </div>
}
function Frame({step,title,sub,children}:{step:string,title:string,sub:string,children:any}){
 return <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:C.bg,color:C.white,padding:'60px 54px 48px',fontFamily:'Arial,Helvetica,sans-serif'}}>
  <Header step={step} title={title} sub={sub}/>
  <div style={{display:'flex',flex:1,alignItems:'center',justifyContent:'center',marginTop:24}}>{children}</div>
  <div style={{display:'flex',justifyContent:'space-between',fontSize:18,color:'#6f7580'}}><span>Legacy Semeando Memórias</span><span>Fotos que contam histórias</span></div>
 </div>
}
function Thumb({src,selected=false,label}:{src:string,selected?:boolean,label?:string}){
 return <div style={{display:'flex',position:'relative',width:280,height:300,borderRadius:22,overflow:'hidden',border:selected?'6px solid #ff7417':'2px solid #333943',background:'#111'}}>
  <img src={src} width="280" height="300" style={{width:'100%',height:'100%',objectFit:'cover',filter:'brightness(.82)'}}/>
  <div style={{position:'absolute',right:10,top:10,padding:'8px 12px',borderRadius:999,background:selected?C.orange:'#0b0d10e8',color:selected?'#111':'#fff',fontSize:17,fontWeight:900}}>{selected?'✓ Selecionada':label||'+ Carrinho'}</div>
 </div>
}
function Scene({id}:{id:number}){
 if(id===0)return <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'linear-gradient(180deg,#050607,#0b0806)',color:'#fff',fontFamily:'Arial,Helvetica,sans-serif',padding:'110px 70px'}}>
   <div style={{fontSize:28,color:C.orange,fontWeight:900,letterSpacing:4}}>LEGACY</div>
   <div style={{fontSize:47,fontWeight:950}}>SEMEANDO MEMÓRIAS</div>
   <div style={{fontSize:24,color:C.muted}}>Tutorial do cliente</div>
   <div style={{fontSize:82,lineHeight:1.02,fontWeight:950,marginTop:120}}>Como comprar e<br/><span style={{color:C.orange}}>baixar suas fotos</span></div>
   <div style={{fontSize:30,color:C.muted,marginTop:24}}>Passo a passo da versão paga</div>
   <div style={{display:'flex',gap:18,marginTop:90,flexWrap:'wrap'}}>
    {['Entrar','Localizar','Selecionar','Conferir','Pagar','Baixar'].map(x=><div key={x} style={{padding:'14px 20px',borderRadius:999,border:'2px solid #ff7417',fontSize:23,fontWeight:900}}>{x}</div>)}
   </div>
   <div style={{display:'flex',flex:1,alignItems:'end',justifyContent:'center'}}><div style={{fontSize:30,color:C.green,fontWeight:900}}>Veja cada etapa na tela ↓</div></div>
  </div>;

 if(id===1)return <Frame step="PASSO 1" title="Abra o link do evento" sub="O acesso chega pelo WhatsApp. Não precisa instalar nada.">
  <Phone><div style={{...box,padding:36,gap:22}}>
   <div style={{fontSize:24,color:C.orange,fontWeight:900}}>CONGRESSO 2026</div>
   <div style={{...box,gap:10,padding:28,borderRadius:24,border:'2px solid #2b7e50',background:'#102019'}}>
    <div style={{fontSize:36,fontWeight:950}}>Suas fotos estão disponíveis</div>
    <div style={{fontSize:24,color:'#d8e5dc'}}>Toque abaixo para entrar no evento.</div>
    <div style={{marginTop:18}}><Button green>Ver fotos do evento</Button></div>
   </div>
   <div style={{marginTop:25,fontSize:26,color:C.muted}}>✓ O link abre diretamente no navegador do celular.</div>
  </div></Phone>
 </Frame>;

 if(id===2)return <Frame step="PASSO 2" title="Entre ou faça seu cadastro" sub="Use Primeiro acesso ou Já sou cadastrado.">
  <Phone><div style={{...box,padding:32,gap:20}}>
   <div style={{fontSize:38,fontWeight:950}}>Entre na sua galeria</div>
   <div style={{fontSize:23,color:C.muted}}>Se já entrou antes, recupere o acesso com seus dados.</div>
   <div style={{display:'flex',gap:12}}><div style={{flex:1}}><Button primary>Primeiro acesso</Button></div><div style={{flex:1}}><Button>Já sou cadastrado</Button></div></div>
   {['CPF','Data de nascimento','WhatsApp'].map((x,i)=><div key={x} style={{...box,gap:7}}>
    <div style={{fontSize:21,fontWeight:900}}>{x}</div><div style={{height:68,border:'2px solid #444a54',borderRadius:13,padding:'18px 20px',fontSize:22,color:'#737985'}}>{i===0?'000.000.000-00':i===1?'DD/MM/AAAA':'(22) 99999-9999'}</div>
   </div>)}
   <Button primary>Entrar no evento</Button>
  </div></Phone>
 </Frame>;

 if(id===3)return <Frame step="PASSO 3" title="Encontre suas fotos" sub="Autorize a busca facial e envie uma selfie ou foto nítida.">
  <Phone><div style={{...box,padding:32,gap:20}}>
   <div style={{padding:24,border:'2px solid #5d3922',borderRadius:20,background:'#21160e',fontSize:23,color:'#ffb27f'}}>🔒 Evento pago e protegido</div>
   <div style={{fontSize:38,fontWeight:950}}>◎ Encontrar minhas fotos</div>
   <div style={{display:'flex',gap:14}}>
    <div style={{...box,flex:1,gap:7,padding:22,borderRadius:18,background:'#1b2027'}}><div style={{fontSize:46}}>🤳</div><div style={{fontSize:24,fontWeight:900}}>Tirar selfie</div><div style={{fontSize:19,color:C.muted}}>De frente e com boa luz</div></div>
    <div style={{...box,flex:1,gap:7,padding:22,borderRadius:18,background:'#1b2027'}}><div style={{fontSize:46}}>🖼️</div><div style={{fontSize:24,fontWeight:900}}>Escolher foto</div><div style={{fontSize:19,color:C.muted}}>Use uma imagem do celular</div></div>
   </div>
   <div style={{display:'flex',alignItems:'center',gap:14,padding:18,borderRadius:15,border:'2px solid #2b7e50',background:'#14251c'}}><div style={{width:40,height:40,borderRadius:8,border:'3px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>✓</div><div style={{fontSize:21,fontWeight:900}}>Autorizo a busca facial temporária</div></div>
   <Button primary>Encontrar minhas fotos</Button>
  </div></Phone>
 </Frame>;

 if(id===4)return <Frame step="PASSO 4" title="Selecione as fotos" sub="Toque em + Carrinho nas imagens que deseja comprar.">
  <Phone><div style={{...box,padding:25,gap:16}}>
   <div style={{fontSize:37,fontWeight:950}}>5 fotos encontradas</div>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{photos.map((p,i)=><Thumb key={p} src={p} selected={i<2}/>)}</div>
   <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:18,border:'2px solid #8f4a21',borderRadius:17,background:'#15191f'}}>
    <div style={{...box}}><b style={{fontSize:27}}>🛒 2 fotos</b><span style={{fontSize:21,color:C.muted}}>R$ 20,00 · Ver minhas imagens</span></div><Button primary>Finalizar compra</Button>
   </div>
  </div></Phone>
 </Frame>;

 if(id===5)return <Frame step="PASSO 5" title="Abra, deslize e selecione" sub="Na tela cheia, passe para os lados para ver todas as fotos encontradas.">
  <Phone><div style={{...box,position:'relative',height:'100%',background:'#050608'}}>
   <div style={{position:'absolute',top:18,left:'50%',transform:'translateX(-50%)',padding:'7px 12px',borderRadius:999,background:'#15191f',fontSize:18,fontWeight:900}}>4 / 5</div>
   <div style={{position:'absolute',top:20,right:20,width:48,height:48,borderRadius:999,background:'#242832',fontSize:34,display:'flex',alignItems:'center',justifyContent:'center'}}>×</div>
   <div style={{display:'flex',position:'relative',height:760,marginTop:80,background:'#0b0d10',alignItems:'center',justifyContent:'center'}}>
    <img src={photos[1]} width="740" height="760" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
    <div style={{position:'absolute',right:18,top:18,padding:'9px 13px',borderRadius:12,background:'#090a0ddd',border:'2px solid #fff',fontSize:21,fontWeight:900}}>☐ Selecionar</div>
    <div style={{position:'absolute',left:12,top:'46%',width:48,height:68,borderRadius:16,background:'#11151acc',fontSize:43,display:'flex',alignItems:'center',justifyContent:'center'}}>‹</div>
    <div style={{position:'absolute',right:12,top:'46%',width:48,height:68,borderRadius:16,background:'#11151acc',fontSize:43,display:'flex',alignItems:'center',justifyContent:'center'}}>›</div>
   </div>
   <div style={{textAlign:'center',padding:14,fontSize:20,color:C.muted,fontWeight:900}}>Deslize para os lados para ver todas as suas fotos</div>
   <div style={{...box,padding:'20px 26px',gap:8}}><div style={{fontSize:20,color:C.orange,fontWeight:900}}>PRÉVIA PROTEGIDA</div><div style={{fontSize:34,fontWeight:950}}>Sua foto foi encontrada</div><div style={{fontSize:20,color:C.muted}}>O original em alta qualidade libera após a compra.</div></div>
  </div></Phone>
 </Frame>;

 if(id===6)return <Frame step="PASSO 6" title="Confira Minhas imagens" sub="Veja exatamente o que está comprando antes de pagar.">
  <Phone><div style={{...box,padding:30,gap:18}}>
   <div style={{fontSize:20,color:C.orange,fontWeight:900}}>MINHAS IMAGENS</div><div style={{fontSize:40,fontWeight:950}}>Sua compra</div><div style={{fontSize:22,color:C.muted}}>Confira as fotos selecionadas.</div>
   <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{photos.map(p=><div key={p} style={{display:'flex',width:220,height:220,borderRadius:18,overflow:'hidden',border:'4px solid #ff7417'}}><img src={p} width="220" height="220" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>)}</div>
   <div style={{display:'flex',justifyContent:'space-between',padding:20,border:'2px solid #303740',borderRadius:16,background:'#0b0e12'}}><div style={{...box}}><b style={{fontSize:28}}>3 fotos</b><span style={{fontSize:19,color:C.muted}}>Total da compra</span></div><strong style={{fontSize:36,color:C.orange}}>R$ 30,00</strong></div>
   <div style={{display:'flex',gap:12}}><div style={{flex:1}}><Button>← Voltar às fotos</Button></div><div style={{flex:1}}><Button primary>Finalizar compra</Button></div></div>
  </div></Phone>
 </Frame>;

 if(id===7)return <Frame step="PASSO 7" title="Faça o pagamento" sub="Abra o pagamento seguro e conclua usando uma opção disponível.">
  <Phone><div style={{...box,padding:30,gap:18}}>
   <div style={{padding:22,border:'2px solid #4b382a',borderRadius:20,background:'#17191f'}}>
    <div style={{fontSize:20,color:C.orange,fontWeight:900}}>PAGAMENTO</div>
    <div style={{fontSize:34,fontWeight:950,marginTop:5}}>Aguardando confirmação</div><div style={{fontSize:24,color:C.muted}}>R$ 30,00</div>
    <div style={{marginTop:18}}><Button primary>↻ Atualizar</Button></div>
    <div style={{fontSize:25,color:'#ff9b58',fontWeight:900,marginTop:18}}>Abrir pagamento seguro →</div>
   </div>
   <div style={{...box,gap:12,padding:24,borderRadius:20,background:'#f8f9fb',color:'#15171b'}}>
    <div style={{fontSize:31,fontWeight:950}}>Pagamento seguro</div><div style={{fontSize:23,color:'#59616c'}}>3 fotos • Congresso 2026</div><div style={{fontSize:48,fontWeight:950}}>R$ 30,00</div>
    <div style={{padding:18,borderRadius:14,border:'2px solid #1e9d6b',background:'#eaf8f2',fontSize:24,fontWeight:900}}>◉ Pix</div>
    <div style={{padding:18,borderRadius:14,border:'2px solid #d7dbe1',background:'#fff',fontSize:24,fontWeight:900}}>○ Outras opções disponíveis</div>
   </div>
  </div></Phone>
 </Frame>;

 return <Frame step="PASSO 8" title="Baixe os originais" sub="Após a aprovação, abra Meus downloads e salve as fotos.">
  <Phone><div style={{...box,padding:30,gap:14}}>
   <div style={{fontSize:20,color:C.orange,fontWeight:900}}>MINHA CONTA</div><div style={{fontSize:40,fontWeight:950}}>Meus downloads</div><div style={{fontSize:22,color:C.muted}}>Fotos compradas e liberadas neste evento.</div>
   {photos.map((p,i)=><div key={p} style={{display:'flex',alignItems:'center',gap:14,padding:12,borderRadius:15,border:'2px solid #2b7e50',background:'#14251c'}}>
    <div style={{width:105,height:105,borderRadius:12,overflow:'hidden',display:'flex'}}><img src={p} width="105" height="105" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
    <div style={{...box,flex:1}}><b style={{fontSize:25}}>Foto {i+1}</b><span style={{fontSize:18,color:C.green}}>Original liberado</span></div><Button green>↓ Baixar</Button>
   </div>)}
   <div style={{...box,gap:7,padding:20,borderRadius:17,border:'2px solid #2b7e50',background:'#102019'}}><div style={{fontSize:34,color:C.green,fontWeight:950}}>✓ Pronto!</div><div style={{fontSize:22}}>Salve os arquivos no seu celular.</div></div>
  </div></Phone>
 </Frame>;
}

export async function GET(_req:Request,{params}:{params:{id:string}}){
 const n=Number(params.id);
 const id=Number.isFinite(n)?Math.max(0,Math.min(8,n)):0;
 return new ImageResponse(<Scene id={id}/>,{width:1080,height:1920});
}