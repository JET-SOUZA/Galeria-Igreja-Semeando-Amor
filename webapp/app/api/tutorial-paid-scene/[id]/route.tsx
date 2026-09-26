import {ImageResponse} from 'next/og';
export const runtime='edge';

const photos=[
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381927/semeando-memorias/eventos/congresso-2026/jhxojmrqqkjaq2ougbtk.jpg',
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381927/semeando-memorias/eventos/congresso-2026/vq9ambjytsbnxsaaqvxi.jpg',
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381926/semeando-memorias/eventos/congresso-2026/vimwygxaqgvafqrnu2tv.jpg'
];

const C={bg:'#070708',panel:'#121318',panel2:'#0f1512',orange:'#ff7417',white:'#f5f5f7',muted:'#9ca0aa',green:'#75dda9',border:'#30323a'};

function Shell({step,title,subtitle,children}:{step:string,title:string,subtitle:string,children:any}){
 return <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:C.bg,color:C.white,padding:'72px 54px 58px',fontFamily:'Arial,Helvetica,sans-serif'}}>
  <div style={{display:'flex',flexDirection:'column',gap:10}}>
   <div style={{fontSize:24,fontWeight:800,letterSpacing:3,color:C.orange}}>{step}</div>
   <div style={{fontSize:55,fontWeight:800,lineHeight:1.04}}>{title}</div>
   <div style={{fontSize:27,color:C.muted,lineHeight:1.35,maxWidth:920}}>{subtitle}</div>
  </div>
  <div style={{display:'flex',flex:1,alignItems:'center',justifyContent:'center',marginTop:28}}>{children}</div>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:20,color:'#737781'}}>
   <div style={{display:'flex',gap:8}}><span style={{color:C.orange,fontWeight:900}}>LEGACY</span><span>SEMEANDO MEMÓRIAS</span></div>
   <div>Fotos que contam histórias</div>
  </div>
 </div>
}

const Btn=({children,primary=false,green=false}:{children:any,primary?:boolean,green?:boolean})=><div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'22px 28px',borderRadius:17,background:green?'#23794b':primary?C.orange:'#292f38',color:primary?'#111':'#fff',fontSize:28,fontWeight:900}}>{children}</div>;

