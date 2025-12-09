# AI Inventory Capture System — Project Requirements Document (PRD)

**Version:** 1.0
**Format:** Markdown (.md)
**Tech Stack:**

- **Frontend:** Vite React + TypeScript + Shadcn UI >
- **Backend:** Django Rest Framework (DRF)
- **AI Layer:** GPT‑4.1 Mini + OCR (Fallback)

I want you to strictly follow these documentations in building the app

1. Tailwindcss Documentation: Documentation: https://tailwindcss.com/docs/installation/using-vite
2. Shadcn Documentation: https://ui.shadcn.com/docs/installation/vite
3. Django Rest Framework Documentation: https://www.django-rest-framework.org/

---

# 1. Overview

The AI Inventory Capture System allows users to capture product images using a device camera and automatically extract essential product information using a hybrid **GPT Vision + OCR** approach. This information is validated through a confidence score. If the model is confident (≥85%), the system automatically proceeds to the next capture. If confidence is <85%, the user manually verifies and corrects the extracted fields.

When all product captures are completed, the system generates a **CSV file** that can be imported into an existing inventory system.

---

# 2. Core Goals

1. **Automate product data entry** using AI vision.
2. Ensure **high accuracy** with confidence scoring and user validation.
3. Provide a **fast capture workflow** for bulk product scanning.
4. Export all results as a **CSV file** for bulk inventory import.

---

# 3. Extracted Product Fields

Only the following information is required:

| Field            | Type   | Description                                                     |
| ---------------- | ------ | --------------------------------------------------------------- |
| **product_name** | string | The name of the product as seen on packaging                    |
| **unit**         | string | Size/quantity (e.g., "500g", "1L", "12pcs")                     |
| **description**  | string | Short text describing the item                                  |
| **category**     | enum   | One of: Food, Medicine, Drinks, Hygiene, Insecticide, Cleanings |

---

# 4. Target Users

- Small to medium businesses
- Store owners
- Inventory managers
- Anyone needing a faster way to encode product information

---

# 5. User Flow

## 5.1 Step-by-step

1. **Open the web app** (mobile-friendly).
2. Allow camera access.
3. User taps **“Capture Product”**.
4. System takes an image → sends to backend → backend uses GPT Vision + OCR.
5. Backend returns:

   - product_name
   - unit
   - description
   - category
   - confidence_score (0–1)

6. If **confidence ≥ 0.85 (85%)** → auto-confirm & prompt user to scan another product.
7. If **confidence < 85%** → show editable form with extracted fields.
8. User confirms or corrects values.
9. Repeat steps 3–8 for all products.
10. When done, user taps **“Finish & Export CSV”**.
11. System generates CSV and triggers file download.

---

# 6. System Components

## 6.1 Frontend (React + TypeScript + Shadcn UI)

- Camera view using `MediaDevices.getUserMedia()`
- Capture button
- API upload handler
- Editable form when confidence < 85%
- Table or list of collected products
- "Finish & Export" button
- Styling: Shadcn UI components

## 6.2 Backend (Django Rest Framework)

Endpoints:

### **POST /api/product/extract/**

- Accepts image (file upload)
- Runs OCR
- Sends image + OCR text to GPT-mini
- Extracts:

  - product_name
  - unit
  - description
  - category
  - confidence

### **GET /api/export/csv/**

- Returns a CSV file generated from stored session results

### **(Optional) POST /api/session/save/**

- Stores results temporarily in DB or memory

## 6.3 AI Layer

### Hybrid approach:

1. **OCR Layer** (Tesseract or ML Kit) — extracts raw text
2. **GPT Vision Layer** (GPT-4.1 mini)

   - Uses image + OCR text as combined input
   - Strict JSON schema output
   - Includes confidence score

---

# 7. Data Model

```ts
ProductCapture {
  id: string;
  image_url: string;
  product_name: string;
  unit: string;
  description: string;
  category: "Food" | "Medicine" | "Drinks" | "Hygiene" | "Insecticide" | "Cleanings";
  confidence: number; // 0–1
  created_at: datetime;
}
```

---

# 8. CSV Format

Generated CSV should contain:

```
product_name,unit,description,category,confidence
```

Example:

```
Bear Brand Fortified Milk,320g,Fortified powdered milk drink,Food,0.93
Safeguard Classic Soap,90g,Anti-bacterial soap bar,Hygiene,0.88
```

---

# 9. Acceptance Criteria

## 9.1 Functional

- [ ] User can access camera and capture image
- [ ] Image is uploaded to backend successfully
- [ ] OCR executes without blocking UI
- [ ] GPT returns structured data
- [ ] System displays confidence score
- [ ] If score < 0.85 → user can edit fields
- [ ] If score ≥ 0.85 → auto-accept
- [ ] User can capture multiple products
- [ ] CSV export generates correct file format

## 9.2 Non-functional

- System must work well on **mobile browsers**
- API should respond within **2–4 seconds**
- Confidence scores must be consistent and normalized
- Data validation must prevent empty required fields
- Should support unstable internet connections (retry-friendly)

---

# 10. Prompt Specification for GPT

The backend must send this structure:

```
"Analyze the following product image using vision and the provided OCR text.
Extract only these fields and return valid JSON:

- product_name
- unit
- description
- category (Food, Medicine, Drinks, Hygiene, Insecticide, Cleanings)
- confidence (0 to 1)

Use the image and OCR together. If uncertain, lower the confidence score.
Return JSON only."
```

GPT Payload includes:

- `image` (binary or base64)
- `ocr_text` (string)

---

# 11. Risks & Mitigation

| Risk                           | Mitigation                                     |
| ------------------------------ | ---------------------------------------------- |
| Poor lighting reduces accuracy | Show UX tips: “Good lighting helps”            |
| OCR misreads text              | GPT uses both image + OCR to correct mistakes  |
| Very generic packaging         | Uncertain results lowered via confidence score |
| Weak internet                  | Implement retry + reduced image size           |
| User errors                    | Allow manual editing                           |

---

# 12. Future Enhancements (Not included in v1)

- Barcode scanning
- Auto-category prediction improvements
- Offline mode (local model)
- Cloud storage for images
- Multi-language OCR

---

# 13. Final Summary

This PRD defines the full workflow, data structures, UI/UX behavior, backend responsibilities, and AI extraction logic for an AI-powered inventory capture system. The system uses camera capture + hybrid GPT Vision + OCR to extract essential product information with high accuracy and exports the final dataset as a CSV file.

This PRD should be used by **AI coding agents / GitHub Copilot Agents** as the authoritative blueprint for generating the full project implementation.

---

**End of Document**
