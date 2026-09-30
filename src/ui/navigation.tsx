'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
export type NavGroup={label:string;items:{label:string;href:string;icon:string}[]};
export function Navigation({ groups }: {groups:NavGroup[]}) {
  const path=usePathname();
  return <nav aria-label="Menu da área">{groups.map(group=><div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(item=><Link className={`nav-link ${(path===item.href || (item.href!=='/rh' && item.href!=='/candidato' && path.startsWith(item.href)))?'active':''}`} aria-current={path===item.href?'page':undefined} key={item.href} href={item.href}><Icon name={item.icon}/>{item.label}</Link>)}</div>)}</nav>;
}
