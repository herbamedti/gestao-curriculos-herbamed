import { redirect } from 'next/navigation';
import { areaDestination } from '@/modules/auth/session';

export default async function MyArea() {
  redirect(await areaDestination());
}
