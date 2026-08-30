'use client';
import {usePathname} from 'next/navigation';
export default function ClientAdminShortcut(){const p=usePathname();const m=p.match(/^\/developer\/clientes\/([^/]+)$/);if(!m)return null;return <a className="client-admin-shortcut" href={`/developer/clientes/${m[1]}/admin`}>↗ Entrar como Admin</a>}
