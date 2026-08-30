import './styles.css';
import PrivateGallerySessionBridge from './components/PrivateGallerySessionBridge';
import PaidPhotoPreviewBridge from './components/PaidPhotoPreviewBridge';
export const metadata={title:'Semeando Memórias',description:'Galerias de eventos públicas e privadas com acesso seguro'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><PrivateGallerySessionBridge/><PaidPhotoPreviewBridge/>{children}</body></html>}
