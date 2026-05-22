import AuthForm from '@/app/components/AuthForm';

export default function LoginPage() {
  return (
    <main className="container py-5 auth-page">
      <AuthForm mode="login" />
    </main>
  );
}
