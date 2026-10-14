
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const API_URL = 'http://localhost:5088/api/Auth'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || data.title || 'Login failed.')
      }

      if (!data.token) {
        throw new Error('The server did not return an authentication token.')
      }

      localStorage.setItem('chatbridge_token', data.token)
      navigate('/chat')
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Cannot connect to the server. Check that the backend is running.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-container">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">C</span>
          <span>ChatBridge</span>
        </div>

        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to continue your conversations.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </section>
    </main>
  )
}
