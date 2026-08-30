'use client';
export default function MobileLogout(){
  function logout(){
    localStorage.removeItem('semeando_admin_session');
    sessionStorage.removeItem('semeando_admin_session');
    location.href='/admin/login';
  }
  return <button className="crm-mobile-logout" onClick={logout} aria-label="Sair da conta">⇥ <span>Sair</span></button>;
}
