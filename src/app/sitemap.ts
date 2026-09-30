import type { MetadataRoute } from 'next';
import { config, isConfigured } from '@/lib/config';
import { db } from '@/lib/supabase';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const staticPages=['','/vagas','/banco-de-talentos','/privacidade'].map(path=>({url:`${config.url}${path}`,lastModified:new Date()}));
  if(!isConfigured())return staticPages;
  const {data}=await (await db()).from('jobs').select('slug,updated_at').eq('status','published').eq('visibility','public').limit(1000);
  return [...staticPages,...(data||[]).map(job=>({url:`${config.url}/vagas/${job.slug}`,lastModified:new Date(job.updated_at)}))];
}
