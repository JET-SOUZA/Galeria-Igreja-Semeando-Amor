import './styles.css';
import PrivateGallerySessionBridge from './components/PrivateGallerySessionBridge';
import PaidPhotoPreviewBridge from './components/PaidPhotoPreviewBridge';
import FreeOriginalDownloadBridge from './components/FreeOriginalDownloadBridge';
export const metadata={
 title:'Legacy Semeando Memórias',
 description:'Fotos que contam histórias — galerias públicas e privadas com acesso seguro.',
 icons:{icon:'/brand/legacy-semeando-memorias.jpeg',apple:'/brand/legacy-semeando-memorias.jpeg'},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><PrivateGallerySessionBridge/><PaidPhotoPreviewBridge/><FreeOriginalDownloadBridge/>{children}</body></html>}
