import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
export default function NotFound(){return <main id="conteudo" tabIndex={-1} className="page-shell grid min-h-[60vh] place-items-center py-16 text-center"><div><p className="eyebrow">Erro 404</p><h1 className="display-title mt-4 text-6xl">Perfil não encontrado.</h1><p className="mx-auto mt-5 max-w-lg text-muted-foreground">O identificador não existe no lote publicado ou a Casa informada é inválida.</p><Link className={`${buttonVariants()} mt-7`} href="/">Voltar aos parlamentares</Link></div></main>}
