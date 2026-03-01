import { useState, useEffect } from 'react'

const API = ''

function SocialAccountCard({ platform, onRefresh }) {
  const [clientKey, setClientKey] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [savedKey, setSavedKey] = useState(null)
  const [savedSecret, setSavedSecret] = useState(null)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    // Load existing masked values
    fetch(`${API}/settings/encrypted/${platform}_client_key`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSavedKey(d.masked))
      .catch(() => {})

    fetch(`${API}/settings/encrypted/${platform}_client_secret`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSavedSecret(d.masked))
      .catch(() => {})
  }, [platform])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (clientKey.trim()) {
        const res = await fetch(`${API}/settings/encrypted/${platform}_client_key`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: clientKey.trim() }),
        })
        if (res.ok) {
          const data = await res.json()
          setSavedKey(data.masked)
          setClientKey('')
        }
      }
      if (clientSecret.trim()) {
        const res = await fetch(`${API}/settings/encrypted/${platform}_client_secret`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: clientSecret.trim() }),
        })
        if (res.ok) {
          const data = await res.json()
          setSavedSecret(data.masked)
          setClientSecret('')
        }
      }
      onRefresh()
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await fetch(`${API}/social/oauth/${platform}/start`)
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        alert(err?.detail || 'Failed to start OAuth')
        return
      }
      const data = await res.json()
      window.open(data.authorization_url, '_blank', 'width=600,height=700')
    } catch (e) {
      alert('Failed to connect: ' + e.message)
    } finally {
      setConnecting(false)
    }
  }

  const displayName = platform.charAt(0).toUpperCase() + platform.slice(1)

  return (
    <div className="bg-bacon-card border border-neutral-700 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{displayName}</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Client Key</label>
          <input
            type="text"
            value={clientKey}
            onChange={(e) => setClientKey(e.target.value)}
            placeholder={savedKey || 'Enter client key...'}
            className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-bacon-pink"
          />
          {savedKey && !clientKey && (
            <p className="text-xs text-gray-500 mt-1">Saved: {savedKey}</p>
          )}
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={savedSecret || 'Enter client secret...'}
            className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-bacon-pink"
          />
          {savedSecret && !clientSecret && (
            <p className="text-xs text-gray-500 mt-1">Saved: {savedSecret}</p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || (!clientKey.trim() && !clientSecret.trim())}
            className="px-4 py-2 text-sm rounded bg-bacon-pink hover:brightness-110 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting || !savedKey}
            className="px-4 py-2 text-sm rounded bg-success hover:bg-success-hover text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? 'Connecting...' : `Connect ${displayName}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const [platforms, setPlatforms] = useState([])

  const loadPlatforms = () => {
    fetch(`${API}/social/platforms`)
      .then((r) => r.json())
      .then(setPlatforms)
      .catch(() => {})
  }

  useEffect(() => {
    loadPlatforms()
  }, [])

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Settings</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-1">Social Accounts</h2>
        <p className="text-gray-400 text-sm mb-4">
          Connect your social media accounts to publish videos directly from the editor.
        </p>

        <div className="space-y-4">
          {platforms.map((p) => (
            <div key={p.name}>
              <div className="flex items-center gap-2 mb-2">
                {p.connected && (
                  <span className="text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded">
                    Connected
                  </span>
                )}
                {!p.connected && p.has_credentials && (
                  <span className="text-xs bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded">
                    Credentials saved - not connected
                  </span>
                )}
              </div>
              <SocialAccountCard platform={p.name} onRefresh={loadPlatforms} />
            </div>
          ))}

          {platforms.length === 0 && (
            <SocialAccountCard platform="tiktok" onRefresh={loadPlatforms} />
          )}
        </div>
      </section>
    </div>
  )
}
