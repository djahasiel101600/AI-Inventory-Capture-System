import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import { type ProductCapture } from '@/types/product';

interface ProductListProps {
  products: ProductCapture[];
  onExport: () => void;
  onRemove: (id: string) => void;
  onEdit?: (product: ProductCapture) => void;
}

export function ProductList({ products, onExport, onRemove, onEdit }: ProductListProps) {
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Captured Products ({products.length})</CardTitle>
          <Button onClick={onExport} disabled={products.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No products captured yet. Start by capturing your first product!
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-lg line-clamp-2">
                        {product.product_name}
                      </h4>
                      <p className="text-sm text-gray-600">{product.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(product)}
                          className="h-8 w-8 p-0"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(product.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {product.description}
                  </p>
                  
                  <div className="flex items-center justify-between pt-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {product.category}
                    </span>
                    <span className={`text-xs font-medium ${
                      product.confidence >= 0.85 
                        ? 'text-green-600' 
                        : 'text-yellow-600'
                    }`}>
                      {(product.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <div className="text-sm text-gray-600">
                <p className="font-semibold">Export Ready:</p>
                <p>All captured products will be exported as CSV with columns: 
                  product_name, unit, description, category, confidence</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}