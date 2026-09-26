import {ImageResponse} from 'next/og';
export const runtime='edge';

const photos=[
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381927/semeando-memorias/eventos/congresso-2026/jhxojmrqqkjaq2ougbtk.jpg',
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381927/semeando-memorias/eventos/congresso-2026/vq9ambjytsbnxsaaqvxi.jpg',
 'https://res.cloudinary.com/to3hnwdl/image/upload/v1790381926/semeando-memorias/eventos/congresso-2026/vimwygxaqgvafqrnu2tv.jpg'
];

const C={
 bg:'#070708', panel:'#121318', panel2:'#0f1512', orange:'#ff7417', white:'#f5f5f7',
 muted:'#9ca0aa', green:'#75dda9', border:'#30323a'
};

function Shell({step,title,subtitle,children}:{step:string,title:string,subtitle:string,children:any}){
 return <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:C.bg,color:C.white,padding:'76px 56px 60px',fontFamily:'Arial,Helvetica,sans-serif'}}>
   <div style={{display:'flex',flexDirection:'column',gap:10}}>
     <div style={{fontSize:25,fontWeight:800,letterSpacing:3,color:C.orange}}>{step}</div>
     <div style={{fontSize:58,fontWeight:800,lineHeight:1.04}}>{title}</div>
     <div style={{fontSize:28,color:C.muted,lineHeight:1.35,maxWidth:900}}>{subtitle}</div>
   </div>
   <div style={{display:'flex',flex:1,alignItems:'center',justifyContent:'center',marginTop:32}}>{children}</div>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:20,color:'#737781'}}>
     <div style={{display:'flex',gap:8}}><span style={{color:C.orange,fontWeight:900}}>LEGACY</span><span>SEMEANDO MEMÓRIAS</span></div>
     <div>Fotos que contam histórias</div>
   </div>
 </div>
}

