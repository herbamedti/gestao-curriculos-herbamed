import Candidates from '../candidatos/page';
export default async function TalentPool({searchParams}:{searchParams:Promise<{q?:string;city?:string;area?:string;page?:string}>}) {
  return <Candidates searchParams={Promise.resolve({...await searchParams,pool:'1'})} />;
}