function Scene({id}:{id:number}){
 if(id===1)return <Shell step="PASSO 1" title="Abra o link do evento" subtitle="O acesso chega pelo WhatsApp. Toque no link para abrir a galeria.">
  <div style={{display:'flex',width:920,height:740,borderRadius:36,border:'2px solid #245f43',background:'#0d2118',padding:48,flexDirection:'column',justifyContent:'space-between'}}>
   <div style={{display:'flex',flexDirection:'column',gap:18}}><div style={{fontSize:50,fontWeight:900}}>Congresso 2026</div><div style={{fontSize:29,color:'#d9e2dc'}}>As fotos do evento já estão disponíveis.</div></div>
   <div style={{display:'flex',flexDirection:'column',gap:13,padding:32,borderRadius:24,border:'2px solid #3b9868',background:'#114d31'}}>
    <div style={{fontSize:38,fontWeight:900}}>Ver fotos do evento</div><div style={{fontSize:23,color:'#d6e8dd'}}>semeando-memorias.vercel.app</div>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end'}}><div style={{width:108,height:108,borderRadius:999,border:'10px solid '+C.orange,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:46,height:46,borderRadius:999,background:C.orange}}/></div></div>
  </div>
 </Shell>;

 if(id===2)return <Shell step="PASSO 2" title="Entre na sua conta" subtitle="No primeiro acesso, cadastre-se. Se já estiver cadastrado, use “Já sou cadastrado”.">
  <div style={{display:'flex',width:920,borderRadius:34,border:'2px solid '+C.border,background:C.panel,padding:42,flexDirection:'column',gap:28}}>
   <div style={{display:'flex',gap:12}}><Btn primary>Primeiro acesso</Btn><div style={{flex:1}}/><Btn>Já sou cadastrado</Btn></div>
   <div style={{display:'flex',flexDirection:'column',gap:18}}>
    {['CPF','Data de nascimento','WhatsApp'].map((x,i)=><div key={x} style={{display:'flex',flexDirection:'column',gap:9}}><div style={{fontSize:23,fontWeight:800}}>{x}</div><div style={{height:78,borderRadius:15,border:'2px solid #4a4d57',background:'#090b0e',padding:'20px 23px',fontSize:25,color:'#777d88'}}>{i===0?'000.000.000-00':i===1?'DD/MM/AAAA':'(22) 99999-9999'}</div></div>)}
    <Btn primary>Entrar no evento</Btn>
   </div>
  </div>
 </Shell>;

 if(id===3)return <Shell step="PASSO 3" title="Encontre suas fotos" subtitle="Autorize a busca e envie uma selfie. O sistema mostra somente as fotos em que você aparece.">
  <div style={{display:'flex',width:920,flexDirection:'column',gap:22}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:16,padding:28,borderRadius:22,border:'2px solid #5d3922',background:'#23180f'}}>
    <div style={{display:'flex',flexDirection:'column',gap:7}}><div style={{fontSize:23,color:'#ff9b58',fontWeight:900}}>EVENTO COM FOTOS PROTEGIDAS</div><div style={{fontSize:39,fontWeight:900}}>R$ 10,00 por foto</div></div><div style={{display:'flex',alignItems:'center',fontSize:52}}>🔒</div>
   </div>
   <div style={{display:'flex',padding:28,borderRadius:22,border:'2px solid '+C.border,background:C.panel,flexDirection:'column',gap:18}}>
    <div style={{fontSize:34,fontWeight:900}}>◎ Encontrar minhas fotos</div>
    <div style={{display:'flex',gap:14}}>
     <div style={{display:'flex',flex:1,padding:22,borderRadius:16,background:'#1c2027',flexDirection:'column',gap:6}}><div style={{fontSize:42}}>🤳</div><div style={{fontSize:26,fontWeight:900}}>Tirar uma selfie</div><div style={{fontSize:20,color:C.muted}}>De frente e com boa iluminação</div></div>
     <div style={{display:'flex',flex:1,padding:22,borderRadius:16,background:'#1c2027',flexDirection:'column',gap:6}}><div style={{fontSize:42}}>🖼️</div><div style={{fontSize:26,fontWeight:900}}>Escolher uma foto</div><div style={{fontSize:20,color:C.muted}}>Use uma imagem do celular</div></div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:14,padding:18,borderRadius:14,border:'2px solid #2b7e50',background:'#14251c'}}><div style={{width:42,height:42,borderRadius:9,border:'3px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>✓</div><div style={{fontSize:22,fontWeight:800}}>Autorizo a busca facial temporária</div></div>
   </div>
  </div>
 </Shell>;

 if(id===4)return <Shell step="PASSO 4" title="Escolha as fotos" subtitle="Toque em “+ Carrinho” nas fotos que deseja comprar.">
  <div style={{display:'flex',width:940,flexDirection:'column',gap:20}}>
   <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
    {photos.map((p,i)=><div key={p} style={{display:'flex',position:'relative',width:440,height:485,borderRadius:26,overflow:'hidden',border:i<2?'7px solid '+C.orange:'2px solid '+C.border,background:'#15171c'}}>
      <img src={p} width="440" height="485" style={{objectFit:'cover',width:'100%',height:'100%',filter:'brightness(.78)'}}/>
      <div style={{position:'absolute',right:12,top:12,padding:'11px 16px',borderRadius:999,background:i<2?C.orange:'#0b0d10e8',border:'2px solid #ffffff44',fontSize:21,fontWeight:900}}>{i<2?'✓ Selecionada':'+ Carrinho'}</div>
     </div>)}
   </div>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'22px 26px',borderRadius:20,border:'2px solid #8f4a21',background:'#17191f'}}>
    <div style={{display:'flex',flexDirection:'column'}}><div style={{fontSize:32,fontWeight:900}}>🛒 2 fotos</div><div style={{fontSize:24,color:C.muted}}>R$ 20,00</div></div><Btn primary>Finalizar compra</Btn>
   </div>
  </div>
 </Shell>;

 if(id===5)return <Shell step="PASSO 5" title="Finalize a compra" subtitle="Confira a quantidade, o valor e toque em “Finalizar compra”.">
  <div style={{display:'flex',width:900,flexDirection:'column',gap:22,padding:38,borderRadius:30,border:'2px solid '+C.border,background:C.panel}}>
   <div style={{display:'flex',justifyContent:'space-between'}}><div style={{fontSize:26,color:C.muted}}>Fotos selecionadas</div><div style={{fontSize:30,fontWeight:900}}>2</div></div>
   <div style={{height:2,background:'#2f343c'}}/>
   <div style={{display:'flex',justifyContent:'space-between'}}><div style={{fontSize:26,color:C.muted}}>Valor por foto</div><div style={{fontSize:30,fontWeight:900}}>R$ 10,00</div></div>
   <div style={{display:'flex',justifyContent:'space-between'}}><div style={{fontSize:28,fontWeight:900}}>Total</div><div style={{fontSize:42,fontWeight:900,color:C.orange}}>R$ 20,00</div></div>
   <Btn primary>Finalizar compra</Btn>
   <div style={{display:'flex',justifyContent:'center',fontSize:21,color:C.muted}}>Pagamento processado em ambiente seguro</div>
  </div>
 </Shell>;

 if(id===6)return <Shell step="PASSO 6" title="Faça o pagamento" subtitle="Você será direcionado para a página segura de pagamento. Escolha uma das opções disponíveis e conclua.">
  <div style={{display:'flex',width:900,flexDirection:'column',gap:22,padding:38,borderRadius:30,border:'2px solid #48505b',background:'#f7f8fa',color:'#16181c'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:32,fontWeight:900}}>Pagamento seguro</div><div style={{padding:'10px 15px',borderRadius:999,background:'#e7ecf2',fontSize:20,fontWeight:800}}>🔒 protegido</div></div>
   <div style={{fontSize:24,color:'#59616c'}}>2 fotos • Congresso 2026</div>
   <div style={{fontSize:50,fontWeight:900}}>R$ 20,00</div>
   <div style={{display:'flex',flexDirection:'column',gap:12}}>
    {['Pix','Cartão / outras opções disponíveis'].map((x,i)=><div key={x} style={{display:'flex',alignItems:'center',gap:14,padding:22,borderRadius:16,border:'2px solid '+(i===0?'#1e9d6b':'#d7dbe1'),background:i===0?'#eaf8f2':'#fff'}}><div style={{width:34,height:34,borderRadius:999,border:'3px solid '+(i===0?'#1e9d6b':'#9ca3ad'),display:'flex',alignItems:'center',justifyContent:'center'}}>{i===0&&<div style={{width:16,height:16,borderRadius:999,background:'#1e9d6b'}}/>}</div><div style={{fontSize:26,fontWeight:900}}>{x}</div></div>)}
   </div>
   <div style={{display:'flex',justifyContent:'center',padding:21,borderRadius:15,background:'#1e9d6b',color:'#fff',fontSize:28,fontWeight:900}}>Continuar pagamento</div>
  </div>
 </Shell>;

 if(id===7)return <Shell step="PASSO 7" title="Aguarde a aprovação" subtitle="Depois do pagamento, volte para a galeria. O sistema confirma automaticamente e libera os originais.">
  <div style={{display:'flex',width:900,flexDirection:'column',gap:20}}>
   <div style={{display:'flex',padding:26,borderRadius:22,border:'2px solid #4b382a',background:'#17191f',justifyContent:'space-between',alignItems:'center'}}>
    <div style={{display:'flex',flexDirection:'column',gap:7}}><div style={{fontSize:22,color:C.orange,fontWeight:900}}>PAGAMENTO</div><div style={{fontSize:34,fontWeight:900}}>Aguardando confirmação</div><div style={{fontSize:26,color:C.muted}}>R$ 20,00</div></div><div style={{padding:'14px 18px',borderRadius:14,background:'#2a3038',fontSize:22,fontWeight:900}}>↻ Atualizar</div>
   </div>
   <div style={{display:'flex',padding:26,borderRadius:22,border:'2px solid #2b7e50',background:'#14251c',flexDirection:'column',gap:12}}>
    <div style={{fontSize:42,color:C.green,fontWeight:900}}>✓ Pagamento aprovado</div><div style={{fontSize:27,color:'#dff8e9'}}>Suas fotos estão em “Meus downloads”.</div>
   </div>
   <div style={{display:'flex',justifyContent:'flex-end'}}><Btn green>↓ Meus downloads · 2</Btn></div>
  </div>
 </Shell>;

 return <Shell step="PASSO 8" title="Baixe os originais" subtitle="Abra “Meus downloads” e salve as fotos liberadas no seu aparelho.">
  <div style={{display:'flex',width:900,flexDirection:'column',gap:18,padding:30,borderRadius:28,border:'2px solid '+C.border,background:C.panel}}>
   <div style={{display:'flex',flexDirection:'column',gap:6}}><div style={{fontSize:22,color:C.orange,fontWeight:900}}>MINHA CONTA</div><div style={{fontSize:42,fontWeight:900}}>Meus downloads</div><div style={{fontSize:23,color:C.muted}}>Todas as fotos compradas e liberadas.</div></div>
   {photos.slice(0,2).map((p,i)=><div key={p} style={{display:'flex',alignItems:'center',gap:16,padding:14,borderRadius:15,border:'2px solid #2b7e50',background:'#14251c'}}>
    <div style={{width:82,height:82,borderRadius:12,overflow:'hidden',display:'flex'}}><img src={p} width="82" height="82" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>
    <div style={{display:'flex',flex:1,fontSize:25,fontWeight:900}}>Foto {i+1}</div>
    <div style={{display:'flex',padding:'13px 18px',borderRadius:12,background:'#23794b',fontSize:23,fontWeight:900}}>↓ Baixar</div>
   </div>)}
   <div style={{display:'flex',padding:22,borderRadius:18,background:'#0d2118',border:'2px solid #245f43',flexDirection:'column',gap:5}}><div style={{fontSize:32,color:C.green,fontWeight:900}}>✓ Pronto!</div><div style={{fontSize:24,color:'#e6eee9'}}>Os arquivos originais ficam salvos no seu aparelho.</div></div>
  </div>
 </Shell>;
}

export async function GET(_req:Request,{params}:{params:{id:string}}){
 const id=Math.min(8,Math.max(1,Number(params.id)||1));
 return new ImageResponse(<Scene id={id}/>,{width:1080,height:1920});
}