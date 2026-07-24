import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useToastStore } from '../../store/useToastStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Label } from '../../components/ui/Label';
import { Modal } from '../../components/ui/Modal';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/Card';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

import logo from '../../assets/hero.png';

export const LoginPage: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate(from && from.startsWith('/admin') ? from : '/admin/dashboard');
      } else if (user.role === 'participant' && user.status === 'approved') {
        navigate(from && from.startsWith('/participant') ? from : '/participant/dashboard');
      }
    }
  }, [user, isAuthenticated, isAuthLoading, navigate, from]);

  const { addToast } = useToastStore();

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const handleForgotPassword = async () => {
    if (!forgotEmail || !forgotEmail.includes('@')) {
      addToast('Please enter a valid email address.', 'error');
      return;
    }
    
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail);
      addToast('Password reset link sent to ' + forgotEmail, 'success');
      setIsForgotModalOpen(false);
      setForgotEmail('');
    } catch (err: any) {
      addToast(err.message || 'Failed to send password reset email', 'error');
    } finally {
      setIsSendingReset(false);
    }
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin') {
          navigate(from && from.startsWith('/admin') ? from : '/admin/dashboard');
        } else {
          navigate(from && from.startsWith('/participant') ? from : '/participant/dashboard');
        }
      } else {
        // If no document exists, the user was likely deleted by the admin from Firestore.
        // We sign them out of Auth immediately and show an error.
        await signOut(auth);
        setError('Your account has been removed by the administrator. Please contact support.');
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Account not found. Please register first.');
      } else {
        setError(err.message || 'Failed to login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0 ring-1 ring-border/50">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto flex items-center justify-center mb-2">
            <img src={logo} alt="AESCION Logo" className="h-40 w-40" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                {...register('email')}
                className={errors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                  className={errors.password ? 'border-destructive focus-visible:ring-destructive pr-10' : 'pr-10'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                >{showPassword ? <EyeOff className="h-4 w-4 cursor-pointer hover:text-red-500" /> : <Eye className="h-4 w-4 cursor-pointer hover:text-red-500" />}
                </button>
              </div>
              <div className="flex justify-end mt-1">
                <button 
                  type="button" 
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-medium text-primary hover:underline hover:cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-3 border border-destructive/20 shadow-sm animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">{error}</p>
                  {error.includes('register') && (
                    <p className="mt-1">
                      <Link to="/register" className="font-medium underline hover:text-destructive/80">Click here to create an account</Link>
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-6">
          <p className="text-sm text-muted-foreground">
            Don't have an account? <Link to="/register" className="text-primary hover:underline font-medium">Register here</Link>
          </p>
        </CardFooter>
      </Card>
      
      <Modal isOpen={isForgotModalOpen} onClose={() => setIsForgotModalOpen(false)} title="Reset Password">
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Enter your email address and we will send you a link to reset your password.
          </p>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email Address</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="name@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsForgotModalOpen(false)}>Cancel</Button>
            <Button onClick={handleForgotPassword} isLoading={isSendingReset}>Send Reset Link</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
