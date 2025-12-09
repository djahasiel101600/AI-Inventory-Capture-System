import { useState, useCallback, useEffect } from 'react';
import {CameraCapture} from './components/CameraCapture';
import { ProductForm } from './components/ProductForm';
import { ProductList } from './components/ProductList';
import { HistoryPage } from './components/HistoryPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from './components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { ExtractionResponse, ProductCapture } from './types/product';
import { api } from './lib/api';
import { ConnectionStatus } from './components/ConnectionsStatus';

function App() {
  const [products, setProducts] = useState<ProductCapture[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractionResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleCapture = useCallback(async (imageBlob: Blob) => {
    setIsProcessing(true);
    setAlert(null);

    try {
      const data = await api.extractProduct({
        image: imageBlob,
        session_id: sessionId
      });
      
      setExtractedData(data);
      
      if (data.confidence >= 0.85) {
        // Auto-accept high confidence results
        await handleSave(data);
      }
    } catch (error) {
      console.error('Extraction error:', error);
      showAlert('error', 'Failed to extract product information. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId]);

  // Load existing session products on mount so history persists across reloads
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const existing = await api.getSessionProducts(sessionId);
        if (mounted) setProducts(existing);
      } catch (e) {
        console.warn('Could not load session products:', e);
      }
    };
    load();
    return () => { mounted = false; };
  }, [sessionId]);

  const handleSave = async (productData: ExtractionResponse) => {
    try {
      // If the product already exists on the server (has an id), PATCH it
      let savedProduct: ProductCapture;
      if (productData.id) {
        savedProduct = await api.updateProduct(productData.id, productData);
      } else {
        // Fallback: if there's no id, just add the client-side object
        savedProduct = {
          ...productData,
          id: productData.id || `product_${Date.now()}`,
          image_url: productData.image_url || '',
          created_at: productData.created_at || new Date().toISOString(),
        } as ProductCapture;
      }

      setProducts(prev => {
        // replace if exists, else append
        const idx = prev.findIndex(p => p.id === savedProduct.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = savedProduct;
          return copy;
        }
        return [...prev, savedProduct];
      });

      setExtractedData(null);
      showAlert('success', 'Product saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      showAlert('error', 'Failed to save product.');
    }
  };

  const handleExport = async () => {
    try {
      const csvUrl = await api.exportCSV(sessionId);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = csvUrl;
      link.download = `inventory_export_${sessionId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showAlert('success', 'CSV exported successfully!');
    } catch (error) {
      showAlert('error', 'Failed to export CSV.');
    }
  };

  const handleRemove = (id: string) => {
    setProducts(prev => prev.filter(product => product.id !== id));
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <div className="flex justify-end mb-2">
            <ConnectionStatus />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            📦 AI Inventory Capture System
          </h1>
          <p className="text-gray-600">
            Capture product images and automatically extract information with AI
          </p>
        </header>

        {alert && (
          <Alert className={`mb-6 ${alert.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {alert.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className="ml-2">{alert.message}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="capture" className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="capture">Capture Products</TabsTrigger>
            <TabsTrigger value="review">Review ({products.length})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="capture" className="space-y-6">
            {extractedData && extractedData.confidence < 0.85 ? (
              <>
                <ProductForm
                  extractedData={extractedData}
                  onSubmit={handleSave}
                  onCancel={() => setExtractedData(null)}
                />
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => setExtractedData(null)}
                  >
                    Back to Camera
                  </Button>
                </div>
              </>
            ) : (
              <CameraCapture
                onCapture={handleCapture}
                isProcessing={isProcessing}
              />
            )}
          </TabsContent>

          <TabsContent value="review">
            <ProductList
              products={products}
              onExport={handleExport}
              onRemove={handleRemove}
            />
          </TabsContent>

            <TabsContent value="history">
              <HistoryPage 
                sessionId={sessionId}
                onProductUpdate={(updatedProducts) => {
                  // Sync with your main products state if needed
                  setProducts(updatedProducts);
                }}
              />
            </TabsContent>
        </Tabs>

        <footer className="mt-12 pt-8 border-t text-center text-gray-500 text-sm">
          <p>Confidence threshold: 85% • Products will auto-save above this threshold</p>
          <p className="mt-2">Need help? Ensure good lighting and clear product labels for best results.</p>
        </footer>
      </div>
    </div>
  );
}

export default App;