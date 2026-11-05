import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { BootScreen } from './components/layout/BootScreen';
import { ActivityLog } from './screens/ActivityLog';
import { Brief } from './screens/Brief';
import { ChangeFeed } from './screens/ChangeFeed';
import { Dominoes } from './screens/Dominoes';
import { Fixes } from './screens/Fixes';
import { Overview } from './screens/Overview';
import { ShipOverview } from './screens/ShipOverview';
import { WhatIf } from './screens/WhatIf';
import { AuthGate, useAuth } from './state/auth';
import { StoreProvider } from './state/store';

/** Installations are fleet-only: a CO's session carries no shore units, so the route goes home. */
function ShoreRoute() {
  return useAuth().isFleet ? <ShipOverview domain="installation" /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthGate>
    <StoreProvider>
      <BootScreen>
      {/* Hash routing works from any static file server, fully offline. */}
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<ShipOverview domain="ship" />} />
            <Route path="shore" element={<ShoreRoute />} />
            <Route path="missions" element={<Overview />} />
            <Route path="dominoes" element={<Dominoes />} />
            <Route path="fixes" element={<Fixes />} />
            <Route path="feed" element={<ChangeFeed />} />
            <Route path="what-if" element={<WhatIf />} />
            <Route path="brief" element={<Brief />} />
            <Route path="log" element={<ActivityLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
      </BootScreen>
    </StoreProvider>
    </AuthGate>
  );
}
