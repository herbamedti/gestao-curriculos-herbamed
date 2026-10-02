import { textListItems } from '@/ui/list-items';

export function EntryDescription({ value }: { value: string }) {
  const items = textListItems(value);
  return items.length > 0 ? <ul className="entry-bullets">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : null;
}
