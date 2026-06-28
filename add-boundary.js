const fs = require('fs');
const file = 'client/src/pages/modules/service-management/service-confirmations/ServiceConfirmationForm.jsx';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(
  'export default function ServiceConfirmationForm',
  `class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() { 
    if (this.state.hasError) { 
      return (
        <div style={{padding: 20, background: 'white', color: 'red'}}>
          <h1>Form Error:</h1>
          <pre>{this.state.error.toString()}</pre>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    } 
    return this.props.children; 
  }
}

export default function ServiceConfirmationFormWrapper(props) {
  return <ErrorBoundary><ServiceConfirmationForm {...props} /></ErrorBoundary>;
}

function ServiceConfirmationForm`
);
fs.writeFileSync(file, c);
console.log('Added ErrorBoundary');
