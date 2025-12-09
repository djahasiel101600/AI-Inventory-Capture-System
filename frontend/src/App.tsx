import React, { useState } from 'react'
import CameraCapture from './components/CameraCapture'

type Product = {
  id: string
  product_name: string
  unit: string
  description: string
  category: string
  confidence: number
}

export default function App(){
  const [items, setItems] = useState<Product[]>([])

  function addItem(p: Product){
    setItems(prev => [p, ...prev])
  }

  return (
    <div className="app">
      <header>
        <h1>AI Inventory Capture</h1>
      </header>
      <main>
        <CameraCapture onCaptured={addItem} />

        <section>
          <h2>Captured Products</h2>
          <button onClick={() => window.location.href = '/api/export/csv/'}>Finish & Export CSV</button>
          <ul>
            {items.map(i => (
              <li key={i.id}>
                <strong>{i.product_name}</strong> — {i.unit} — {i.category} — {i.confidence}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
