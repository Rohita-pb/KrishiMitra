const express = require('express');
const cors = require('cors');
const { pool, initDB } = require('./db');
const axios = require('axios');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Database
initDB();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';

app.post('/predict', async (req, res) => {
  try {
    const { n, p, k, ph, moisture, temperature, humidity, rainfall } = req.body;

    // Optional: generate fake moisture if not provided (as per some use cases)
    const finalMoisture = moisture !== undefined ? moisture : (Math.random() * 80 + 10);
    // Optional: generate fake rainfall if not provided
    const finalRainfall = rainfall !== undefined ? rainfall : (Math.random() * 200 + 50);

    // 1. Insert into soil_data
    const insertSoilQuery = `
      INSERT INTO soil_data (n, p, k, ph, moisture, temperature, humidity, rainfall)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
    `;
    const soilResult = await pool.query(insertSoilQuery, [
      n, p, k, ph, finalMoisture, temperature, humidity, finalRainfall
    ]);
    const soilId = soilResult.rows[0].id;

    // 2. Call ML Service
    const mlPayload = {
      n, p, k, ph, moisture: finalMoisture, temperature, humidity, rainfall: finalRainfall
    };
    
    const mlResponse = await axios.post(`${ML_SERVICE_URL}/api/predict`, mlPayload);
    const { soil_quality, recommended_crops, improvement_tips, model_accuracy } = mlResponse.data;

    // 3. Insert into predictions
    const insertPredictionQuery = `
      INSERT INTO predictions (soil_id, soil_quality, recommended_crops, improvement_tips)
      VALUES ($1, $2, $3, $4) RETURNING id;
    `;
    await pool.query(insertPredictionQuery, [
      soilId,
      soil_quality,
      JSON.stringify(recommended_crops),
      JSON.stringify(improvement_tips)
    ]);

    // 4. Return the required output
    res.json({
      soil_quality,
      recommended_crops,
      improvement_tips,
      model_accuracy
    });

  } catch (error) {
    console.error("Error during prediction:", error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to process prediction.' });
  }
});

// REAL SMS — Fast2SMS API (No simulation)
app.post('/api/send-sms', async (req, res) => {
  try {
    const { phone, message } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Phone and message are required.' });
    }

    // Strip +91 or leading 0 — Fast2SMS needs raw 10-digit numbers
    const cleanNumber = phone.replace(/^\+?91/, '').replace(/^0/, '').trim();
    
    if (cleanNumber.length !== 10 || !/^\d+$/.test(cleanNumber)) {
      return res.status(400).json({ success: false, error: 'Enter a valid 10-digit Indian mobile number.' });
    }

    const apiKey = process.env.FAST2SMS_API_KEY;
    
    if (!apiKey) {
      console.error('[SMS FATAL] FAST2SMS_API_KEY not set in .env');
      return res.status(500).json({ success: false, error: 'SMS API key not configured on server.' });
    }

    console.log(`[SMS] Sending to: ${cleanNumber} | Message: ${message.substring(0, 50)}...`);

    const smsResponse = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: apiKey,
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanNumber,
      },
      headers: {
        'cache-control': 'no-cache',
      }
    });

    console.log('[SMS RESPONSE]:', JSON.stringify(smsResponse.data));

    if (smsResponse.data && smsResponse.data.return === true) {
      return res.json({ 
        success: true, 
        request_id: smsResponse.data.request_id,
        message: smsResponse.data.message?.[0] || 'SMS sent successfully',
      });
    } else {
      console.error('[SMS FAIL]:', smsResponse.data);
      return res.status(400).json({ 
        success: false, 
        error: smsResponse.data?.message || 'Fast2SMS rejected the request',
      });
    }

  } catch(error) {
    const errDetail = error.response?.data || error.message;
    console.error('[SMS ERROR]:', errDetail);
    return res.status(500).json({ 
      success: false, 
      error: typeof errDetail === 'string' ? errDetail : (errDetail?.message || 'Failed to send SMS. Check server logs.'),
    });
  }
});

