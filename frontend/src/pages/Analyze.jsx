import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Leaf, Droplets, Thermometer, Cloud, Zap, FlaskConical, CircleDot, CloudRain, RotateCcw, Cpu, ChevronDown, Sprout } from 'lucide-react';

// Average soil & environment values for common Indian crops (from agricultural research data)
const cropPresets = {
  '': { label: 'Select a crop to auto-fill...', n: 50, p: 25, k: 40, ph: 6.5, moisture: 50, temperature: 25, humidity: 60, rainfall: 100 },
  rice:       { label: '🌾 Rice',         n: 80,  p: 48,  k: 40,  ph: 6.5, moisture: 70, temperature: 24, humidity: 82, rainfall: 236 },
  wheat:      { label: '🌾 Wheat',        n: 85,  p: 60,  k: 45,  ph: 6.8, moisture: 50, temperature: 22, humidity: 60, rainfall: 90 },
  maize:      { label: '🌽 Maize',        n: 77,  p: 48,  k: 20,  ph: 6.2, moisture: 55, temperature: 23, humidity: 65, rainfall: 85 },
  cotton:     { label: '🧶 Cotton',       n: 120, p: 40,  k: 20,  ph: 7.0, moisture: 40, temperature: 30, humidity: 65, rainfall: 80 },
  sugarcane:  { label: '🎋 Sugarcane',    n: 100, p: 50,  k: 50,  ph: 6.5, moisture: 60, temperature: 28, humidity: 75, rainfall: 175 },
  jute:       { label: '🧵 Jute',         n: 80,  p: 40,  k: 40,  ph: 7.0, moisture: 70, temperature: 27, humidity: 85, rainfall: 175 },
  coffee:     { label: '☕ Coffee',       n: 100, p: 20,  k: 30,  ph: 6.0, moisture: 55, temperature: 25, humidity: 70, rainfall: 175 },
  tea:        { label: '🍵 Tea',          n: 80,  p: 35,  k: 30,  ph: 5.0, moisture: 65, temperature: 22, humidity: 80, rainfall: 200 },
  mango:      { label: '🥭 Mango',       n: 20,  p: 25,  k: 30,  ph: 5.8, moisture: 45, temperature: 31, humidity: 50, rainfall: 100 },
  banana:     { label: '🍌 Banana',       n: 100, p: 75,  k: 50,  ph: 6.0, moisture: 60, temperature: 27, humidity: 80, rainfall: 105 },
  pomegranate:{ label: '🍎 Pomegranate',  n: 20,  p: 10,  k: 40,  ph: 6.5, moisture: 35, temperature: 34, humidity: 45, rainfall: 55 },
  grapes:     { label: '🍇 Grapes',       n: 25,  p: 65,  k: 200, ph: 6.0, moisture: 40, temperature: 32, humidity: 60, rainfall: 70 },
  apple:      { label: '🍎 Apple',        n: 20,  p: 130, k: 200, ph: 6.0, moisture: 55, temperature: 22, humidity: 90, rainfall: 110 },
  coconut:    { label: '🥥 Coconut',      n: 20,  p: 10,  k: 30,  ph: 5.8, moisture: 50, temperature: 27, humidity: 95, rainfall: 175 },
  papaya:     { label: '🍈 Papaya',       n: 50,  p: 55,  k: 50,  ph: 6.5, moisture: 45, temperature: 33, humidity: 65, rainfall: 145 },
  orange:     { label: '🍊 Orange',       n: 20,  p: 10,  k: 10,  ph: 7.0, moisture: 40, temperature: 25, humidity: 75, rainfall: 110 },
  chickpea:   { label: '🫘 Chickpea',     n: 40,  p: 60,  k: 80,  ph: 7.0, moisture: 30, temperature: 18, humidity: 35, rainfall: 75 },
  lentil:     { label: '🫘 Lentil',       n: 20,  p: 60,  k: 20,  ph: 6.5, moisture: 35, temperature: 22, humidity: 50, rainfall: 50 },
  watermelon: { label: '🍉 Watermelon',   n: 100, p: 15,  k: 50,  ph: 6.5, moisture: 40, temperature: 30, humidity: 65, rainfall: 50 },
  muskmelon:  { label: '🍈 Muskmelon',    n: 100, p: 15,  k: 50,  ph: 6.5, moisture: 35, temperature: 32, humidity: 60, rainfall: 45 },
  kidneybeans:{ label: '🫘 Kidney Beans', n: 20,  p: 65,  k: 20,  ph: 5.8, moisture: 45, temperature: 20, humidity: 70, rainfall: 115 },
  mothbeans:  { label: '🫘 Moth Beans',   n: 20,  p: 45,  k: 20,  ph: 6.5, moisture: 30, temperature: 30, humidity: 45, rainfall: 45 },
};

