import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Send, ShieldAlert, CheckCircle, WifiOff, Sprout, Globe, Zap, FileText, XCircle } from 'lucide-react';
import axios from 'axios';
import { translations } from '../utils/i18n';

const Communication = () => {
  const [offline, setOffline] = useState(false);
  
  // SMS State
  const [phone, setPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');

  // Whatsapp State
  const [waLang, setWaLang] = useState('en');
  const tWa = translations[waLang] || translations['en'];

  // Last Analysis Data
  const [lastAnalysis, setLastAnalysis] = useState(null);

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        const res = await axios.get('http://localhost:5005/history');
        if (res.data && res.data.length > 0) setLastAnalysis(res.data[0]);
      } catch(err) {
        console.error('Failed to fetch history', err);
      }
    };
    fetchLatest();
  }, []);

  // AI Voice Auto-Fill Listener
  useEffect(() => {
    const handleAutoFill = (e) => {
      const num = e.detail;
      setPhone(num);
      const input = document.getElementById('comm-phone-input');
      if (input) {
         input.focus();
         input.style.color = '#10B981';
         input.style.borderColor = '#10B981';
         setTimeout(() => {
            input.style.color = 'var(--text-main)';
            input.style.borderColor = 'rgba(255,255,255,0.1)';
         }, 1500);
      }
    };
    window.addEventListener('fill_phone', handleAutoFill);
    return () => window.removeEventListener('fill_phone', handleAutoFill);
  }, []);

  // AI "Send SMS" Command Listener — auto-fills phone + last soil analysis message
  useEffect(() => {
    const handleSendSms = (e) => {
      const num = e.detail;
      if (num) setPhone(num);

      // Auto-fill message with last analysis
      if (lastAnalysis) {
        const crops = lastAnalysis.recommended_crops?.join(', ') || 'N/A';
        const tips = lastAnalysis.improvement_tips?.[0] || '';
        const quality = lastAnalysis.soil_quality || 'Unknown';
        const autoMsg = `SoilAI Alert:\nSoil Quality: ${quality}\nNitrogen: ${lastAnalysis.n}, Phosphorus: ${lastAnalysis.p}, Potassium: ${lastAnalysis.k}\npH: ${lastAnalysis.ph}\nRecommended Crops: ${crops}\nAction: ${tips}`;
        setSmsMessage(autoMsg);
        showToast('✅ Phone & soil analysis auto-filled by KrishiMitra AI!', 'success');
      } else {
        showToast('No soil analysis available yet. Run one first!', 'error');
      }

      // Highlight the phone input
      setTimeout(() => {
        const input = document.getElementById('comm-phone-input');
        if (input) {
          input.style.color = '#10B981';
          input.style.borderColor = '#10B981';
          setTimeout(() => {
            input.style.color = 'var(--text-main)';
            input.style.borderColor = 'rgba(255,255,255,0.1)';
          }, 1500);
        }
      }, 100);
    };
    window.addEventListener('send_sms', handleSendSms);
    return () => window.removeEventListener('send_sms', handleSendSms);
  }, [lastAnalysis]);

  const showToast = (msg, type = 'success') => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 4000);
  };

  const handleUseLastAnalysis = () => {
    if (!lastAnalysis) {
      showToast('No analysis data found. Run a soil analysis first!', 'error');
      return;
    }
    const crops = lastAnalysis.recommended_crops?.join(', ') || 'N/A';
    const tips = lastAnalysis.improvement_tips?.[0] || '';
    const quality = lastAnalysis.soil_quality || 'Unknown';
    const autoMsg = `SoilAI Alert:\nSoil Quality: ${quality}\nNitrogen: ${lastAnalysis.n}, Phosphorus: ${lastAnalysis.p}, Potassium: ${lastAnalysis.k}\npH: ${lastAnalysis.ph}\nRecommended Crops: ${crops}\nAction: ${tips}`;
    setSmsMessage(autoMsg);
    showToast('Message auto-filled from latest soil analysis!', 'success');
  };

  const handleSendSMS = async (e) => {
    e.preventDefault();
    if (!smsMessage.trim()) {
      showToast('Please enter a message or click "Use Last Analysis"', 'error');
      return;
    }
    setSmsSending(true);
    try {
      const res = await axios.post('http://localhost:5005/api/send-sms', { 
        phone, 
        message: smsMessage 
      });
      
      if (res.data.success) {
        showToast(`✅ SMS sent successfully! ID: ${res.data.request_id}`, 'success');
      }
    } catch(err) {
      const errMsg = err.response?.data?.error || 'Connection failed. Is the server running?';
      console.error('[SMS Frontend Error]:', errMsg);
      showToast(`❌ Failed: ${errMsg}`, 'error');
    } finally {
      setSmsSending(false);
    }
  };

  const toastColors = {
    success: '#10B981',
    error: '#EF4444',
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Top Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 className="heading" style={{ fontSize: '2rem' }}>Communication Hub</h1>
        <p className="subheading" style={{ maxWidth: '600px', margin: '0 auto' }}>Bridging the gap between technology and farmers through accessible communication.</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={() => setOffline(!offline)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: offline ? '#EF4444' : 'rgba(239, 68, 68, 0.1)', color: offline ? 'white' : '#EF4444', border: '1px solid #EF4444', borderRadius: '2rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
            <WifiOff size={16} /> {offline ? "Offline Active" : "Simulate Offline"}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem' }}>
        
        {/* ━━━ REAL SMS PANEL ━━━ */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', padding: '0.6rem', borderRadius: '0.6rem', color: 'white' }}>
              <Smartphone size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Send SMS Alert to Farmer</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>via Fast2SMS API • Real delivery</p>
            </div>
          </div>
          
          <form onSubmit={handleSendSMS} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>📱 Phone Number</label>
              <input 
                id="comm-phone-input"
                type="tel" value={phone} onChange={e => setPhone(e.target.value)} 
                placeholder="e.g. 9876543210" required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', outline: 'none', fontSize: '0.9rem', transition: 'all 0.3s' }} 
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>💬 Message</label>
                <button type="button" onClick={handleUseLastAnalysis} style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '1.5rem', padding: '0.3rem 0.75rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Zap size={12} /> Use Last Analysis
                </button>
              </div>
              <textarea 
                value={smsMessage} onChange={e => setSmsMessage(e.target.value)}
                placeholder="Type your message or click 'Use Last Analysis' to auto-fill from soil results..."
                rows={5}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.6rem', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', outline: 'none', fontSize: '0.85rem', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
              />
            </div>

            {smsMessage && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ background: 'rgba(59,130,246,0.06)', padding: '0.75rem', borderRadius: '0.6rem', borderLeft: '3px solid #3B82F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                  <FileText size={12} color="#3B82F6" />
                  <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', fontWeight: 800, color: '#64748B', letterSpacing: '0.5px' }}>SMS PREVIEW</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-line', margin: 0 }}>{smsMessage}</p>
              </motion.div>
            )}

            <button type="submit" disabled={smsSending} className="btn-primary" style={{ width: '100%', background: smsSending ? '#64748B' : 'linear-gradient(135deg, #3B82F6, #1D4ED8)', boxShadow: smsSending ? 'none' : '0 4px 15px rgba(59,130,246,0.3)', opacity: smsSending ? 0.7 : 1 }}>
              {smsSending ? (
                <><span className="animate-spin" style={{ display: 'inline-block' }}>⏳</span> Sending...</>
              ) : (
                <><Send size={16} /> Send SMS</>
              )}
            </button>
          </form>
          
          <AnimatePresence>
            {toast && (
              <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} style={{ position: 'absolute', bottom: '1rem', left: '1rem', right: '1rem', background: toastColors[toastType], color: 'white', padding: '0.8rem 1rem', borderRadius: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', fontSize: '0.82rem', boxShadow: `0 4px 12px ${toastColors[toastType]}40` }}>
                {toastType === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ━━━ WHATSAPP SIMULATOR ━━━ */}
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="glass" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '550px', background: '#e5ddd5', position: 'relative', overflow: 'hidden', border: '4px solid #1E293B', borderRadius: 'var(--radius)' }}>
          
          {offline && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.92)', zIndex: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center', backdropFilter: 'blur(8px)' }}>
              <ShieldAlert size={48} color="#EF4444" style={{ marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', color: 'white', marginBottom: '0.5rem', fontWeight: 800 }}>Internet Unavailable</h3>
              <p style={{ color: '#94A3B8' }}>Chat disabled. Use the SMS panel to reach farmers.</p>
            </div>
          )}

          <div style={{ background: '#075E54', color: 'white', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ background: 'white', color: '#075E54', padding: '0.4rem', borderRadius: '50%' }}><Sprout size={22} /></div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>{tWa.whatsapp_title}</h3>
                <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: 0 }}>online</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: 'rgba(255,255,255,0.15)', padding: '0.25rem 0.5rem', borderRadius: '1rem' }}>
              <Globe size={14} />
              <select value={waLang} onChange={(e) => setWaLang(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'white', fontWeight: 'bold', outline: 'none', cursor: 'pointer', maxWidth: '70px', fontSize: '0.8rem' }}>
                <option value="en" style={{color:'black'}}>EN</option>
                <option value="hi" style={{color:'black'}}>हिंदी</option>
                <option value="mr" style={{color:'black'}}>मराठी</option>
                <option value="bn" style={{color:'black'}}>বাংলা</option>
                <option value="te" style={{color:'black'}}>తెలుగు</option>
                <option value="ta" style={{color:'black'}}>தமிழ்</option>
                <option value="gu" style={{color:'black'}}>ગુજરાતી</option>
                <option value="kn" style={{color:'black'}}>ಕನ್ನಡ</option>
                <option value="pa" style={{color:'black'}}>ਪੰਜਾਬੀ</option>
              </select>
            </div>
          </div>

          <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
             <div style={{ alignSelf: 'flex-start', background: 'white', padding: '0.65rem 0.9rem', borderRadius: '0 0.75rem 0.75rem 0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', maxWidth: '85%', fontSize: '0.88rem', color: '#111827' }}>
               {tWa.greeting} 
             </div>
             <div style={{ alignSelf: 'flex-start', background: 'rgba(0,0,0,0.04)', padding: '0.5rem 0.75rem', borderRadius: '0.75rem', fontSize: '0.78rem', fontStyle: 'italic', color: '#6B7280' }}>
               Use the floating AI chatbot (bottom-right) for interactive conversations!
             </div>
          </div>

          <div style={{ background: '#f0f0f0', padding: '0.65rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ flex: 1, background: 'white', padding: '0.7rem 1rem', borderRadius: '2rem', color: '#9CA3AF', fontSize: '0.88rem' }}>
              Type a message...
            </div>
            <div style={{ background: '#128C7E', color: 'white', padding: '0.6rem', borderRadius: '50%', cursor: 'pointer' }}>
              <Send size={16} />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Communication;
