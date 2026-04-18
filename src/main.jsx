import { StrictMode, Component } from 'react'
// PWA service worker — only registers if plugin is present
try {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      onNeedRefresh() {},
      onOfflineReady() { console.log('BiteERP: Ready to work offline') },
    })
  }).catch(() => {})
} catch (e) {}
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'monospace', color: '#f0ede8', background: '#0f0e0d', minHeight: '100vh' }}>
          <h2 style={{ color: '#d47060', marginBottom: '1rem' }}>Something went wrong</h2>
          <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: '#9b9690' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: '1rem', padding: '8px 16px', background: '#0D7377', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
