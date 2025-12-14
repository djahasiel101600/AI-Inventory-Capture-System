import { useState, useCallback, useEffect } from 'react';
import {CameraCapture} from './components/CameraCapture';
import { ProductForm } from './components/ProductForm';
import { ProductList } from './components/ProductList';
import { HistoryPage } from './components/HistoryPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from './components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle } from 'lucide-react';
import type { ExtractionResponse, ProductCapture } from './types/product';
import { api } from './lib/api';
import { ConnectionStatus } from './components/ConnectionsStatus';

function App() {
  const [products, setProducts] = useState<ProductCapture[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractionResponse | null>(null);
  // queue of low-confidence items to review one-by-one
  const [reviewQueue, setReviewQueue] = useState<ExtractionResponse[]>([]);
  const [showReviewAll, setShowReviewAll] = useState(false);
  const [editableQueue, setEditableQueue] = useState<ExtractionResponse[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<import('./types/product').ProductCapture | null>(null);
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
      const items = await api.extractProduct({
        image: imageBlob,
        session_id: sessionId,
        max_items: 10,
      });

      if (Array.isArray(items) && items.length > 0) {
        const autoSaved = items.filter((it) => it.confidence >= 0.85);
        const needReview = items.filter((it) => it.confidence < 0.85);

        if (autoSaved.length > 0) {
          setProducts((prev) => [...prev, ...autoSaved]);
          showAlert('success', `Auto-saved ${autoSaved.length} item(s)`);
        }

        if (needReview.length > 0) {
          // Enqueue low-confidence items and show the first one
          setReviewQueue(needReview);
          setExtractedData(needReview[0]);
          showAlert('error', `Detected ${needReview.length} item(s) needing review`);
          // Prepare editable queue when multiple items need review
          if (needReview.length > 1) {
            setEditableQueue(needReview);
          }
        }
      } else {
        showAlert('error', 'No items detected.');
      }
    } catch (err) {
      console.error('Extraction error:', err);
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

      // Remove the saved item from review queue if present
      setReviewQueue((q) => q.filter((it) => it.id !== savedProduct.id));
      setExtractedData(null);
      showAlert('success', 'Product saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      showAlert('error', 'Failed to save product.');
    }
  };

  const nextReview = () => {
    setReviewQueue((q) => {
      const next = q.slice(1);
      setExtractedData(next.length > 0 ? next[0] : null);
      return next;
    });
  };

  const skipReview = () => {
    // Discard current and advance
    nextReview();
  };

  const handleSaveFromReview = async (data: ExtractionResponse) => {
    await handleSave(data);
    // After saving, advance to next review item
    nextReview();
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

  const handleEdit = (product: import('./types/product').ProductCapture) => {
    // Open modal with product pre-filled
    setEditingProduct(product);
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
                <div className="max-w-2xl mx-auto">
                  <div className="mb-2 text-sm text-gray-600">Reviewing {reviewQueue.length} item(s) — item {reviewQueue.findIndex(i => i.id === extractedData.id) + 1} of {reviewQueue.length}</div>
                </div>
                <ProductForm
                  extractedData={extractedData}
                  onSubmit={handleSaveFromReview}
                  onCancel={() => { setExtractedData(null); setReviewQueue([]); }}
                />
                <div className="text-center flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={skipReview}>Skip</Button>
                  <Button variant="secondary" onClick={() => setShowReviewAll(true)} disabled={reviewQueue.length <= 1}>Review All</Button>
                  <Button variant="ghost" onClick={() => { setExtractedData(null); setReviewQueue([]); setEditableQueue([]); }}>Cancel Review</Button>
                </div>
              </>
            ) : (
              <CameraCapture
                onCapture={handleCapture}
                isProcessing={isProcessing}
              />
            )}
          </TabsContent>

          {/* Review All modal / panel */}
          {showReviewAll && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40">
              <div className="bg-white rounded-lg w-full max-w-4xl max-h-[85vh] overflow-y-auto p-6">
                <h3 className="text-lg font-semibold mb-4">Review All ({editableQueue.length} items)</h3>
                <div className="space-y-4">
                  {editableQueue.map((item, idx) => (
                    <div key={item.id || idx} className="border p-4 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-medium">Item {idx + 1}</div>
                        <div className="text-sm text-gray-500">Confidence: {(item.confidence * 100).toFixed(1)}%</div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">Product Name</label>
                          <Input value={item.product_name} onChange={(e) => {
                            const copy = [...editableQueue];
                            copy[idx] = { ...copy[idx], product_name: e.target.value };
                            setEditableQueue(copy);
                          }} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Unit</label>
                          <Input value={item.unit} onChange={(e) => {
                            const copy = [...editableQueue];
                            copy[idx] = { ...copy[idx], unit: e.target.value };
                            setEditableQueue(copy);
                          }} />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium">Description</label>
                          <Textarea value={item.description} onChange={(e) => {
                            const copy = [...editableQueue];
                            copy[idx] = { ...copy[idx], description: e.target.value };
                            setEditableQueue(copy);
                          }} rows={3} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Category</label>
                          <Input value={item.category} onChange={(e) => {
                            const copy = [...editableQueue];
                            copy[idx] = { ...copy[idx], category: e.target.value as unknown as import('./types/product').ProductCategory };
                            setEditableQueue(copy);
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setShowReviewAll(false)}>Close</Button>
                  <Button variant="outline" onClick={() => { setEditableQueue(reviewQueue); }}>Reset</Button>
                  <Button onClick={async () => {
                    // Save all edited items sequentially to preserve order
                    for (const it of editableQueue) {
                      await handleSave(it);
                    }
                    // Clear queue and close
                    setEditableQueue([]);
                    setReviewQueue([]);
                    setExtractedData(null);
                    setShowReviewAll(false);
                    showAlert('success', `Saved ${editableQueue.length} item(s)`);
                  }}>Save All</Button>
                </div>
              </div>
            </div>
          )}

          <TabsContent value="review">
            <ProductList
              products={products}
              onExport={handleExport}
              onRemove={handleRemove}
              onEdit={handleEdit}
            />
          </TabsContent>

          {/* Edit modal for already-saved products */}
          {editingProduct && (
            <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/40">
              <div className="bg-white rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6">
                <h3 className="text-lg font-semibold mb-4">Edit Product</h3>
                <ProductForm
                  extractedData={editingProduct}
                  isLoading={isProcessing}
                  onCancel={() => setEditingProduct(null)}
                  onSubmit={async (data) => {
                    await handleSave(data);
                    setEditingProduct(null);
                  }}
                />
              </div>
            </div>
          )}

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