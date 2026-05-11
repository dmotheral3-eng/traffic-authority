import React from 'react';
import { createRoot } from 'react-dom/client';
import TrafficAuthority from './TrafficAuthority.jsx';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <TrafficAuthority />
    </React.StrictMode>
  );
}