const Analyze = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeParam, setActiveParam] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [presetApplied, setPresetApplied] = useState('');

  const defaults = { n: 50, p: 25, k: 40, ph: 6.5, moisture: 50, temperature: 25, humidity: 60, rainfall: 100 };
  const [formData, setFormData] = useState({ ...defaults });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: parseFloat(e.target.value) });
    setPresetApplied(''); // clear indicator when manual change
  };

  const handleReset = () => {
    setFormData({ ...defaults });
    setSelectedCrop('');
    setPresetApplied('');
  };

  const handleCropPreset = (cropKey) => {
    setSelectedCrop(cropKey);
    if (!cropKey) return;
    const preset = cropPresets[cropKey];
    setFormData({
      n: preset.n, p: preset.p, k: preset.k, ph: preset.ph,
      moisture: preset.moisture, temperature: preset.temperature,
      humidity: preset.humidity, rainfall: preset.rainfall,
    });
    setPresetApplied(preset.label);
    setTimeout(() => setPresetApplied(''), 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5005/predict', formData);
      navigate('/app/results', { state: { result: response.data, input: formData } });
    } catch (error) {
      console.error(error);
      alert('Error fetching prediction. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const parameters = [
    { name: 'n', label: 'Nitrogen (N)', min: 0, max: 150, unit: 'mg/kg', color: '#10B981', icon: <Leaf size={18} />, hint: 'Essential for leaf growth. Low N causes yellowing.' },
    { name: 'p', label: 'Phosphorus (P)', min: 0, max: 150, unit: 'mg/kg', color: '#3B82F6', icon: <FlaskConical size={18} />, hint: 'Drives root development and flowering.' },
    { name: 'k', label: 'Potassium (K)', min: 0, max: 250, unit: 'mg/kg', color: '#F59E0B', icon: <Zap size={18} />, hint: 'Strengthens disease resistance and yield.' },
    { name: 'ph', label: 'pH Level', min: 0, max: 14, step: 0.1, unit: '', color: '#8B5CF6', icon: <CircleDot size={18} />, hint: '6.0–7.0 is optimal. Affects nutrient absorption.' },
    { name: 'moisture', label: 'Moisture', min: 0, max: 100, unit: '%', color: '#0EA5E9', icon: <Droplets size={18} />, hint: 'Water retention level in the soil sample.' },
    { name: 'temperature', label: 'Temperature', min: -10, max: 50, unit: '°C', color: '#EF4444', icon: <Thermometer size={18} />, hint: 'Ambient air temperature at measurement time.' },
    { name: 'humidity', label: 'Humidity', min: 0, max: 100, unit: '%', color: '#14B8A6', icon: <Cloud size={18} />, hint: 'Relative humidity in the environment.' },
    { name: 'rainfall', label: 'Rainfall', min: 0, max: 300, unit: 'mm', color: '#6366F1', icon: <CloudRain size={18} />, hint: 'Average rainfall in the region (mm/year).' },
  ];

  const getFillPct = (param) => {
    const range = param.max - param.min;
    return ((formData[param.name] - param.min) / range) * 100;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', padding: '0.4rem 1rem', borderRadius: '2rem', color: '#10B981', fontWeight: 600, fontSize: '0.8rem', marginBottom: '1rem' }}>
          <Cpu size={14} /> ML-Powered Analysis
        </div>
        <h1 className="heading" style={{ fontSize: '2.2rem' }}>Soil Analysis Parameters</h1>
        <p className="subheading" style={{ maxWidth: '550px', margin: '0 auto' }}>Adjust the parameters below to match your field readings. Our AI ensemble will analyze the data in real-time.</p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ━━━ Crop Preset Picker ━━━ */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass"
          style={{ padding: '1.5rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <Sprout size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', margin: 0 }}>Quick Fill — Crop Presets</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Select a crop to auto-fill average soil & climate values</p>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={selectedCrop}
              onChange={(e) => handleCropPreset(e.target.value)}
              style={{
                width: '100%', padding: '0.85rem 1rem', borderRadius: '0.75rem',
                border: '1px solid var(--border)', background: 'var(--surface-alt)',
                color: selectedCrop ? 'var(--text-heading)' : 'var(--text-muted)',
                fontSize: '0.95rem', fontWeight: 600, outline: 'none', cursor: 'pointer',
                appearance: 'none',
              }}
            >
              {Object.keys(cropPresets).map(key => (
                <option key={key} value={key} style={{ color: 'var(--text-heading)', background: 'var(--surface)', padding: '8px' }}>
                  {cropPresets[key].label}
                </option>
              ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          </div>

          {/* Show NPK preview when a crop is selected */}
          <AnimatePresence>
            {selectedCrop && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: '1rem' }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'N', value: cropPresets[selectedCrop].n, color: '#10B981' },
                    { label: 'P', value: cropPresets[selectedCrop].p, color: '#3B82F6' },
                    { label: 'K', value: cropPresets[selectedCrop].k, color: '#F59E0B' },
                    { label: 'pH', value: cropPresets[selectedCrop].ph, color: '#8B5CF6' },
                    { label: 'Temp', value: `${cropPresets[selectedCrop].temperature}°`, color: '#EF4444' },
                    { label: 'Rain', value: `${cropPresets[selectedCrop].rainfall}mm`, color: '#6366F1' },
                  ].map((badge, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      background: `${badge.color}12`, color: badge.color,
                      padding: '0.35rem 0.7rem', borderRadius: '2rem',
                      fontSize: '0.75rem', fontWeight: 700,
                      border: `1px solid ${badge.color}25`,
                    }}>
                      {badge.label}: {badge.value}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Applied toast */}
          <AnimatePresence>
            {presetApplied && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                ✅ Values loaded for {presetApplied}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ━━━ Parameter Cards Grid ━━━ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {parameters.map((param, i) => {
            const fillPct = getFillPct(param);
            const isActive = activeParam === param.name;

            return (
              <motion.div
                key={param.name}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                onMouseEnter={() => setActiveParam(param.name)}
                onMouseLeave={() => setActiveParam(null)}
                className="glass"
                style={{
                  padding: '1.25rem 1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                  borderColor: isActive ? `${param.color}40` : undefined,
                  boxShadow: isActive ? `0 0 20px ${param.color}15` : undefined,
                }}
              >
                {/* Background fill bar */}
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${fillPct}%`,
                  background: `linear-gradient(90deg, ${param.color}08, ${param.color}12)`,
                  transition: 'width 0.3s ease',
                  pointerEvents: 'none',
                }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  {/* Top row: icon + label + value */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${param.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: param.color }}>
                        {param.icon}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-heading)', fontSize: '0.92rem' }}>{param.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 900, color: param.color }}>{formData[param.name]}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>{param.unit}</span>
                    </div>
                  </div>

                  {/* Slider */}
                  <input
                    type="range"
                    name={param.name}
                    min={param.min}
                    max={param.max}
                    step={param.step || 1}
                    value={formData[param.name]}
                    onChange={handleChange}
                    style={{ width: '100%', accentColor: param.color, height: '6px', cursor: 'pointer' }}
                  />

                  {/* Min/Max + Hint */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{param.min}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{param.max}</span>
                  </div>

                  {/* Tooltip-style hint */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ fontSize: '0.75rem', color: param.color, marginTop: '0.5rem', marginBottom: 0, lineHeight: 1.4, fontWeight: 500 }}
                      >
                        💡 {param.hint}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ━━━ Action Buttons ━━━ */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '0.85rem 1.5rem', borderRadius: '1rem', fontWeight: 700, fontSize: '0.95rem',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.3s',
            }}
          >
            <RotateCcw size={16} /> Reset Defaults
          </button>

          <button type="submit" className="btn-primary btn-glow" disabled={loading} style={{ padding: '0.85rem 3rem', fontSize: '1.05rem', minWidth: '250px' }}>
            {loading ? (
              <><Loader2 className="animate-spin" size={20} /> Processing...</>
            ) : (
              <><Cpu size={18} /> Run AI Analysis</>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

export default Analyze;
