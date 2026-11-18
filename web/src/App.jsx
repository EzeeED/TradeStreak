import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Trades from './pages/Trades.jsx';
import TradeDetail from './pages/TradeDetail.jsx';
import Calendar from './pages/Calendar.jsx';
import Reports from './pages/Reports.jsx';
import Journal from './pages/Journal.jsx';
import Accounts from './pages/Accounts.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner className="h-full" />;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="trades" element={<Trades />} />
        <Route path="trades/:id" element={<TradeDetail />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="reports" element={<Reports />} />
        <Route path="journal" element={<Journal />} />
        <Route path="accounts" element={<Accounts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
