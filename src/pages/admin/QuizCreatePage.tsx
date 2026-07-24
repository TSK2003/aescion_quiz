import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, where } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import * as XLSX from 'xlsx';

export const QuizCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [quizName, setQuizName] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState('');
  
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [validationReport, setValidationReport] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!eventId) return;
      const q = query(collection(db, 'courses'), where('eventId', '==', eventId));
      const querySnapshot = await getDocs(q);
      setCourses(querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    };
    fetchCourses();
  }, [eventId]);

  const parseExcel = async (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const validateQuestions = (questions: any[], setName: string) => {
    let report = '';
    const validAnswers = ['A', 'B', 'C', 'D'];
    
    if (questions.length === 0) {
      return `Set ${setName} is empty.\n`;
    }

    const isMissing = (val: any) => val === undefined || val === null || val.toString().trim() === '';

    questions.forEach((q, index) => {
      const rowNum = index + 2; // Assuming row 1 is header
      if (isMissing(q['Question'])) report += `Set ${setName} - Row ${rowNum}: Missing Question text.\n`;
      if (isMissing(q['Option A'])) report += `Set ${setName} - Row ${rowNum}: Missing Option A.\n`;
      if (isMissing(q['Option B'])) report += `Set ${setName} - Row ${rowNum}: Missing Option B.\n`;
      if (isMissing(q['Option C'])) report += `Set ${setName} - Row ${rowNum}: Missing Option C.\n`;
      if (isMissing(q['Option D'])) report += `Set ${setName} - Row ${rowNum}: Missing Option D.\n`;
      
      const correct = q['Correct Answer']?.toString().trim().toUpperCase();
      if (!correct || !validAnswers.includes(correct)) {
        report += `Set ${setName} - Row ${rowNum}: Invalid or Missing Correct Answer (Must be A, B, C, or D).\n`;
      }
    });

    return report;
  };

  const downloadSampleExcel = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Question": "What is the capital of France?",
        "Option A": "London",
        "Option B": "Berlin",
        "Option C": "Paris",
        "Option D": "Madrid",
        "Correct Answer": "C"
      },
      {
        "Question": "What is 2 + 2?",
        "Option A": "3",
        "Option B": "4",
        "Option C": "5",
        "Option D": "6",
        "Correct Answer": "B"
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample Questions");
    XLSX.writeFile(wb, "Sample_Quiz_Questions.xlsx");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizName || !courseId || !fileA || !fileB) {
      setValidationReport("Please fill all fields and upload both Question Sets.");
      return;
    }

    setLoading(true);
    setValidationReport(null);

    try {
      const [dataA, dataB] = await Promise.all([parseExcel(fileA), parseExcel(fileB)]);
      
      let report = validateQuestions(dataA, 'A') + validateQuestions(dataB, 'B');
      if (report) {
        setValidationReport(report);
        setLoading(false);
        return;
      }

      // If valid, create quiz document
      const selectedCourse = courses.find(c => c.id === courseId);
      const quizDoc = await addDoc(collection(db, 'quizzes'), {
        name: quizName,
        description,
        courseId,
        courseName: selectedCourse?.name || '',
        duration: 30,
        questionTimer: 15,
        totalQuestions: dataA.length,
        status: 'draft',
        eventId,
        createdAt: new Date().toISOString()
      });

      // Save Question Set A
      await addDoc(collection(db, 'questionSets'), {
        quizId: quizDoc.id,
        setName: 'A',
        eventId,
        questions: dataA.map(q => ({
          text: q['Question'],
          optionA: q['Option A'],
          optionB: q['Option B'],
          optionC: q['Option C'],
          optionD: q['Option D'],
          correctAnswer: q['Correct Answer'].toString().trim().toUpperCase()
        }))
      });

      // Save Question Set B
      await addDoc(collection(db, 'questionSets'), {
        quizId: quizDoc.id,
        setName: 'B',
        questions: dataB.map(q => ({
          text: q['Question'],
          optionA: q['Option A'],
          optionB: q['Option B'],
          optionC: q['Option C'],
          optionD: q['Option D'],
          correctAnswer: q['Correct Answer'].toString().trim().toUpperCase()
        }))
      });

      navigate(`/admin/events/${eventId}/quizzes`);
    } catch (error) {
      console.error("Error creating quiz:", error);
      setValidationReport("An error occurred while processing the files. Please check the format.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Quiz</h1>
        <p className="text-muted-foreground">Set up a new assessment and upload question sets.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="quizName">Quiz Name</Label>
                <Input 
                  id="quizName" 
                  value={quizName}
                  onChange={(e) => setQuizName(e.target.value)}
                  placeholder="e.g., Midterm Assessment" 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="courseId">Assign to Course</Label>
                <select 
                  id="courseId" 
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input 
                id="description" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the quiz" 
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border">
              <h3 className="text-lg font-medium">Upload Question Sets</h3>
              <Button type="button" variant="outline" size="sm" onClick={downloadSampleExcel}>
                Download Sample Format
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Question Set A (Excel)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={(e) => setFileA(e.target.files?.[0] || null)}
                    className="hidden" 
                    id="fileA" 
                  />
                  <Label htmlFor="fileA" className="cursor-pointer flex flex-col items-center">
                    <svg className="w-8 h-8 mb-2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm font-medium text-primary">Click to upload Set A</span>
                    {fileA && <span className="text-xs text-muted-foreground mt-1">{fileA.name}</span>}
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Question Set B (Excel)</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors">
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={(e) => setFileB(e.target.files?.[0] || null)}
                    className="hidden" 
                    id="fileB" 
                  />
                  <Label htmlFor="fileB" className="cursor-pointer flex flex-col items-center">
                    <svg className="w-8 h-8 mb-2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm font-medium text-primary">Click to upload Set B</span>
                    {fileB && <span className="text-xs text-muted-foreground mt-1">{fileB.name}</span>}
                  </Label>
                </div>
              </div>
            </div>

            {validationReport && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                <h4 className="font-semibold text-destructive mb-2">Validation Errors Found:</h4>
                <pre className="text-xs text-destructive whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                  {validationReport}
                </pre>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => navigate(`/admin/events/${eventId}/quizzes`)}>Cancel</Button>
              <Button type="submit" isLoading={loading}>Create Quiz & Import Questions</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
