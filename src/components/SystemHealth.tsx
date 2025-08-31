import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/config';
import { apiCall } from '@/lib/api-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HealthStatus {
  api_connected: boolean;
  files_available: boolean;
  generation_completed: boolean;
  backup_available: boolean;
  last_checked: string;
  error?: string;
}

export function SystemHealth() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [checking, setChecking] = useState(false);
  
  const checkHealth = async () => {
    setChecking(true);
    try {
      // Check API connection
      const debugResponse = await apiCall(`${API_BASE}/debug/info`);
      const statusResponse = await apiCall(`${API_BASE}/generation/status`);
      
      if (debugResponse.success && statusResponse.success) {
        const debugData = debugResponse.data as { 
          upload_dir_contents?: string[]; 
          backup_dir_contents?: string[];
        };
        const statusData = statusResponse.data as { completed?: boolean };
        
        setHealth({
          api_connected: true,
          files_available: (debugData.upload_dir_contents?.length || 0) > 0,
          generation_completed: statusData.completed || false,
          backup_available: (debugData.backup_dir_contents?.length || 0) > 0,
          last_checked: new Date().toLocaleTimeString()
        });
      } else {
        setHealth({
          api_connected: false,
          files_available: false,
          generation_completed: false,
          backup_available: false,
          last_checked: new Date().toLocaleTimeString(),
          error: debugResponse.error || statusResponse.error || 'API connection failed'
        });
      }
    } catch (error) {
      setHealth({
        api_connected: false,
        files_available: false,
        generation_completed: false,
        backup_available: false,
        last_checked: new Date().toLocaleTimeString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setChecking(false);
    }
  };
  
  useEffect(() => {
    checkHealth();
  }, []);
  
  const getStatusIcon = (status: boolean, warning?: boolean) => {
    if (warning) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return status ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />;
  };
  
  const getStatusBadge = (status: boolean, warning?: boolean) => {
    if (warning) return <Badge variant="outline" className="text-yellow-600">Warning</Badge>;
    return status ? 
      <Badge variant="outline" className="text-green-600">OK</Badge> : 
      <Badge variant="destructive">Failed</Badge>;
  };
  
  if (!health) {
    return (
      <Alert>
        <AlertDescription>
          Checking system health...
        </AlertDescription>
      </Alert>
    );
  }
  
  const hasIssues = !health.api_connected || health.error;
  const hasWarnings = health.api_connected && !health.files_available && !health.backup_available;
  
  return (
    <Alert className={hasIssues ? 'border-red-200' : hasWarnings ? 'border-yellow-200' : 'border-green-200'}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <strong>System Health</strong>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={checkHealth}
              disabled={checking}
            >
              <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              {getStatusIcon(health.api_connected)}
              <span>API Connection</span>
              {getStatusBadge(health.api_connected)}
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(health.generation_completed)}
              <span>Generation</span>
              {getStatusBadge(health.generation_completed)}
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(health.files_available, !health.files_available && health.backup_available)}
              <span>Files Available</span>
              {getStatusBadge(health.files_available, !health.files_available && health.backup_available)}
            </div>
            
            <div className="flex items-center gap-2">
              {getStatusIcon(health.backup_available)}
              <span>Backup Available</span>
              {getStatusBadge(health.backup_available)}
            </div>
          </div>
          
          {health.error && (
            <AlertDescription className="text-red-600">
              <strong>Error:</strong> {health.error}
            </AlertDescription>
          )}
          
          <div className="text-xs text-muted-foreground">
            Last checked: {health.last_checked}
          </div>
        </div>
      </div>
    </Alert>
  );
}
