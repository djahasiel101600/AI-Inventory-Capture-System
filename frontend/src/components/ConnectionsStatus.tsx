import { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const isConnected = await api.testConnection();
        setApiStatus(isConnected ? 'online' : 'offline');
      } catch {
        setApiStatus('offline');
      }
    };

    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <Badge variant="destructive" className="gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }

  if (apiStatus === 'offline') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        API Unavailable
      </Badge>
    );
  }

  if (apiStatus === 'checking') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Wifi className="h-3 w-3 animate-pulse" />
        Checking...
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
      <Wifi className="h-3 w-3" />
      Connected
    </Badge>
  );
}