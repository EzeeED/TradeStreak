import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, LineChart, PlugZap } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import { Button, ErrorBox, Field, Input } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  { icon: PlugZap, title: 'Conecta tu MT5', text: 'Sincroniza automáticamente con un Expert Advisor, MetaApi o importando tu informe.' },
  { icon: LineChart, title: 'Analiza cada trade', text: 'Win rate, profit factor, drawdown, rendimiento por símbolo, hora y día.' },
  { icon: Flame, title: 'Construye rachas', text: 'Diario, etiquetas, errores y tu TradeStreak Score para mejorar con disciplina.' },
];

export default function AuthPage({ mode }) {
  const { login, register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-panel lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-emerald-600/15 blur-3xl" />
        <Logo size={34} />
        <div className="relative">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            El diario de trading que convierte tus datos de <span className="text-emerald-400">MT5</span> en disciplina.
          </h2>
          <div className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4">
                <div className="rounded-xl bg-panel-2 p-2.5 text-violet-300 ring-1 ring-line"><Icon size={20} /></div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <div className="text-sm text-muted">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-muted">© {new Date().getFullYear()} TradeStreak</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div className="mb-8 lg:hidden"><Logo size={34} /></div>
          <div>
            <h1 className="text-2xl font-bold">{isLogin ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h1>
            <p className="mt-1 text-sm text-muted">{isLogin ? 'Entra para ver tu rendimiento.' : 'Empieza a registrar tus trades en minutos.'}</p>
          </div>
          <ErrorBox error={error} />
          {!isLogin && (
            <Field label="Nombre"><Input required value={form.name} onChange={set('name')} autoComplete="name" placeholder="Tu nombre" /></Field>
          )}
          <Field label="Email"><Input required type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="tu@email.com" /></Field>
          <Field label="Contraseña" hint={!isLogin ? 'Mínimo 8 caracteres' : undefined}>
            <Input required type="password" minLength={isLogin ? undefined : 8} value={form.password} onChange={set('password')} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="••••••••" />
          </Field>
          <Button type="submit" loading={loading} className="w-full py-2.5">{isLogin ? 'Entrar' : 'Crear cuenta'}</Button>
          <p className="text-center text-sm text-muted">
            {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
            <Link to={isLogin ? '/register' : '/login'} className="font-medium text-violet-300 hover:text-violet-200">
              {isLogin ? 'Regístrate' : 'Inicia sesión'}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
