import axios from "axios";

import type { ExtractionResponse, ProductCapture } from "@/types/product";

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
});

function handleAxiosError(err: any) {
  if (err?.response?.data) return Promise.reject(err.response.data);
  return Promise.reject(err?.message || "Unknown error");
}

export const api = {
  // Upload image and request extraction. Accepts a Blob or File and session_id
  async extractProduct({
    image,
    session_id,
    max_items = 10,
  }: {
    image: Blob;
    session_id?: string;
    max_items?: number;
  }): Promise<ProductCapture[]> {
    const fd = new FormData();
    fd.append("image", image, "capture.jpg");
    if (session_id) fd.append("session_id", session_id);
    fd.append("max_items", String(max_items));

    try {
      const res = await apiClient.post("/product/extract/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as ProductCapture[];
    } catch (e) {
      return handleAxiosError(e);
    }
  },

  // Get products for a session
  async getSessionProducts(sessionId: string): Promise<ProductCapture[]> {
    try {
      const res = await apiClient.get("/session/products/", {
        params: { session_id: sessionId },
      });
      return res.data as ProductCapture[];
    } catch (e) {
      return handleAxiosError(e);
    }
  },

  // Update product by id (partial)
  async updateProduct(
    id: string,
    data: Partial<ExtractionResponse>
  ): Promise<ProductCapture> {
    try {
      const res = await apiClient.put(`/product/${id}/`, data);
      return res.data as ProductCapture;
    } catch (e) {
      return handleAxiosError(e);
    }
  },

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    try {
      await apiClient.delete(`/product/${id}/`);
    } catch (e) {
      return handleAxiosError(e);
    }
  },

  // Export CSV for a session. Returns an object URL string to download the CSV.
  async exportCSV(sessionId: string): Promise<string> {
    try {
      // The backend returns a CSV HttpResponse; request as blob so we can create a download URL
      const res = await apiClient.get("/export/csv/", {
        params: { session_id: sessionId },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      return URL.createObjectURL(blob);
    } catch (e) {
      return handleAxiosError(e);
    }
  },

  // Get list of sessions
  async getSessions(): Promise<
    { session_id: string; count: number; last_seen: string }[]
  > {
    try {
      const res = await apiClient.get("/sessions/");
      return res.data as {
        session_id: string;
        count: number;
        last_seen: string;
      }[];
    } catch (e) {
      return handleAxiosError(e);
    }
  },

  // Simple health-check that returns true/false
  async testConnection(): Promise<boolean> {
    try {
      const res = await apiClient.get("/health/");
      return !!res.data && res.status === 200;
    } catch (e) {
      return false;
    }
  },
};

export default api;
