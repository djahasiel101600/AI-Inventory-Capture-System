export type ProductCategory = 'Food' | 'Medicine' | 'Drinks' | 'Hygiene' | 'Insecticide' | 'Cleanings';

export interface ProductCapture {
  id: string;
  image_url: string;
  product_name: string;
  unit: string;
  description: string;
  category: ProductCategory;
  confidence: number;
  created_at: string;
  session_id?: string;
}

export interface ExtractionResponse {
  id: string;
  product_name: string;
  unit: string;
  description: string;
  category: ProductCategory;
  confidence: number;
  image_url?: string;
  session_id?: string;
  created_at?: string;
}

// For form data
export interface ProductFormData {
  product_name: string;
  unit: string;
  description: string;
  category: ProductCategory;
  confidence: number;
}

// For session management
export interface Session {
  id: string;
  name: string;
  created_at: string;
  product_count: number;
}