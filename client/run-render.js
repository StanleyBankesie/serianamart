const React = require('react');
const { renderToString } = require('react-dom/server');
const { StaticRouter } = require('react-router-dom/server');
const Form = require('../compiled-form').default;

try {
  const html = renderToString(
    React.createElement(StaticRouter, { location: "/service-management/service-confirmation/new?order_id=1" }, 
      React.createElement(Form, null)
    )
  );
  console.log("Render successful. HTML length:", html.length);
} catch (e) {
  console.error("Render failed:");
  console.error(e.stack);
}
