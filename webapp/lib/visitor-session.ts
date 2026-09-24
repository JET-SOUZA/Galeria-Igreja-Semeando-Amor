const VISITOR_STORAGE_KEY='semeando_visitor';

// One-time access reset published on 24/09/2026. Changing this value invalidates
// only public visitor sessions; administrator sessions use a separate key.
export const VISITOR_ACCESS_VERSION='2026-09-24-1';

export type VisitorSession={
 id:string;
 full_name?:string;
 organization_id?:string;
 registered_at?:string;
 marketing_consent?:boolean;
 access_version?:string;
};

export function clearVisitorSession(){
 if(typeof window!=='undefined')localStorage.removeItem(VISITOR_STORAGE_KEY);
}

export function readVisitorSession():VisitorSession|null{
 if(typeof window==='undefined')return null;
 try{
  const visitor=JSON.parse(localStorage.getItem(VISITOR_STORAGE_KEY)||'null') as VisitorSession|null;
  if(!visitor?.id||visitor.access_version!==VISITOR_ACCESS_VERSION){
   clearVisitorSession();
   return null;
  }
  return visitor;
 }catch{
  clearVisitorSession();
  return null;
 }
}

export function writeVisitorSession(visitor:Omit<VisitorSession,'access_version'>){
 if(typeof window==='undefined')return;
 localStorage.setItem(VISITOR_STORAGE_KEY,JSON.stringify({...visitor,access_version:VISITOR_ACCESS_VERSION}));
}
