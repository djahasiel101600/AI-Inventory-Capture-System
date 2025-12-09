import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CameraCaptureProps {
  onCapture: (imageBlob: Blob) => Promise<void>;
  isProcessing: boolean;
}

export function CameraCapture({ onCapture, isProcessing }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Could not access camera. Please ensure camera permissions are granted.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (blob) {
        await onCapture(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                {error || 'Initializing camera...'}
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={captureImage}
              disabled={isProcessing || !stream}
              className="flex-1"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Product
                </>
              )}
            </Button>
            
            <Button
              onClick={startCamera}
              variant="outline"
              disabled={isProcessing}
            >
              Restart Camera
            </Button>
          </div>

          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <p className="font-semibold mb-1">📸 Tips for best results:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure good lighting on the product</li>
              <li>Keep the product centered in frame</li>
              <li>Avoid glare on packaging</li>
              <li>Make sure text is clear and readable</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}