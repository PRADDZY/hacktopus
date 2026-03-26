import { redirect } from 'next/navigation';

export default function LegacySignupPage() {
  redirect('/login');
}
