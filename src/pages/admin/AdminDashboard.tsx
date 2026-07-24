import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Users, BookOpen, FileText, CheckCircle, XCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { eventId } = useParams<{ eventId: string }>();
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    approvedUsers: 0,
    totalCourses: 0,
    totalQuizzes: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (!eventId) return;
      try {
        const usersQ = query(collection(db, 'users'), where('eventId', '==', eventId));
        const usersSnap = await getDocs(usersQ);
        
        let pending = 0;
        let approved = 0;
        usersSnap.forEach(doc => {
          const data = doc.data();
          if (data.role === 'participant') {
            if (data.status === 'pending') pending++;
            if (data.status === 'approved') approved++;
          }
        });

        const coursesQ = query(collection(db, 'courses'), where('eventId', '==', eventId));
        const coursesSnap = await getDocs(coursesQ);
        
        const quizzesQ = query(collection(db, 'quizzes'), where('eventId', '==', eventId));
        const quizzesSnap = await getDocs(quizzesQ);

        setStats({
          totalUsers: usersSnap.size,
          pendingUsers: pending,
          approvedUsers: approved,
          totalCourses: coursesSnap.size,
          totalQuizzes: quizzesSnap.size,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { title: 'Total Registered', value: stats.totalUsers, icon: Users, color: 'text-blue-500' },
    { title: 'Approved Users', value: stats.approvedUsers, icon: CheckCircle, color: 'text-green-500' },
    { title: 'Pending Approvals', value: stats.pendingUsers, icon: BookOpen, color: 'text-amber-500' },
    { title: 'Total Courses', value: stats.totalCourses, icon: FileText, color: 'text-purple-500' },
    { title: 'Total Quizzes', value: stats.totalQuizzes, icon: XCircle, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name}. Here is an overview of the platform.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
