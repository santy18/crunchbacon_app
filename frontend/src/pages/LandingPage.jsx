import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: '#0A0A0A', color: '#fff', overflowX: 'hidden', minHeight: '100vh' }}>

      {/* Navigation */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#FF1E56' }}>
            <span className="text-2xl">{'\uD83E\uDD53'}</span>
          </div>
          <span className="text-2xl font-black tracking-tighter" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Crunch<span style={{ color: '#FF1E56' }}>Bacon</span>
          </span>
        </div>
        <div className="hidden md:flex space-x-8 font-semibold text-gray-400">
          <a href="#how-it-works" className="hover:text-white transition">How it Works</a>
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
        </div>
        <Link
          to="/app"
          className="px-6 py-2 rounded-full font-bold transition"
          style={{ background: '#fff', color: '#000', textDecoration: 'none' }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#e5e5e5'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
        >
          Open App
        </Link>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-16 pb-24 px-6 text-center max-w-5xl mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 opacity-10 blur-[100px]" style={{ background: '#FF1E56' }} />
        <h1 className="text-5xl md:text-8xl font-black leading-tight mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Ditch the Mic. <br />
          <span style={{ background: 'linear-gradient(90deg, #FF1E56 0%, #FFAC41 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Keep the Voice.
          </span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Clone your voice in 30 seconds. Generate studio-quality video content 10x faster just by typing. No more "bad takes"—just pure crunch.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link
            to="/app"
            className="text-white px-10 py-5 rounded-2xl font-black text-xl uppercase tracking-wider"
            style={{ background: '#FF1E56', textDecoration: 'none', transition: 'all 0.3s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 30, 86, 0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
          >
            Start Crunching Free
          </Link>
          <button className="bg-transparent border-2 border-gray-700 text-white px-10 py-5 rounded-2xl font-bold text-xl hover:border-gray-500 transition">
            Watch Demo
          </button>
        </div>
        <div className="mt-16 relative">
          <div className="rounded-3xl border-4 border-neutral-800 overflow-hidden shadow-2xl bg-neutral-900">
            <div className="bg-neutral-800 p-4 flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-xs text-gray-500 font-mono ml-4">app.crunchbacon.ai/editor</span>
            </div>
            <div className="flex flex-col md:flex-row h-96">
              <div className="w-full md:w-1/3 bg-neutral-900 border-r border-neutral-800 p-6 text-left">
                <div className="text-xs uppercase font-bold mb-4 tracking-widest" style={{ color: '#FF1E56' }}>Script Editor</div>
                <p className="text-gray-400 italic">"Hey guys, welcome back to the channel. Today we're looking at how to make bacon sizzle..."</p>
                <div className="mt-8 p-3 bg-neutral-800 rounded border border-neutral-700 text-xs text-gray-500">
                  Voice Clone: <span className="text-green-400">Active (98% Match)</span>
                </div>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center relative group">
                <div className="text-6xl group-hover:scale-110 transition duration-500">{'\uD83C\uDFAC'}</div>
                <div className="absolute bottom-4 right-4 text-white text-xs px-2 py-1 rounded font-bold animate-pulse" style={{ background: '#FF1E56' }}>
                  CRUNCHING...
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* The Problem: The Squeal */}
      <section className="py-24 px-6" style={{ background: '#0a0a0a' }}>
        <div className="max-w-4xl mx-auto text-center">
          <span className="font-bold uppercase tracking-widest text-sm" style={{ color: '#FFAC41' }}>The Struggle is Real</span>
          <h2 className="text-4xl md:text-5xl font-extrabold mt-4 mb-12" style={{ fontFamily: "'Outfit', sans-serif" }}>Stop Dealing with "The Squeal"</h2>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div className="p-8 rounded-3xl" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
              <div className="text-4xl mb-4">{'\uD83C\uDFA4'}</div>
              <h3 className="text-xl font-bold mb-2 text-white">Expensive Mics</h3>
              <p className="text-gray-400">Spending $500 on a setup just to sound "okay" is a trap. We give you studio quality for $0.</p>
            </div>
            <div className="p-8 rounded-3xl" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
              <div className="text-4xl mb-4">{'\uD83D\uDE2B'}</div>
              <h3 className="text-xl font-bold mb-2 text-white">Infinite Retakes</h3>
              <p className="text-gray-400">Stumbled on a word? Usually, you'd restart the scene. With us, you just edit the text.</p>
            </div>
            <div className="p-8 rounded-3xl" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A' }}>
              <div className="text-4xl mb-4">{'\u231B'}</div>
              <h3 className="text-xl font-bold mb-2 text-white">Editing Hell</h3>
              <p className="text-gray-400">Manual voice-to-video syncing takes hours. CrunchBacon does it in seconds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works: Clone, Script, Crunch */}
      <section id="how-it-works" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-6xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>3 Steps to Efficiency.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-12 relative">
          <div className="relative">
            <div className="text-8xl font-black absolute -top-10 -left-4" style={{ color: 'rgba(255,255,255,0.05)' }}>01</div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#FF1E56' }}>Clone</h3>
              <p className="text-gray-400 text-lg">Upload a 30-second clip of your voice. Our AI builds a pixel-perfect vocal profile instantly.</p>
            </div>
          </div>
          <div className="relative">
            <div className="text-8xl font-black absolute -top-10 -left-4" style={{ color: 'rgba(255,255,255,0.05)' }}>02</div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-4 text-white">Script</h3>
              <p className="text-gray-400 text-lg">Type your script. Change words, adjust tone, or swap entire paragraphs in the blink of an eye.</p>
            </div>
          </div>
          <div className="relative">
            <div className="text-8xl font-black absolute -top-10 -left-4" style={{ color: 'rgba(255,255,255,0.05)' }}>03</div>
            <div className="relative z-10">
              <h3 className="text-3xl font-bold mb-4" style={{ color: '#FFAC41' }}>Crunch</h3>
              <p className="text-gray-400 text-lg">Hit 'Crunch'. AI overlays your voice onto your footage with perfect lip-syncing and pacing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="features" className="py-24 px-6" style={{ background: '#0a0a0a' }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <h2 className="text-4xl md:text-5xl font-black mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Built for the <br /><span style={{ color: '#FF1E56' }}>Modern Creator.</span>
            </h2>
            <ul className="space-y-6" style={{ listStyle: 'none', padding: 0 }}>
              <li className="flex items-start space-x-4">
                <span className="p-1 rounded" style={{ background: 'rgba(255,30,86,0.2)', color: '#FF1E56' }}>{'\u2713'}</span>
                <div>
                  <span className="font-bold text-white text-lg">YouTubers:</span>
                  <p className="text-gray-400">Scale your channel without spending 40 hours in the recording booth.</p>
                </div>
              </li>
              <li className="flex items-start space-x-4">
                <span className="p-1 rounded" style={{ background: 'rgba(255,30,86,0.2)', color: '#FF1E56' }}>{'\u2713'}</span>
                <div>
                  <span className="font-bold text-white text-lg">Faceless Channels:</span>
                  <p className="text-gray-400">Get a professional, consistent voiceover without hiring expensive talent.</p>
                </div>
              </li>
              <li className="flex items-start space-x-4">
                <span className="p-1 rounded" style={{ background: 'rgba(255,30,86,0.2)', color: '#FF1E56' }}>{'\u2713'}</span>
                <div>
                  <span className="font-bold text-white text-lg">Course Creators:</span>
                  <p className="text-gray-400">Update your lessons by editing text, not re-filming entire modules.</p>
                </div>
              </li>
            </ul>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="h-48 bg-neutral-800 rounded-2xl flex items-center justify-center text-4xl">{'\uD83D\uDCF1'}</div>
            <div className="h-48 bg-neutral-800 rounded-2xl flex items-center justify-center text-4xl mt-12">{'\uD83D\uDCBB'}</div>
            <div className="h-48 bg-neutral-800 rounded-2xl flex items-center justify-center text-4xl -mt-12">{'\uD83C\uDFA7'}</div>
            <div className="h-48 bg-neutral-800 rounded-2xl flex items-center justify-center text-4xl">{'\uD83D\uDD25'}</div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black" style={{ fontFamily: "'Outfit', sans-serif" }}>Simple, Tasty Pricing.</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Creator Tier */}
          <div className="p-10 flex flex-col" style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '2rem' }}>
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-2">Creator</h3>
              <div className="text-5xl font-black mb-4">$29<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <p className="text-gray-400">For the soloist finding their rhythm.</p>
            </div>
            <ul className="space-y-4 mb-10 flex-1" style={{ listStyle: 'none', padding: 0 }}>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>10 Voice Clones</span></li>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>60 Mins of Content /mo</span></li>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>Standard Export (1080p)</span></li>
              <li className="flex items-center space-x-3 text-gray-600 line-through"><span>{'\uD83E\uDD53'}</span> <span>Commercial Rights</span></li>
            </ul>
            <button className="w-full border-2 border-gray-700 py-4 rounded-xl font-bold hover:bg-white hover:text-black transition">Get Started</button>
          </div>
          {/* Pro Tier */}
          <div className="p-10 flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #262626, #171717)', border: '2px solid #FF1E56', borderRadius: '2rem' }}>
            <div className="absolute top-4 right-4 text-white text-xs px-3 py-1 rounded-full font-bold" style={{ background: '#FF1E56' }}>MOST POPULAR</div>
            <div className="mb-8">
              <h3 className="text-2xl font-bold mb-2" style={{ color: '#FF1E56' }}>Pro</h3>
              <div className="text-5xl font-black mb-4 text-white">$79<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <p className="text-gray-400">For creators scaling into empires.</p>
            </div>
            <ul className="space-y-4 mb-10 flex-1" style={{ listStyle: 'none', padding: 0 }}>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>Unlimited Clones</span></li>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>Unlimited Content</span></li>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>4K Ultra-HD Export</span></li>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>Commercial Rights</span></li>
              <li className="flex items-center space-x-3"><span>{'\uD83E\uDD53'}</span> <span>Priority Rendering</span></li>
            </ul>
            <button
              className="w-full text-white py-4 rounded-xl font-black uppercase tracking-widest"
              style={{ background: '#FF1E56', transition: 'all 0.3s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 30, 86, 0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              Go Pro Now
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto p-12 md:p-20 text-center shadow-2xl relative overflow-hidden" style={{ background: 'linear-gradient(to right, #FF1E56, #FFAC41)', borderRadius: '3rem' }}>
          <div className="absolute -bottom-10 -right-10 opacity-20 rotate-12" style={{ fontSize: '10rem' }}>{'\uD83E\uDD53'}</div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-8" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Ready to bring <br />the heat?
          </h2>
          <p className="text-xl mb-10 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.9)' }}>
            Join 10,000+ creators who stopped recording and started crunching. Free trial, no credit card required.
          </p>
          <div className="inline-block p-2 rounded-2xl" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <Link
              to="/app"
              className="inline-block px-12 py-5 rounded-xl font-black text-xl shadow-lg"
              style={{ background: '#fff', color: '#000', textDecoration: 'none', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f3f3'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              CREATE FREE ACCOUNT
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-neutral-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center text-gray-600 space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2 grayscale opacity-50">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center text-sm">{'\uD83E\uDD53'}</div>
            <span className="font-bold tracking-tighter">CrunchBacon</span>
          </div>
          <div className="flex space-x-8 text-sm">
            <a href="#" className="hover:text-white transition">Privacy</a>
            <a href="#" className="hover:text-white transition">Terms</a>
            <a href="#" className="hover:text-white transition">Support</a>
            <a href="#" className="hover:text-white transition">API</a>
          </div>
          <div className="text-sm">&copy; 2024 CrunchBacon AI. Stop Recording. Start Crunching.</div>
        </div>
      </footer>
    </div>
  )
}
