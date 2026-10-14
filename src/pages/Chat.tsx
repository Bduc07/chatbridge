import { useEffect, useRef, useState, type FormEvent } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { useNavigate } from 'react-router-dom'
import './Chat.css'

const API_URL = 'http://localhost:5088/api'
const HUB_URL = 'http://localhost:5088/chathub'

type User = {
  id: number
  username: string
  email: string
}

type Message = {
  id: number
  senderId: number
  receiverId: number
  content: string
  sentAt: string
}

type Profile = {
  id?: number
  userId?: number
}

export default function Chat() {
  const navigate = useNavigate()
  const token = localStorage.getItem('chatbridge_token')

  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Sidebar conversation information
  const [lastMessages, setLastMessages] = useState<Record<number, string>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({})
  const [lastActivity, setLastActivity] = useState<Record<number, number>>({})

  const connectionRef =
    useRef<ReturnType<typeof HubConnectionBuilder.prototype.build> | null>(null)

  const selectedUserRef = useRef<User | null>(null)
  const currentUserIdRef = useRef<number | null>(null)

  useEffect(() => {
    selectedUserRef.current = selectedUser
  }, [selectedUser])

  useEffect(() => {
    currentUserIdRef.current = currentUserId
  }, [currentUserId])

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    let active = true

    async function loadUsers() {
      try {
        // Get the currently logged-in user's profile.
        const profileResponse = await fetch(`${API_URL}/Profile/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!profileResponse.ok) {
          throw new Error(
            profileResponse.status === 401
              ? 'Your session has expired. Please sign in again.'
              : 'Could not load your profile.',
          )
        }

        const profile: Profile = await profileResponse.json()
        const myId = Number(profile.id ?? profile.userId)

        if (!Number.isFinite(myId) || myId <= 0) {
          throw new Error(
            'Could not identify your account. Check the Profile API response.',
          )
        }

        if (!active) return

        currentUserIdRef.current = myId
        setCurrentUserId(myId)

        // Load all users and exclude the logged-in account.
        const response = await fetch(`${API_URL}/Users`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Your session has expired. Please sign in again.'
              : 'Could not load users.',
          )
        }

        const data: User[] = await response.json()

        if (active) {
          setUsers(data.filter((user) => user.id !== myId))
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Could not load users.',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadUsers()

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => token,
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('ReceiveMessage', (message: Message) => {
      const myId = currentUserIdRef.current
      const selected = selectedUserRef.current

      if (myId === null) return

      // Determine which person this conversation belongs to.
      const otherUserId =
        message.senderId === myId ? message.receiverId : message.senderId

      // Update the sidebar preview and move this conversation to the top.
      setLastMessages((previous) => ({
        ...previous,
        [otherUserId]: message.content,
      }))

      setLastActivity((previous) => ({
        ...previous,
        [otherUserId]: Date.parse(message.sentAt) || Date.now(),
      }))

      const isIncoming = message.senderId !== myId
      const isViewingConversation = selected?.id === otherUserId

      // Only incoming messages in conversations that aren't open are unread.
      if (isIncoming && !isViewingConversation) {
        setUnreadCounts((previous) => ({
          ...previous,
          [otherUserId]: (previous[otherUserId] ?? 0) + 1,
        }))
      }

      // Add the message to the open conversation without duplicates.
      if (selected && selected.id === otherUserId) {
        setMessages((previous) => {
          if (previous.some((item) => item.id === message.id)) {
            return previous
          }

          return [...previous, message].sort(
            (a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt),
          )
        })
      }
    })

    connection
      .start()
      .then(() => {
        if (active) {
          connectionRef.current = connection
        }
      })
      .catch((err) => {
        if (active) {
          setError('Could not connect to real-time chat. Check the backend.')
        }
        console.error('SignalR connection error:', err)
      })

    return () => {
      active = false
      connectionRef.current = null
      void connection.stop()
    }
  }, [token, navigate])

  async function selectUser(user: User) {
    selectedUserRef.current = user
    setSelectedUser(user)
    setMessages([])
    setError('')

    // Clear unread count when opening this conversation.
    setUnreadCounts((previous) => ({
      ...previous,
      [user.id]: 0,
    }))

    try {
      const response = await fetch(`${API_URL}/Messages/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) {
        throw new Error('Could not load this conversation.')
      }

      const data: Message[] = await response.json()

      // Avoid duplicates if a live message arrives while history is loading.
      setMessages((previous) => {
        const combined = [...data, ...previous]
        const unique = new Map<number, Message>()

        combined.forEach((message) => unique.set(message.id, message))

        return [...unique.values()].sort(
          (a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt),
        )
      })

      // Use conversation history to populate the sidebar preview.
      if (data.length > 0) {
        const latest = [...data].sort(
          (a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt),
        )[0]

        setLastMessages((previous) => ({
          ...previous,
          [user.id]: latest.content,
        }))

        setLastActivity((previous) => ({
          ...previous,
          [user.id]: Date.parse(latest.sentAt) || 0,
        }))
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load messages.',
      )
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const messageContent = content.trim()
    const recipient = selectedUser
    const connection = connectionRef.current

    if (!messageContent || !recipient || !connection) {
      if (!connection) {
        setError('Chat connection is not ready. Please refresh the page.')
      }
      return
    }

    try {
      await connection.invoke(
        'SendMessage',
        String(recipient.id),
        messageContent,
      )

      setContent('')
      setError('')
    } catch (err) {
      console.error('Send message error:', err)
      setError('Message could not be sent. Check your connection.')
    }
  }

  function logout() {
    localStorage.removeItem('chatbridge_token')
    navigate('/login', { replace: true })
  }

  // Sort users by latest conversation activity.
  const sortedUsers = [...users].sort(
    (a, b) => (lastActivity[b.id] ?? 0) - (lastActivity[a.id] ?? 0),
  )

  return (
    <main className="chat-page">
      <header className="chat-header">
        <div className="chat-brand">
          <span className="chat-logo">C</span>
          <span>ChatBridge</span>
        </div>

        <button className="logout-button" onClick={logout}>
          Log out
        </button>
      </header>

      <section className="chat-layout">
        <aside className="users-panel">
          <h2>Messages</h2>
          <p className="panel-subtitle">Connect with people</p>

          {loading && <p className="muted">Loading users...</p>}

          {!loading && sortedUsers.length === 0 && !error && (
            <p className="muted">No other users found.</p>
          )}

          {sortedUsers.map((user) => {
            const unread = unreadCounts[user.id] ?? 0
            const preview = lastMessages[user.id]

            return (
              <button
                key={user.id}
                className={`user-item ${
                  selectedUser?.id === user.id ? 'selected' : ''
                }`}
                onClick={() => void selectUser(user)}
              >
                <span className="user-avatar">
                  {user.username.charAt(0).toUpperCase()}
                </span>

                <span className="user-info">
                  <strong>{user.username}</strong>
                  <small>{preview || user.email}</small>
                </span>

                {unread > 0 && (
                  <span className="unread-badge">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            )
          })}
        </aside>

        <section className="conversation-panel">
          {selectedUser ? (
            <>
              <div className="conversation-header">
                <span className="user-avatar">
                  {selectedUser.username.charAt(0).toUpperCase()}
                </span>

                <div>
                  <strong>{selectedUser.username}</strong>
                  <p>Chat with your connection</p>
                </div>
              </div>

              <div className="messages-area">
                {messages.length === 0 && (
                  <p className="empty-chat">
                    No messages yet. Say hello!
                  </p>
                )}

                {messages.map((message) => {
                  const isMine = message.senderId === currentUserId

                  return (
                    <div
                      key={message.id}
                      className={`message-row ${
                        isMine ? 'mine' : 'theirs'
                      }`}
                    >
                      <div className="message-bubble">
                        <p>{message.content}</p>
                        <small>
                          {new Date(message.sentAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form className="message-form" onSubmit={sendMessage}>
                <input
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={`Message ${selectedUser.username}...`}
                  aria-label="Message"
                  autoComplete="off"
                />

                <button type="submit" disabled={!content.trim()}>
                  Send
                </button>
              </form>
            </>
          ) : (
            <div className="no-conversation">
              <div className="empty-icon">✉</div>
              <h2>Your conversations</h2>
              <p>Select a person to start chatting.</p>
            </div>
          )}

          {error && <p className="chat-error">{error}</p>}
        </section>
      </section>
    </main>
  )
}