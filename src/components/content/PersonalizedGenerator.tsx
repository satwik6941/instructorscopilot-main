import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wand2, Upload, BookOpen, Target, Brain, Sparkles, FilePlus, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { UploadBoxBig } from "../ui/upload-box-big";
import { UploadBoxSmall } from "../ui/upload-box-small";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE, API_TIMEOUT } from "@/lib/config";

interface ContentRequest {
  topic: string;
  contentType: 'lesson' | 'explanation' | 'practice' | 'summary';
  difficulty: number | null;
  duration: number;
  teachingStyle: string | null; 
  curriculumFileSelected: boolean; 
  curriculumFileName: string | null;
}

export function PersonalizedGenerator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [contentRequest, setContentRequest] = useState<ContentRequest>({
    topic: '',
    contentType: 'lesson',
    difficulty: null,
    duration: 0,
    teachingStyle: null,
    curriculumFileSelected: false,
    curriculumFileName: null,
  });

  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Derived state to check if all mandatory fields are filled
  const canGenerate = 
    contentRequest.topic.trim() !== '' &&
    contentRequest.difficulty !== null &&
    contentRequest.teachingStyle !== null &&
    contentRequest.curriculumFileSelected &&
    contentRequest.duration > 0;

  // File validation handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, allowedTypes: string[], label: string) => {
    console.log(`handleFileChange called for: ${label}`);
    const file = e.target.files?.[0];
    console.log("Selected file:", file);

    if (!file) {
      setContentRequest(prev => ({
        ...prev,
        curriculumFileSelected: false,
        curriculumFileName: null,
      }));
      setUploadedFile(null);
      return;
    }

    // Validate file type
    if (!allowedTypes.some(type => file.name.toLowerCase().endsWith(type))) {
      console.log("File validation failed for:", file.name);
      toast({
        title: 'Invalid file type',
        description: `Please upload a valid file (${allowedTypes.join(', ')})`,
        variant: 'destructive',
      });
      e.target.value = '';
      setContentRequest(prev => ({
        ...prev,
        curriculumFileSelected: false,
        curriculumFileName: null,
      }));
      setUploadedFile(null);
      return;
    }

    console.log("File validation passed for:", file.name);
    setUploadedFile(file);
    setContentRequest(prev => ({
      ...prev,
      curriculumFileSelected: true,
      curriculumFileName: file.name,
    }));

    toast({
      title: "File Selected",
      description: `${file.name} is ready to upload`,
    });
  };

  const generatePersonalizedContent = async () => {
    if (!canGenerate) {
      toast({
        title: "Missing Information",
        description: "Please enter all mandatory details to generate course content.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate content.",
        variant: "destructive"
      });
      return;
    }

    if (!uploadedFile) {
      toast({
        title: "File Required",
        description: "Please select a curriculum file before generating content.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create AbortController for timeout management
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      // Step 1: Upload curriculum and create config
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('user_name', user.user_metadata?.full_name || user.email || 'Unknown User');
      formData.append('user_id', user.email || user.id);
      formData.append('course_topic', contentRequest.topic);
      formData.append('no_of_weeks', contentRequest.duration.toString());
      formData.append('difficulty_level', getDifficultyLabel(contentRequest.difficulty));
      formData.append('teaching_style', getTeachingStyleLabel(contentRequest.teachingStyle));

      console.log('Uploading curriculum with data:', {
        user_name: user.user_metadata?.full_name || user.email || 'Unknown User',
        user_id: user.email || user.id,
        course_topic: contentRequest.topic,
        no_of_weeks: contentRequest.duration,
        difficulty_level: getDifficultyLabel(contentRequest.difficulty),
        teaching_style: getTeachingStyleLabel(contentRequest.teachingStyle),
        api_base: API_BASE
      });

      const uploadResponse = await fetch(`${API_BASE}/upload-curriculum/`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let errorMessage = "File upload failed.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const uploadResult = await uploadResponse.json();
      console.log('Upload successful:', uploadResult);

      toast({
        title: "Upload Successful",
        description: "Starting content generation...",
      });

      // Step 2: Generate content with better error handling
      const generateResponse = await fetch(`${API_BASE}/generate-content/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        let errorMessage = "Content generation failed.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const generateResult = await generateResponse.json();
      console.log('Generation successful:', generateResult);

      // Step 3: Wait for completion and fetch preview
      await waitForGenerationCompletion();

      // Step 4: Create course automatically after successful generation
      try {
        const courseResponse = await fetch(`${API_BASE}/courses/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (courseResponse.ok) {
          const courseResult = await courseResponse.json();
          console.log('Course created successfully:', courseResult);
        }
      } catch (e) {
        console.warn('Failed to create course entry:', e);
        // Don't fail the whole process if course creation fails
      }

      // Step 5: Fetch real preview text
      try {
        const previewResp = await fetch(`${API_BASE}/course-material/preview`);
        if (previewResp.ok) {
          const previewData = await previewResp.json();
          setGeneratedContent(previewData.preview || 'Content generated successfully! Check the dashboard for files.');
        } else {
          // Fallback to summary if preview not available
          const contentSummary = `# ${contentRequest.topic} - Course Generation Complete\n\n✅ Content generated successfully!\n\nFiles created: ${generateResult.total_files || 'Multiple'}\n\nCheck the Dashboard and My Courses to view and download your materials.`;
          setGeneratedContent(contentSummary);
        }
      } catch (e) {
        const contentSummary = `# ${contentRequest.topic} - Course Generation Complete\n\n✅ Content generated successfully!\n\nCheck the Dashboard and My Courses to view and download your materials.`;
        setGeneratedContent(contentSummary);
      }

      toast({
        title: "Content Generated Successfully!",
        description: `Generated ${generateResult.total_files || 'multiple'} course files. Course saved to "My Courses".`,
      });

    } catch (error: unknown) {
      console.error('Generation error:', error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to generate content. Please check your internet connection and try again.";
      
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: "Generation Timeout",
          description: "The generation process took too long. Please try again or contact support.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Generation Failed",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper function to wait for generation completion
  const waitForGenerationCompletion = async (maxWaitTime = 300000) => { // 5 minutes max
    const startTime = Date.now();
    const pollInterval = 3000; // 3 seconds
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const statusResp = await fetch(`${API_BASE}/generation/status`);
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          if (statusData.completed) {
            return true;
          }
        }
      } catch (e) {
        console.warn('Status check failed:', e);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Generation process timed out');
  };

  const getDifficultyLabel = (difficulty: number | null): string => {
    switch (difficulty) {
      case 1: return "Foundational";
      case 2: return "Intermediate";
      case 3: return "Advanced";
      default: return "Unknown";
    }
  };

  const getTeachingStyleLabel = (style: string | null): string => {
    switch (style) {
      case "exploratory": return "Exploratory & Guided";
      case "project": return "Project-Based / Hands-On";
      case "conceptual": return "Conceptual & Conversational";
      default: return "Unknown";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Course Content Generator</h1>
        <p className="text-muted-foreground mt-1">
          AI-accelerated course generation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Required Inputs - now on the left */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-foreground" />
              Course Structure & Teaching style
            </CardTitle>
            <CardDescription>
              Define your course topic, duration, and preferred teaching approach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">
                Course Topic <span className="text-red-500">*</span>
              </Label>
              <Input
                id="topic"
                placeholder="e.g., Introduction to React Development"
                value={contentRequest.topic}
                onChange={(e) => setContentRequest(prev => ({ ...prev, topic: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">
                Course Duration (weeks) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="52"
                value={contentRequest.duration}
                onChange={(e) => setContentRequest(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">
                Difficulty Level <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={contentRequest.difficulty?.toString() || ''} 
                onValueChange={(value) => setContentRequest(prev => ({ ...prev, difficulty: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Foundational</SelectItem>
                  <SelectItem value="2">Intermediate</SelectItem>
                  <SelectItem value="3">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teaching-style">
                Teaching Style <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={contentRequest.teachingStyle || ''} 
                onValueChange={(value) => setContentRequest(prev => ({ ...prev, teachingStyle: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teaching style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exploratory">Exploratory & Guided</SelectItem>
                  <SelectItem value="project">Project-Based / Hands-On</SelectItem>
                  <SelectItem value="conceptual">Conceptual & Conversational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Curriculum Upload - now on the right */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-foreground" />
              Curriculum Materials
            </CardTitle>
            <CardDescription>
              Upload your curriculum documents for analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadBoxSmall
              id="curriculum"
              label="Upload curriculum document"
              fileTypesText="Upload PDF file"
              allowedTypes={['.pdf']}
              onFileChange={handleFileChange}
              fileName={contentRequest.curriculumFileName}
            />
          </CardContent>
        </Card>
      </div>

      {/* Generated Content - now below both panels, centered and full width */}
      <div className="flex justify-center">
        <div className="w-full">
          {/* Conditional Notification Text */}
          {!canGenerate && (
            <p className="text-red-500 text-sm mb-2">
              Please enter mandatory details
            </p>
          )}
          {/* Generate Button */}
          <Button 
            onClick={generatePersonalizedContent}
            disabled={!canGenerate || isGenerating}
            className="w-full mb-6"
          >
            {isGenerating ? (
              <>
                <Brain className="mr-2 h-4 w-4 animate-spin text-foreground" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4 text-foreground" />
                Generate Course Content
              </>
            )}
          </Button>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-foreground" />
                Course Content Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedContent ? (
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {generatedContent}
                    </pre>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Target className="mr-2 h-4 w-4 text-foreground" />
                      Customize Further
                    </Button>
                    <Button variant="outline" size="sm">
                      Export Content
                    </Button>
                    <Button variant="default" size="sm" onClick={() => navigate('/dashboard')}>
                      <BookOpen className="mr-2 h-4 w-4 text-foreground" />
                      Course Material
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Generated content will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}