function Scene({id}:{id:number}){
 if(id===1)return <Shell step="PASSO 1" title="Abra o link do evento" subtitle="Você recebe o acesso pelo WhatsApp. Não precisa instalar nada.">
  <div style={{display:'flex',width:920,height:760,borderRadius:38,border:'2px solid #245f43',background:'#0d2118',padding:50,flexDirection:'column',justifyContent:'space-between',boxShadow:'0 20px 70px #0008'}}>
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <div style={{fontSize:52,fontWeight:800}}>Congresso 2026</div>
      <div style={{fontSize:30,color:'#d9e2dc'}}>Seu link de acesso chegou pelo WhatsApp.</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:16,padding:34,borderRadius:24,border:'2px solid #3b9868',background:'#114d31'}}>
      <div style={{fontSize:38,fontWeight:800}}>Ver fotos do evento</div>
      <div style={{fontSize:24,color:'#d6e8dd'}}>semeando-memorias.vercel.app</div>
    </div>
    <div style={{display:'flex',justifyContent:'flex-end'}}><div style={{width:110,height:110,borderRadius:999,border:'10px solid '+C.orange,display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{width:48,height:48,borderRadius:999,background:C.orange}}/></div></div>
  </div>
 </Shell>;

 if(id===2)return <Shell step="PASSO 2" title="Entre na sua galeria" subtitle="No primeiro acesso, cadastre-se. Se já entrou antes, use “Já sou cadastrado”.">
  <div style={{display:'flex',width:920,borderRadius:34,border:'2px solid '+C.border,background:C.panel,padding:42,flexDirection:'column',gap:30}}>
    <div style={{display:'flex',gap:12}}>
      <div style={{display:'flex',flex:1,justifyContent:'center',padding:24,borderRadius:18,background:C.orange,color:'#111',fontSize:30,fontWeight:800}}>Primeiro acesso</div>
      <div style={{display:'flex',flex:1,justifyContent:'center',padding:24,borderRadius:18,border:'4px solid '+C.orange,background:'#26272e',fontSize:30,fontWeight:800}}>Já sou cadastrado</div>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:22}}>
      <div style={{fontSize:30,fontWeight:800}}>Para entrar novamente:</div>
      {['CPF','Data de nascimento','WhatsApp'].map((x,i)=><div key={x} style={{display:'flex',flexDirection:'column',gap:10}}><div style={{fontSize:24,fontWeight:700}}>{x}</div><div style={{height:82,borderRadius:16,border:'2px solid #4a4d57',background:'#090b0e',padding:'22px 24px',fontSize:26,color:'#7f8490'}}>{i===0?'000.000.000-00':i===1?'DD/MM/AAAA':'(22) 99999-9999'}</div></div>)}
      <div style={{display:'flex',justifyContent:'center',padding:25,borderRadius:18,background:C.orange,color:'#111',fontSize:30,fontWeight:900}}>Entrar no evento</div>
    </div>
  </div>
 </Shell>;

 if(id===3)return <Shell step="PASSO 3" title="Selecione suas fotos" subtitle="Toque no quadrinho no canto da imagem. Você pode marcar uma ou várias.">
  <div style={{display:'flex',width:940,flexDirection:'column',gap:22}}>
   <div style={{display:'flex',fontSize:42,fontWeight:800}}>Todas as fotos</div>
   <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
    {photos.map((p,i)=><div key={p} style={{display:'flex',position:'relative',width:i===2?440:440,height:500,borderRadius:28,overflow:'hidden',border:'7px solid '+C.orange}}>
      <img src={p} width="440" height="500" style={{objectFit:'cover',width:'100%',height:'100%'}}/>
      <div style={{position:'absolute',right:14,top:14,width:64,height:64,borderRadius:14,border:'4px solid white',background:'#34363d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,fontWeight:900}}>✓</div>
     </div>)}
   </div>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'22px 28px',borderRadius:24,border:'2px solid #8f4a21',background:'#171719'}}>
     <div style={{display:'flex',flexDirection:'column'}}><div style={{fontSize:34,fontWeight:800}}>3 fotos selecionadas</div><div style={{fontSize:23,color:C.muted}}>Prontas para baixar</div></div>
     <div style={{display:'flex',padding:'22px 34px',borderRadius:18,background:C.orange,color:'#111',fontSize:29,fontWeight:900}}>↓ Baixar imagens selecionadas</div>
   </div>
  </div>
 </Shell>;

 if(id===4)return <Shell step="PASSO 4" title="Veja em tela cheia" subtitle="Abra a foto, deslize para os lados e selecione sem voltar para a grade.">
  <div style={{display:'flex',position:'relative',width:880,height:1170,borderRadius:26,overflow:'hidden',border:'2px solid '+C.border,background:'#111'}}>
    <img src={photos[1]} width="880" height="1170" style={{objectFit:'contain',width:'100%',height:'100%',background:'#000'}}/>
    <div style={{position:'absolute',right:18,top:18,display:'flex',gap:12,alignItems:'center',padding:'12px 18px',borderRadius:18,border:'3px solid #fff',background:'#090a0ddd',fontSize:27,fontWeight:800}}>
      <div style={{width:42,height:42,borderRadius:9,border:'3px solid #fff'}}/>Selecionar
    </div>
    <div style={{position:'absolute',left:16,top:'48%',width:74,height:112,borderRadius:18,background:'#17181dcc',display:'flex',alignItems:'center',justifyContent:'center',fontSize:54}}>‹</div>
    <div style={{position:'absolute',right:16,top:'48%',width:74,height:112,borderRadius:18,background:'#17181dcc',display:'flex',alignItems:'center',justifyContent:'center',fontSize:54}}>›</div>
    <div style={{position:'absolute',bottom:28,left:240,right:240,display:'flex',justifyContent:'center',padding:14,borderRadius:999,background:'#111b',fontSize:23,color:'#fff'}}>← deslize para os lados →</div>
  </div>
 </Shell>;

 return <Shell step="PASSO 5" title="Baixe suas fotos" subtitle="Quando terminar de escolher, toque no botão fixo na parte de baixo.">
  <div style={{display:'flex',width:940,flexDirection:'column',gap:24}}>
    <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
      {photos.map(p=><div key={p} style={{display:'flex',position:'relative',width:440,height:470,borderRadius:28,overflow:'hidden',border:'7px solid '+C.orange}}>
       <img src={p} width="440" height="470" style={{objectFit:'cover',width:'100%',height:'100%'}}/>
       <div style={{position:'absolute',right:14,top:14,width:62,height:62,borderRadius:14,border:'4px solid white',background:'#34363d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:46,fontWeight:900}}>✓</div>
      </div>)}
    </div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'24px 28px',borderRadius:24,border:'2px solid #8f4a21',background:'#171719'}}>
      <div style={{display:'flex',flexDirection:'column'}}><div style={{fontSize:34,fontWeight:800}}>3 fotos selecionadas</div><div style={{fontSize:23,color:C.muted}}>Prontas para baixar</div></div>
      <div style={{display:'flex',padding:'24px 34px',borderRadius:18,background:C.orange,color:'#111',fontSize:30,fontWeight:900}}>↓ Baixar imagens selecionadas</div>
    </div>
    <div style={{display:'flex',padding:30,borderRadius:24,border:'2px solid #245f43',background:'#0d2118',flexDirection:'column',gap:8}}>
      <div style={{fontSize:38,color:C.green,fontWeight:900}}>✓ Pronto!</div>
      <div style={{fontSize:27,color:'#e6eee9'}}>Suas fotos ficam salvas no seu aparelho.</div>
    </div>
  </div>
 </Shell>;
}

export async function GET(_req:Request,{params}:{params:{id:string}}){
 const id=Math.min(5,Math.max(1,Number(params.id)||1));
 return new ImageResponse(<Scene id={id}/>,{width:1080,height:1920});
}
