import { useState, useEffect } from "react";
import { BookOpen, Calendar, User, Download, FileText, Brain, Presentation, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/config";
import { apiCall } from "@/lib/api-utils";
import { useToast } from "@/hooks/use-toast";

interface CourseFile {
  name: string;
  size: number;
  created: string;
  download_url: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  duration: number;
  teaching_style: string;
  created_by: string;
  created_at: string;
  status: string;
  files: {
    course_material: CourseFile[];
    quizzes: CourseFile[];
    ppts: CourseFile[];
    flashcards: CourseFile[];
  };
}

export default function MyCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await apiCall(`${API_BASE}/my-courses`);
      
      if (response.success) {
        const coursesData = response.data as { courses?: Course[] };
        setCourses(coursesData?.courses || []);
      } else {
        setError(response.error || "Failed to load courses");
      }
    } catch (error) {
      setError("Failed to load courses");
      console.error("Error fetching courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "foundational": return "bg-green-100 text-green-800";
      case "intermediate": return "bg-yellow-100 text-yellow-800";
      case "advanced": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getFileIcon = (category: string) => {
    switch (category) {
      case "course_material": return <FileText className="h-4 w-4" />;
      case "quizzes": return <Brain className="h-4 w-4" />;
      case "ppts": return <Presentation className="h-4 w-4" />;
      case "flashcards": return <CreditCard className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "course_material": return "Course Material";
      case "quizzes": return "Quizzes";
      case "ppts": return "Presentations";
      case "flashcards": return "Flashcards";
      default: return category;
    }
  };

  const downloadFile = async (downloadUrl: string, filename: string) => {
    try {
      const fullUrl = `${API_BASE}${downloadUrl}`;
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download Started",
        description: `Downloading ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download file",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your courses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchCourses}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Courses</h1>
          <p className="text-muted-foreground">
            Generated courses and materials
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {courses.length} {courses.length === 1 ? 'Course' : 'Courses'}
        </Badge>
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No courses yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first course using the AI content generator
            </p>
            <Button onClick={() => window.location.href = '/create'}>
              Create Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{course.title}</CardTitle>
                    <CardDescription className="text-sm mb-3">
                      {course.description}
                    </CardDescription>
                  </div>
                  <Badge className={getDifficultyBadgeColor(course.difficulty_level)}>
                    {course.difficulty_level}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {course.duration} week{course.duration !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {course.created_by}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Teaching Style</p>
                    <Badge variant="outline">{course.teaching_style}</Badge>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-3">Course Materials</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(course.files).map(([category, files]) => (
                        <div
                          key={category}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {getFileIcon(category)}
                            <span className="text-sm">{getCategoryLabel(category)}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {files.length}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Download Files</p>
                    {Object.entries(course.files).map(([category, files]) =>
                      files.map((file) => (
                        <div
                          key={`${category}-${file.name}`}
                          className="flex items-center justify-between p-2 border rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            {getFileIcon(category)}
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB • {getCategoryLabel(category)}
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadFile(file.download_url, file.name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      Created on {new Date(course.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
