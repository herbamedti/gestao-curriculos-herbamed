import Image from 'next/image';
import Link from '@/ui/link';
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link className="brand" href="/" aria-label="Herbamed Carreiras — início"><Image src="/brand/herbamed.png" alt="Herbamed" width={1129} height={234} priority /><span>{compact ? 'GESTÃO DE TALENTOS' : 'CARREIRAS'}</span></Link>;
}
