import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading, useAuth } from './lib/ui';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Register })));
const Catalog = lazy(() => import('./pages/Catalog'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Shell = lazy(() => import('./app/Shell'));
const Dashboard = lazy(() => import('./app/Dashboard'));
const Pos = lazy(() => import('./app/Pos'));
const Inventory = lazy(() => import('./app/Inventory'));
const Moves = lazy(() => import('./app/Moves'));
const Sales = lazy(() => import('./app/Sales'));
const Cash = lazy(() => import('./app/Cash'));
const Reports = lazy(() => import('./app/Reports'));
const Settings = lazy(() => import('./app/Settings'));

function Private({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  return user ? children : <Navigate to="/entrar" replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/entrar" element={<Login />} />
        <Route path="/crear-cuenta" element={<Register />} />
        <Route path="/t/:slug" element={<Catalog />} />
        <Route
          path="/app"
          element={
            <Private>
              <Shell />
            </Private>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="caja" element={<Pos />} />
          <Route path="inventario" element={<Inventory />} />
          <Route path="movimientos" element={<Moves />} />
          <Route path="ventas" element={<Sales />} />
          <Route path="cierre" element={<Cash />} />
          <Route path="reportes" element={<Reports />} />
          <Route path="ajustes" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
