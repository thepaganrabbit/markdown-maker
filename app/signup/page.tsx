import AuthForm from '@/app/components/AuthForm';

export default function SignupPage() {
  return (
    <main className="container py-5 auth-page">
      <AuthForm mode="signup" />
    </main>
  );
}
