import { redirect } from 'next/navigation';

export default function LegacyAdminLoginPage() {
  redirect('/login?role=admin');
}
