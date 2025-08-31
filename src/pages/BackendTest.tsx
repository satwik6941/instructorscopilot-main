import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { API_BASE } from "@/lib/config";
import { apiCall } from "@/lib/api-utils";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  data?: unknown;
}

export default function BackendTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runTests = async () => {
    setTesting(true);
    const testResults: TestResult[] = [
      { name: "Backend Connection", status: 'pending' },
      { name: "Debug Info", status: 'pending' },
      { name: "List Files", status: 'pending' },
      { name: "My Courses", status: 'pending' },
      { name: "Generation Status", status: 'pending' },
    ];
    setResults([...testResults]);

    // Test 1: Backend connection
    try {
      const response = await apiCall(`${API_BASE}/debug/info`);
      testResults[0] = {
        name: "Backend Connection",
        status: response.success ? 'success' : 'error',
        message: response.success ? 'Connected successfully' : response.error,
        data: response.data
      };
    } catch (error) {
      testResults[0] = {
        name: "Backend Connection",
        status: 'error',
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    }
    setResults([...testResults]);

    // Test 2: Debug info
    try {
      const response = await apiCall(`${API_BASE}/debug/info`);
      testResults[1] = {
        name: "Debug Info",
        status: response.success ? 'success' : 'error',
        message: response.success ? 'Debug info retrieved' : response.error,
        data: response.data
      };
    } catch (error) {
      testResults[1] = {
        name: "Debug Info",
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get debug info'
      };
    }
    setResults([...testResults]);

    // Test 3: List files
    try {
      const response = await apiCall(`${API_BASE}/files/course_material`);
      const filesData = response.data as { files?: unknown[] };
      testResults[2] = {
        name: "List Files",
        status: response.success ? 'success' : 'error',
        message: response.success ? `Found ${filesData?.files?.length || 0} files` : response.error,
        data: response.data
      };
    } catch (error) {
      testResults[2] = {
        name: "List Files",
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list files'
      };
    }
    setResults([...testResults]);

    // Test 4: My Courses
    try {
      const response = await apiCall(`${API_BASE}/my-courses`);
      const coursesData = response.data as { courses?: unknown[] };
      testResults[3] = {
        name: "My Courses",
        status: response.success ? 'success' : 'error',
        message: response.success ? `Found ${coursesData?.courses?.length || 0} courses` : response.error,
        data: response.data
      };
    } catch (error) {
      testResults[3] = {
        name: "My Courses",
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list my courses'
      };
    }
    setResults([...testResults]);

    // Test 5: Generation status
    try {
      const response = await apiCall(`${API_BASE}/generation/status`);
      testResults[4] = {
        name: "Generation Status",
        status: response.success ? 'success' : 'error',
        message: response.success ? 'Status endpoint working' : response.error,
        data: response.data
      };
    } catch (error) {
      testResults[4] = {
        name: "Generation Status",
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get status'
      };
    }
    setResults([...testResults]);

    setTesting(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return testing ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> : <AlertCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backend Integration Test</h1>
          <p className="text-muted-foreground">
            Test API connectivity and endpoint availability
          </p>
        </div>
        <Button onClick={runTests} disabled={testing}>
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            'Run Tests'
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Current backend settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="font-medium">API Base URL:</span>
              <code className="bg-muted px-2 py-1 rounded text-sm">{API_BASE}</code>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Environment:</span>
              <code className="bg-muted px-2 py-1 rounded text-sm">
                {import.meta.env.MODE}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Test Results</h2>
        {results.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No tests run yet. Click "Run Tests" to begin.</p>
            </CardContent>
          </Card>
        ) : (
          results.map((result, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <h3 className="font-medium">{result.name}</h3>
                      {result.message && (
                        <p className="text-sm text-muted-foreground">{result.message}</p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
                {result.data && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Response Data:</p>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
