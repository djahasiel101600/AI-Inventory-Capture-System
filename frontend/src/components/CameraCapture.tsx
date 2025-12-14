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
      // Request higher resolution where possible. Note: browsers/devices may ignore these.
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        // Wait for metadata so videoWidth/videoHeight are available
        await new Promise<void>((resolve) => {
          const onMeta = () => {
            // Ensure the video plays and fills the container
            try { videoRef.current?.play(); } catch (e) { /* ignore */ }
            resolve();
          };
          if (videoRef.current?.readyState && videoRef.current.readyState >= 1) {
            onMeta();
          } else {
            videoRef.current?.addEventListener('loadedmetadata', onMeta, { once: true });
          }
        });

        // Try to apply constraints to the active video track to request desired resolution.
        try {
          const [track] = mediaStream.getVideoTracks();
          if (track && typeof track.applyConstraints === 'function') {
            await track.applyConstraints({
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: { ideal: 'environment' }
            } as any);
          }
        } catch (e) {
          // Non-fatal: some browsers or devices won't allow applying constraints after getUserMedia
          console.debug('applyConstraints not supported or failed:', e);
        }
        // Ensure the element fills the container (inline style override)
        if (videoRef.current) {
          videoRef.current.style.width = '100%';
          videoRef.current.style.height = '100%';
          videoRef.current.style.objectFit = 'cover';
        }
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
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 480 }}>
            {stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400" style={{ minHeight: 480 }}>
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