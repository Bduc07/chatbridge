
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const API_URL = 'http://localhost:5088/api/Auth'

export default function Register() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || data.title || 'Registration failed.')
      }

      navigate('/login', {
        state: { message: 'Account created. Please sign in.' },
      })
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

        <h1>Create your account</h1>
        <p className="auth-subtitle">Join ChatBridge and start connecting.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Choose a username"
            minLength={2}
            autoComplete="username"
            required
          />

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
            placeholder="At least 6 characters"
            minLength={6}
            autoComplete="new-password"
            required
          />

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