app.get('/metrics', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/api/metrics`);
    // Optionally save to db if not already saved
    // ...
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching metrics:", error.message);
    res.status(500).json({ error: 'Failed to fetch metrics from ML service.' });
  }
});

app.get('/history', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.id as prediction_id,
        s.n, s.p, s.k, s.ph, s.moisture, s.temperature, s.humidity, s.rainfall,
        p.soil_quality, p.recommended_crops, p.improvement_tips, p.created_at
      FROM predictions p
      JOIN soil_data s ON p.soil_id = s.id
      ORDER BY p.created_at DESC
      LIMIT 50;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching history:", error.message);
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// ━━━━━━━━━━━━━━━ OTP AUTHENTICATION ━━━━━━━━━━━━━━━

// Generate a random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/send-otp — Generate OTP, store in DB, send via Fast2SMS
app.post('/api/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    const cleanNumber = phone.replace(/^\+?91/, '').replace(/^0/, '').trim();

    if (cleanNumber.length !== 10 || !/^\d+$/.test(cleanNumber)) {
      return res.status(400).json({ success: false, error: 'Enter a valid 10-digit Indian mobile number.' });
    }

    // Rate limit: max 5 OTPs per phone in last 10 minutes
    const rateCheck = await pool.query(
      `SELECT COUNT(*) FROM otp_store WHERE phone = $1 AND created_at > NOW() - INTERVAL '10 minutes'`,
      [cleanNumber]
    );
    if (parseInt(rateCheck.rows[0].count) >= 5) {
      return res.status(429).json({ success: false, error: 'Too many OTP requests. Please wait a few minutes.' });
    }

    // Check if farmer already exists
    const existingFarmer = await pool.query('SELECT id FROM farmers WHERE phone = $1', [cleanNumber]);
    const isNewUser = existingFarmer.rows.length === 0;

    // Generate OTP — using default '123456' for dev/testing (switch to generateOTP() when Fast2SMS is active)
    const otp = '123456'; // generateOTP();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

    // Invalidate any previous OTPs for this phone
    await pool.query('DELETE FROM otp_store WHERE phone = $1', [cleanNumber]);

    // Store new OTP
    await pool.query(
      'INSERT INTO otp_store (phone, otp, expires_at) VALUES ($1, $2, $3)',
      [cleanNumber, otp, expiresAt]
    );

    console.log(`[OTP] Generated for ${cleanNumber}: ${otp} (expires: ${expiresAt.toISOString()})`);

    // Send OTP via Fast2SMS
    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      console.error('[OTP FATAL] FAST2SMS_API_KEY not set in .env');
      // Still return success so dev/testing works (OTP is logged to console)
      return res.json({ success: true, isNewUser, message: 'OTP generated (SMS API key not configured — check server console for OTP).' });
    }

    const smsMessage = `Your SoilAI verification code is ${otp}. Do not share this with anyone. Code expires in 2 minutes.`;

    try {
      const smsResponse = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
        params: {
          authorization: apiKey,
          route: 'q',
          message: smsMessage,
          language: 'english',
          flash: 0,
          numbers: cleanNumber,
        },
        headers: { 'cache-control': 'no-cache' },
      });

      console.log('[OTP SMS RESPONSE]:', JSON.stringify(smsResponse.data));

      if (smsResponse.data && smsResponse.data.return === true) {
        return res.json({ success: true, isNewUser, message: 'OTP sent successfully.' });
      } else {
        console.error('[OTP SMS FAIL]:', smsResponse.data);
        // Still return success — OTP was stored, farmer can use it (logged to console)
        return res.json({ success: true, isNewUser, message: 'OTP generated. SMS delivery may be delayed.' });
      }
    } catch (smsErr) {
      console.error('[OTP SMS ERROR]:', smsErr.response?.data || smsErr.message);
      // OTP is still in DB and logged — allow verification
      return res.json({ success: true, isNewUser, message: 'OTP generated. SMS delivery may be delayed.' });
    }

  } catch (error) {
    console.error('[OTP ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Failed to send OTP. Please try again.' });
  }
});

// POST /api/verify-otp — Verify OTP and login/register farmer
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { phone, otp, name, village } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, error: 'Phone and OTP are required.' });
    }

    const cleanNumber = phone.replace(/^\+?91/, '').replace(/^0/, '').trim();

    if (cleanNumber.length !== 10 || !/^\d+$/.test(cleanNumber)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number.' });
    }

    if (otp.length !== 6 || !/^\d+$/.test(otp)) {
      return res.status(400).json({ success: false, error: 'Invalid OTP format.' });
    }

    // Find the OTP record
    const otpRecord = await pool.query(
      'SELECT * FROM otp_store WHERE phone = $1 AND otp = $2 AND verified = FALSE ORDER BY created_at DESC LIMIT 1',
      [cleanNumber, otp]
    );

    if (otpRecord.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid OTP. Please check and try again.' });
    }

    const record = otpRecord.rows[0];

    // Check expiry (2 minutes)
    if (new Date() > new Date(record.expires_at)) {
      // Clean up expired OTP
      await pool.query('DELETE FROM otp_store WHERE id = $1', [record.id]);
      return res.status(401).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }

    // Mark OTP as verified and clean up
    await pool.query('DELETE FROM otp_store WHERE phone = $1', [cleanNumber]);

    // Check if farmer exists or create new
    let farmer;
    const existingFarmer = await pool.query('SELECT * FROM farmers WHERE phone = $1', [cleanNumber]);

    if (existingFarmer.rows.length > 0) {
      // Existing farmer — update last login
      const updated = await pool.query(
        'UPDATE farmers SET last_login = NOW() WHERE phone = $1 RETURNING *',
        [cleanNumber]
      );
      farmer = updated.rows[0];
      console.log(`[AUTH] Farmer logged in: ${farmer.name || 'N/A'} (${cleanNumber})`);
    } else {
      // New farmer — create account
      const inserted = await pool.query(
        'INSERT INTO farmers (phone, name, village) VALUES ($1, $2, $3) RETURNING *',
        [cleanNumber, name || null, village || null]
      );
      farmer = inserted.rows[0];
      console.log(`[AUTH] New farmer registered: ${farmer.name || 'N/A'} (${cleanNumber})`);
    }

    return res.json({
      success: true,
      message: 'Login successful!',
      farmer: {
        id: farmer.id,
        phone: farmer.phone,
        name: farmer.name,
        village: farmer.village,
      }
    });

  } catch (error) {
    console.error('[VERIFY ERROR]:', error.message);
    return res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
  }
});

// ━━━━━━━━━━━━━━━ AI CHATBOT ━━━━━━━━━━━━━━━
app.post('/api/chat', async (req, res) => {
  try {
    const { message, lang_code, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server. Please add it to your .env file.' });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build context string from the passed context object (which is a history reading)
    const contextString = context 
      ? `Farmer's latest soil reading:
         Nitrogen: ${context.n}, Phosphorus: ${context.p}, Potassium: ${context.k}, pH: ${context.ph}
         Soil Quality: ${context.soil_quality}
         Recommended Crops: ${context.recommended_crops}
         Improvement Tips: ${context.improvement_tips}`
      : `No recent soil readings available.`;

    const systemPrompt = `You are KrishiMitra AI, a friendly, patient, and intelligent farming assistant designed for Indian farmers.
You speak in simple, clear language and always respond in the language code requested: ${lang_code || 'en'}.
You help farmers with: Soil health, Water recommendations, Crop suggestions, Fertilizer usage, Weather-related advice.
Avoid technical jargon. Keep answers short and practical. Give actionable advice. 
If unsure, guide the farmer step-by-step.
Your goal is to make farming easier, smarter, and stress-free.

You also have the ability to navigate the farmer throughout the web application if they ask to see specific pages or modules.
Available actions:
- "navigate_analyze": use when they want to analyze their soil or run a new test
- "navigate_results": use when they want to see their AI results
- "navigate_history": use when they want to see their past history or previous readings
- "navigate_insights": use when they want to see insights or charts
- "fill_phone:<NUMBER>": use when the user asks you to enter or type their mobile number. Extract the 10-digit number and append it. Example: "fill_phone:9920602745". Note: You are explicitly ALLOWED to handle and extract mobile numbers.
- "send_sms:<NUMBER>": use when the user asks to send an SMS, send soil report, send analysis, or send results to a phone number. Extract the 10-digit number. This will navigate to the SMS page, fill their number, and auto-attach the latest soil analysis in the message body. Example: "send_sms:9920602745".
- "none": use for all other queries, questions, or conversations where navigation or filling is not explicitly requested.

You MUST respond with a valid JSON document containing exactly two keys: "response" (your conversational reply in the correct language) and "action" (one of the action enum strings above).

Here is the farmer's current context:
${contextString}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: [{ text: message }] }
        ],
        config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
        }
    });

    const outputText = response.text;
    const parsed = JSON.parse(outputText);
    
    res.json({
      success: true,
      data: parsed
    });

  } catch (error) {
    console.error('[CHAT API ERROR]:', error.message);
    res.status(500).json({ success: false, error: 'Failure in KrishiMitra AI response.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Node.js Backend server running on port ${PORT}`);
});
