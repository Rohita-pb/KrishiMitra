from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import json
import os
import numpy as np

app = FastAPI(title="Soil ML Service")

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

# Globals for models
model = None
scaler = None
encoder = None
metrics_data = None

# Load models and metrics on startup
@app.on_event("startup")
def load_models():
    global model, scaler, encoder, metrics_data
    model_path = os.path.join(MODEL_DIR, "crop_xgb_model.pkl")
    scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
    encoder_path = os.path.join(MODEL_DIR, "label_encoder.pkl")
    metrics_path = os.path.join(MODEL_DIR, "metrics.json")
    
    if os.path.exists(model_path):
        model = joblib.load(model_path)
    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)
    if os.path.exists(encoder_path):
        encoder = joblib.load(encoder_path)
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            metrics_data = json.load(f)

class SoilInput(BaseModel):
    n: float
    p: float
    k: float
    temperature: float
    humidity: float
    ph: float
    rainfall: float
    moisture: float

def check_soil_health(data: SoilInput):
    tips = []
    issues = 0
    
    # Simple rule-based logic for Soil parameters
    # Ideal ranges: N (50-150), P (16-45), K (120-240), pH (6-7.5), Moisture (20-80)
    if data.n < 50:
        tips.append("Add Nitrogen-rich fertilizers like Urea.")
        issues += 1
    elif data.n > 150:
        tips.append("Reduce Nitrogen fertilizers; consider planting nitrogen-absorbing catch crops.")
        issues += 1
        
    if data.p < 16:
        tips.append("Add phosphorus-rich fertilizers like Bone Meal.")
        issues += 1
    elif data.p > 45:
        tips.append("Phosphorus is high; avoid adding P-fertilizers.")
        issues += 1
        
    if data.k < 120:
        tips.append("Add Potassium (Potash) to improve root growth and crop yield.")
        issues += 1
        
    if data.ph < 6.0:
        tips.append("Soil is acidic. Apply agricultural lime (crushed limestone).")
        issues += 1
    elif data.ph > 7.5:
        tips.append("Soil is alkaline. Add organic matter like compost or elemental sulfur.")
        issues += 1
        
    if data.moisture < 20:
        tips.append("Soil is too dry. Increase irrigation frequency and use mulch.")
        issues += 1
    elif data.moisture > 80:
        tips.append("Soil is waterlogged. Improve drainage systems.")
        issues += 1

    if issues == 0:
        quality = "Good"
        tips.append("Maintain current organic compost routines.")
    elif issues <= 2:
        quality = "Moderate"
    else:
        quality = "Poor"
        tips.append("Implement crop rotation using leguminous plants to restore balance naturally.")
        
    return quality, tips

@app.post("/api/predict")
def predict_crop(data: SoilInput):
    if not model or not scaler or not encoder:
        raise HTTPException(status_code=500, detail="Models not loaded. Please train the model first.")
    
    # 1. Soil Quality and Tips
    quality, tips = check_soil_health(data)
    
    # 2. Crop Prediction
    features = np.array([[data.n, data.p, data.k, data.temperature, data.humidity, data.ph, data.rainfall]])
    features_scaled = scaler.transform(features)
    
    # Get probabilities for top 2 crops
    probs = model.predict_proba(features_scaled)[0]
    top_2_indices = np.argsort(probs)[-2:][::-1]
    best_crops = encoder.inverse_transform(top_2_indices).tolist()
    
    # If soil is good, suggest high yield, else limit crops or suggest robust ones
    if quality == "Poor":
        # Maybe insert a tip for robust crops, but we still return what the model predicted
        tips.append(f"Consider growing soil-restoring crops alongside {best_crops[0]}.")
    elif quality == "Good":
        tips.append(f"Ideal conditions for high-yield {best_crops[0]}.")

    return {
        "soil_quality": quality,
        "recommended_crops": best_crops,
        "improvement_tips": tips,
        "model_accuracy": metrics_data.get("accuracy", 0) if metrics_data else None
    }

@app.get("/api/metrics")
def get_metrics():
    if not metrics_data:
        raise HTTPException(status_code=404, detail="Metrics not found. Train the model first.")
    return metrics_data
