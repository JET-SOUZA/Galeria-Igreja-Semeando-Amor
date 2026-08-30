import './developer.css';
import './mobile-actions.css';
import MobileLogout from './MobileLogout';
import AccountMenu from '../components/AccountMenu';
import ClientAdminShortcut from './ClientAdminShortcut';
import DeveloperUsersCenter from './DeveloperUsersCenter';

export default function DeveloperLayout({children}:{children:React.ReactNode}){
  return <><AccountMenu/><DeveloperUsersCenter/><ClientAdminShortcut/><div className="crm-mobile-actions"><MobileLogout/></div>{children}<style>{`.client-admin-shortcut{position:fixed;z-index:87;right:18px;top:76px;background:#ff7417;color:#fff;text-decoration:none;padding:10px 13px;border-radius:12px;font:800 11px system-ui;box-shadow:0 12px 28px #0006}@media(max-width:700px){.client-admin-shortcut{right:10px;top:70px}}`}</style></>;
}
