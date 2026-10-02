import { jobItems } from './items';
export function JobBulletList({ value }: { value: string }) {
  return <ul className="job-bullets">{jobItems(value).map((item, index) => <li key={index}>{item}</li>)}</ul>;
}
