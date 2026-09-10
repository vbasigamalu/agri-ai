# 🍅 Agri-AI: Tomato 10-Class Training Guide (Google Colab with NVIDIA CUDA)

This guide walks you through training all **10 Tomato disease classes** on a **free NVIDIA T4 GPU with CUDA** in **Google Colab**. 

> ⚡ **Speed:** All 20 epochs will finish in **~3 to 5 minutes** on an NVIDIA T4 GPU!

---

## The 10 Tomato Classes Trained:
1. `Tomato___Bacterial_spot`
2. `Tomato___Early_blight`
3. `Tomato___Late_blight`
4. `Tomato___Leaf_Mold`
5. `Tomato___Septoria_leaf_spot`
6. `Tomato___Spider_mites Two-spotted_spider_mite`
7. `Tomato___Target_Spot`
8. `Tomato___Tomato_Yellow_Leaf_Curl_Virus`
9. `Tomato___Tomato_mosaic_virus`
10. `Tomato___healthy`

---

## 🚀 4-Step Colab Instructions:

### Step 1: Open Google Colab
1. Go to [colab.research.google.com](https://colab.research.google.com).
2. Click **Upload** and upload:
   [`backend/ml_engine/Agri_AI_Tomato_Colab.ipynb`](Agri_AI_Tomato_Colab.ipynb)

---

### Step 2: Enable NVIDIA T4 GPU (CUDA)
In the Colab menu bar at the top:
1. Click **Runtime** -> **Change runtime type**.
2. Under **Hardware accelerator**, select **T4 GPU**.
3. Click **Save**.

---

### Step 3: Upload Dataset & Training Script
In the left sidebar of Colab, click the 📁 **Files icon**:
1. Drag and drop `colab_train_tomato.py` from `backend/ml_engine/`.
2. Drag and drop `tomato_dataset.zip` from `backend/ml_engine/`.

---

### Step 4: Run Training
Click **Runtime** -> **Run all** (or run each cell sequentially).
- The script automatically unzips the dataset.
- Trains **MobileNetV3-Large** with CUDA mixed precision AMP for 20 epochs.
- Generates `crop_disease_model.onnx` and `labels.json`.
- Automatically triggers the download of the trained model to your computer!

---

### Step 5: Replace Model in your Agri-AI Project
Move the downloaded files into your local project:
- Put `crop_disease_model.onnx` into `backend/ml_engine/`
- Put `labels.json` into `backend/ml_engine/`

Restart your server (`npm start` or `start.bat`). Your Agri-AI app is now running with your 20-epoch CUDA-trained Tomato model!
