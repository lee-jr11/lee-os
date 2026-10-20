"use client";
import { useEffect,useState } from 'react';
export function RegisterWorker() {
 const [connection,setConnection]=useState('Checking browser connection…'),[offlineSupport,setOfflineSupport]=useState('Offline help is not ready yet.'),[update,setUpdate]=useState(false);
 useEffect(()=>{
  let active=true;let registration:ServiceWorkerRegistration|undefined;const workers=new Set<ServiceWorker>();
  const connectionChanged=()=>setConnection(navigator.onLine?'Browser reports a network connection. This does not confirm that the local server or database is ready.':'Browser reports no network connection. An earlier action may still have saved.');
  const workerChanged=()=>{if(active&&registration?.waiting)setUpdate(true);};
  const installing=()=>{const worker=registration?.installing;if(worker){workers.add(worker);worker.addEventListener('statechange',workerChanged);}workerChanged();};
  void Promise.resolve().then(()=>{if(active)connectionChanged();});window.addEventListener('online',connectionChanged);window.addEventListener('offline',connectionChanged);
  if(process.env.NODE_ENV==='production'&&'serviceWorker' in navigator){
   void navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(async value=>{
    if(!active)return;registration=value;value.addEventListener('updatefound',installing);installing();
    await navigator.serviceWorker.ready;if(active)setOfflineSupport('Offline help is registered. Saved work still requires the local server and database.');
   }).catch(()=>{if(active)setOfflineSupport('Offline help could not be registered. The online Hub can still be used.');});
  }else void Promise.resolve().then(()=>{if(active)setOfflineSupport('Offline help requires a production build and a browser supporting service workers.');});
  return()=>{active=false;window.removeEventListener('online',connectionChanged);window.removeEventListener('offline',connectionChanged);registration?.removeEventListener('updatefound',installing);for(const worker of workers)worker.removeEventListener('statechange',workerChanged);};
 },[]);
 return <section className="panel" aria-label="App installation and connection"><details><summary>Install, connection and updates</summary><p role="status">{connection}</p><p>{offlineSupport}</p>{update&&<p role="status">An app update is waiting. Finish your work, keep needed run IDs and lock the Hub. Close all LeeOS tabs and installed windows, then reopen it to use the update. No reload is forced.</p>}<p>In a supported browser, use its address-bar install button or menu to install LeeOS. Some devices offer Add to Home Screen instead. Installation availability is controlled by your browser.</p><p>Installation is a shortcut to this same address. The local Hub and database must still be running. This does not enable remote phone access: localhost on a phone refers to that phone.</p><p>Only this static offline help page is cached. Keys, prompts, API replies, workspace pages and results are not stored by the service worker. No offline work is queued.</p><p>Before an update or closing: keep needed run IDs and save any draft you want to retain. Locking or reloading clears the owner connection and unsaved work.</p></details></section>;
}
