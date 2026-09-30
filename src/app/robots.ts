import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
export default function robots():MetadataRoute.Robots {
  if(config.environment!=='production')return {rules:[{userAgent:'*',disallow:'/'}]};
  return {rules:[{userAgent:'*',allow:'/',disallow:['/rh','/candidato','/auth','/api']}],sitemap:`${config.url}/sitemap.xml`};
}
