import pandas as pd
import numpy as np
import os
import json
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

# Paths
DATA_PATH = r"c:\Users\Admin\Desktop\Soil\soil\Crop_recommendation.csv"
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    print("Loading data...")
    df = pd.read_csv(DATA_PATH)
    
    # We will use the exact columns present in the dataset to predict the crop.
    # The dataset has: N, P, K, temperature, humidity, ph, rainfall, label
    features = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    X = df[features]
    y = df['label']

    print(f"Data shape: {df.shape}")
    
    # Label encode the target variable (crops)
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Train test split
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y_encoded, test_size=0.2, random_state=42)
    
    # Build Ensemble Model (XGBoost + Random Forest)
    print("Training Ensemble Classifier (XGBoost + Random Forest)...")
    xgb = XGBClassifier(use_label_encoder=False, eval_metric='mlogloss', random_state=42)
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    
    # Voting classifier with soft voting to support predict_proba
    ensemble_model = VotingClassifier(estimators=[('xgb', xgb), ('rf', rf)], voting='soft')
    ensemble_model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = ensemble_model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred).tolist()
    
    print(f"Ensemble Model Accuracy: {acc * 100:.2f}%")
    
    # Save objects (keeping the name crop_xgb_model.pkl as per earlier plan for simplicity)
    model_path = os.path.join(MODEL_DIR, "crop_xgb_model.pkl")
    scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")
    encoder_path = os.path.join(MODEL_DIR, "label_encoder.pkl")
    
    joblib.dump(ensemble_model, model_path)
    joblib.dump(scaler, scaler_path)
    joblib.dump(le, encoder_path)
    print(f"Saved model to {model_path}")

    # Generate Metrics JSON
    metrics = {
        "accuracy": float(acc),
        "confusion_matrix": cm,
        "classes": le.classes_.tolist()
        # Note: VotingClassifier does not have feature_importances_ directly.
    }
    
    metrics_path = os.path.join(MODEL_DIR, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=4)
    print(f"Saved metrics to {metrics_path}")

if __name__ == "__main__":
    main()
