import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Invalid email address').toLowerCase(),
  mobile: z.string().regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
  courseId: z.string().min(1, 'Please select a course'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one symbol'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

import logo from '../../assets/hero.png';

export const RegisterPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [courses, setCourses] = useState<{id: string, name: string}[]>([]);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    const fetchActiveEventAndCourses = async () => {
      try {
        const eventsQuery = query(collection(db, 'events'), where('status', '==', 'active'));
        const eventSnap = await getDocs(eventsQuery);
        
        if (!eventSnap.empty) {
          const activeEvent = eventSnap.docs[0];
          setActiveEventId(activeEvent.id);
          console.log("Active event found:", activeEvent.id, activeEvent.data().name);

          const coursesQuery = query(collection(db, 'courses'), where('eventId', '==', activeEvent.id));
          const coursesSnap = await getDocs(coursesQuery);
          setCourses(coursesSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        } else {
          setCourses([]);
        }
      } catch (err) {
        console.error("Failed to fetch active event or courses", err);
      }
    };
    fetchActiveEventAndCourses();
  }, []);

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: data.fullName });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: data.fullName,
        email: data.email,
        mobile: data.mobile,
        eventId: activeEventId,
        courseId: data.courseId,
        enrollments: [{ eventId: activeEventId, courseId: data.courseId }],
        eventIds: activeEventId ? [activeEventId] : [],
        role: 'participant',
        status: 'pending',
        password: data.password,
        createdAt: new Date().toISOString()
      });

      navigate('/unauthorized'); // Will show pending approval
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4 py-12">
      <Card className="w-full max-w-lg shadow-xl border-0 ring-1 ring-border/50">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex items-center justify-center mb-2">
            <img src={logo} alt="AESCION Logo" className="h-12 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Register for Assessments</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" {...register('fullName')} className={errors.fullName ? 'border-destructive' : ''} />
                {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input id="mobile" {...register('mobile')} className={errors.mobile ? 'border-destructive' : ''} />
                {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...register('email')} className={errors.email ? 'border-destructive' : ''} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="courseId">Course</Label>
              <div className="relative">
                <select 
                  id="courseId" 
                  {...register('courseId')}
                  disabled={courses.length === 0}
                  className={`appearance-none flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-secondary/30 transition-colors cursor-pointer shadow-sm ${errors.courseId ? 'border-destructive' : ''}`}
                >
                  <option value="">{courses.length === 0 ? 'No courses available' : 'Select a course'}</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              {courses.length === 0 && <p className="text-xs text-amber-600">No courses found. Please ask the admin to set an event as Active and add courses to it.</p>}
              {errors.courseId && <p className="text-xs text-destructive">{errors.courseId.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    {...register('password')} 
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? "text" : "password"} 
                    {...register('confirmPassword')} 
                    className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
              </div>
            </div>
            
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-3 border border-destructive/20 shadow-sm animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{error}</p>
                </div>
              </div>
            )}
            
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Register Account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-6">
          <p className="text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline font-medium">Log in</Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};
