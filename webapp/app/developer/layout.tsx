import './developer.css';
import './mobile-actions.css';
import MobileLogout from './MobileLogout';

export default function DeveloperLayout({children}:{children:React.ReactNode}){
  return <><div className="crm-mobile-actions"><MobileLogout/></div>{children}</>;
}
