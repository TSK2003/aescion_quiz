import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';

import logo from '../assets/hero.png';

export const LandingPage: React.FC = () => {
  useAuthStore();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">

        <div className="flex items-center gap-2">
            <img src={logo} alt="AESCION Logo" className="h-60 w-auto" />
          </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl space-y-6"
        >
          
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-foreground">
            Evaluate Excellence with <span className="text-primary">Precision</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Aescion Edtech Solutions brings you a secure, analytics-driven, and highly robust platform to conduct professional assessments and technical quizzes.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link to="/register">
              <Button size="lg" className="rounded-full">Register</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="rounded-full">Login</Button>
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
