import DeveloperClientHealthDashboard from './DeveloperClientHealthDashboard';

export default function ClientAdminLayout({children,params}:{children:React.ReactNode;params:{id:string}}){
 return <>
  <div style={{background:'#080b0f',padding:'18px 18px 0'}}>
   <DeveloperClientHealthDashboard organizationId={params.id}/>
  </div>
  {children}
 </>;
}
