import React, { useRef, useEffect, useState } from 'react'

type Props = { onCaptured: (p:any) => void }

export default function CameraCapture({ onCaptured }: Props){
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function start(){
      try{
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        setStream(s)
        if(videoRef.current) videoRef.current.srcObject = s
      }catch(e){
        setMessage('Camera access denied or not available')
      }
    }
    start()
    return () => { stream?.getTracks().forEach(t=>t.stop()) }
  },[])

  const capture = async () => {
    if(!videoRef.current || !canvasRef.current) return
    const v = videoRef.current
    const c = canvasRef.current
    c.width = v.videoWidth
    c.height = v.videoHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(v,0,0,c.width,c.height)
    const blob = await new Promise<Blob | null>(res => c.toBlob(b=>res(b),'image/jpeg',0.9))
    if(!blob) return

    const fd = new FormData()
    fd.append('image', blob, 'capture.jpg')

    setMessage('Uploading...')
    try{
      const resp = await fetch('/api/product/extract/', { method: 'POST', body: fd })
      const data = await resp.json()
      setMessage('Done')
      const item = {
        id: data.id,
        product_name: data.product_name,
        unit: data.unit,
        description: data.description,
        category: data.category,
        confidence: data.confidence
      }

      if(item.confidence < 0.85){
        // show simple editable form
        const corrected = await promptForEdit(item)
        onCaptured(corrected)
      }else{
        onCaptured(item)
      }
    }catch(e){
      setMessage('Upload failed')
    }
  }

  function promptForEdit(item: any){
    return new Promise(resolve => {
      const name = window.prompt('product_name', item.product_name) || item.product_name
      const unit = window.prompt('unit', item.unit) || item.unit
      const desc = window.prompt('description', item.description) || item.description
      const cat = window.prompt('category', item.category) || item.category
      const confStr = window.prompt('confidence (0-1)', String(item.confidence)) || String(item.confidence)
      const corrected = {...item, product_name: name, unit, description: desc, category: cat, confidence: parseFloat(confStr)}
      resolve(corrected)
    })
  }

  return (
    <div className="camera">
      <div className="viewport">
        <video ref={videoRef} autoPlay playsInline muted style={{width:'100%'}} />
        <canvas ref={canvasRef} style={{display:'none'}} />
      </div>
      <div className="controls">
        <button onClick={capture}>Capture Product</button>
        <div className="msg">{message}</div>
      </div>
    </div>
  )
}
