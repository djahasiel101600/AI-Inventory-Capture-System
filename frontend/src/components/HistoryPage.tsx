import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Edit2, Loader2, RefreshCw, Calendar, Package } from 'lucide-react';
import type { ProductCapture, ExtractionResponse } from '@/types/product';
import { api } from '@/lib/api';
import { ProductForm } from './ProductForm';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectGroup,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface HistoryPageProps {
  sessionId: string;
  onProductUpdate?: (products: ProductCapture[]) => void;
}

export function HistoryPage({ sessionId, onProductUpdate }: HistoryPageProps) {
  const [products, setProducts] = useState<ProductCapture[]>([]);
  const [editing, setEditing] = useState<ProductCapture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ session_id: string; count: number; last_seen: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>(sessionId || 'default');

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSessionProducts(selectedSession);
      setProducts(data);
      if (onProductUpdate) {
        onProductUpdate(data);
      }
      setSuccess(`Loaded ${data.length} products`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to load history:', err);
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  // Load sessions list and selected session products
  useEffect(() => {
    let mounted = true;
    const loadSessions = async () => {
      try {
        const s = await api.getSessions();
        if (!mounted) return;
        setSessions(s);
        // If the initial sessionId exists in list, keep it; otherwise default to first available
        if (sessionId && s.some(x => x.session_id === sessionId)) {
          setSelectedSession(sessionId);
        } else if (s.length > 0) {
          setSelectedSession(s[0].session_id);
        }
      } catch (e) {
        console.warn('Failed to load sessions:', e);
      }
    };

    loadSessions();
    return () => { mounted = false; };
  }, [sessionId]);

  useEffect(() => {
    if (selectedSession) loadProducts();
  }, [selectedSession]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this product? This action cannot be undone.')) return;
    
    try {
      // We need to create a delete endpoint in the backend
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      setSuccess('Product deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      if (onProductUpdate) {
        onProductUpdate(products.filter(p => p.id !== id));
      }
    } catch (err: any) {
      console.error('Delete failed:', err);
      setError(err.message || 'Failed to delete product');
    }
  };

  const handleEdit = (product: ProductCapture) => {
    setEditing(product);
  };

  const handleSave = async (data: ExtractionResponse) => {
    try {
      // We need to create an update endpoint in the backend
      const updated = await api.updateProduct(data.id, data);
      setProducts(prev => prev.map(p => (p.id === updated.id ? updated : p)));
      setEditing(null);
      setSuccess('Product updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      
      if (onProductUpdate) {
        onProductUpdate(products.map(p => (p.id === updated.id ? updated : p)));
      }
    } catch (err: any) {
      console.error('Update failed:', err);
      setError(err.message || 'Failed to update product');
    }
  };

  const handleRefresh = () => {
    loadProducts();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return 'Unknown date';
    }
  };

  const calculateStats = () => {
    const total = products.length;
    const highConfidence = products.filter(p => p.confidence >= 0.85).length;
    const lowConfidence = total - highConfidence;
    const avgConfidence = total > 0 
      ? (products.reduce((sum, p) => sum + p.confidence, 0) / total * 100).toFixed(1)
      : '0';
    
    return { total, highConfidence, lowConfidence, avgConfidence };
  };

  const stats = calculateStats();

  return (
    <div className="space-y-6">
      {/* Stats and Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="h-6 w-6" />
                Session History
              </h2>
              <p className="text-gray-600 text-sm">
                Session ID: <code className="bg-gray-100 px-2 py-1 rounded">{selectedSession}</code>
              </p>
              <div className="mt-2">
                <label className="text-sm text-gray-600 mr-2">Select session:</label>
                <Select value={selectedSession} onValueChange={(v) => setSelectedSession(v)}>
                  <SelectTrigger className="ml-2 w-[320px]">
                    <SelectValue placeholder="Choose session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Sessions</SelectLabel>
                      {sessions.map((s) => (
                        <SelectItem key={s.session_id} value={s.session_id}>
                          <div className="flex items-center justify-between w-full">
                            <span className="truncate">{s.session_id}</span>
                            <span className="text-xs text-gray-500">{s.count} • {s.last_seen ? format(new Date(s.last_seen), 'MMM dd, yyyy') : '—'}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-gray-600">Total Products</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{stats.highConfidence}</div>
                <div className="text-sm text-gray-600">High Confidence</div>
              </div>
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>{success}</AlertDescription>
          <Button variant="ghost" size="sm" onClick={() => setSuccess(null)}>Dismiss</Button>
        </Alert>
      )}

      {/* Products List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Captured Products</span>
            <Badge variant="outline" className="font-normal">
              Avg Confidence: {stats.avgConfidence}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Loading history...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500">Start capturing products to see them here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {products.map((product) => (
                  <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg line-clamp-2 mb-1">
                            {product.product_name}
                          </h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="font-normal">
                              {product.unit}
                            </Badge>
                            <Badge 
                              className={`font-normal ${
                                product.confidence >= 0.85 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100' 
                                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                              }`}
                            >
                              {(product.confidence * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(product)}
                            title="Edit product"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(product.id)}
                            title="Delete product"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {product.description && (
                        <p className="text-gray-700 text-sm mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-normal">
                            {product.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDate(product.created_at)}
                          </span>
                        </div>
                        {product.image_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => window.open(product.image_url, '_blank')}
                          >
                            View Image
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary */}
              <div className="flex items-center justify-between pt-4 border-t text-sm text-gray-600">
                <div>
                  Showing {products.length} product{products.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div>
                    <span>High confidence (≥85%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-100 border border-yellow-300"></div>
                    <span>Needs verification</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Form Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <ProductForm
              extractedData={{
                id: editing.id,
                product_name: editing.product_name,
                unit: editing.unit,
                description: editing.description,
                category: editing.category,
                confidence: editing.confidence,
                image_url: editing.image_url,
              }}
              onSubmit={handleSave}
              onCancel={() => setEditing(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;