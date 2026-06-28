import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import ServiceConfirmationForm from './client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx';

// Polyfill window and document
global.window = { location: { href: 'http://localhost/' } };
global.document = { createElement: () => ({}) };

async function run() {
  try {
    const html = renderToString(
      <StaticRouter location="/service-management/service-confirmation/new?order_id=1">
        <ServiceConfirmationForm />
      </StaticRouter>
    );
    console.log("Render successful");
  } catch (e) {
    console.error("Render failed:");
    console.error(e.stack);
  }
}
run();
