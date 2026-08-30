import './developer.css';
import './mobile-actions.css';
import MobileLogout from './MobileLogout';
import AccountMenu from '../components/AccountMenu';

export default function DeveloperLayout({children}:{children:React.ReactNode}){
  return <><AccountMenu/><div className="crm-mobile-actions"><MobileLogout/></div>{children}</>;
}
