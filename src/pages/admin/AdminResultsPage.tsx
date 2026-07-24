import React, { useEffect, useState } from 'react';
import { db } from '../../config/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

export const AdminResultsPage: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const q = query(collection(db, 'results'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Sorting by percentage descending
        data.sort((a, b) => b.percentage - a.percentage);
        
        setResults(data);
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const getChartData = () => {
    const distribution = {
      '90-100%': 0,
      '80-89%': 0,
      '70-79%': 0,
      '60-69%': 0,
      '<60%': 0,
      'Disqualified': 0
    };

    results.forEach(r => {
      if (r.isDisqualified) {
        distribution['Disqualified']++;
      } else {
        const p = r.percentage;
        if (p >= 90) distribution['90-100%']++;
        else if (p >= 80) distribution['80-89%']++;
        else if (p >= 70) distribution['70-79%']++;
        else if (p >= 60) distribution['60-69%']++;
        else distribution['<60%']++;
      }
    });

    return Object.keys(distribution).map(key => ({
      name: key,
      count: distribution[key as keyof typeof distribution]
    }));
  };

  if (loading) return <div className="p-12 text-center">Loading Analytics...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Results & Analytics</h1>
        <p className="text-muted-foreground">View participant performance and assessment statistics.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
            <CardDescription>Overall performance across all assessments.</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
            <CardDescription>Highest scoring participants.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.filter(r => !r.isDisqualified).slice(0, 5).map((r, i) => (
                <div key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium">{r.userName}</p>
                      <p className="text-xs text-muted-foreground">Quiz ID: {r.quizId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{Math.round(r.percentage)}%</p>
                    <p className="text-xs text-muted-foreground">{r.score} pts</p>
                  </div>
                </div>
              ))}
              {results.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">No results available yet.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detailed Reports</CardTitle>
          <CardDescription>All participant submissions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Participant</th>
                  <th className="px-6 py-3">Quiz ID</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Percentage</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-6 py-4 font-medium">{r.userName}</td>
                    <td className="px-6 py-4">{r.quizId}</td>
                    <td className="px-6 py-4">{r.score}</td>
                    <td className="px-6 py-4">{Math.round(r.percentage)}%</td>
                    <td className="px-6 py-4">
                      {r.isDisqualified ? (
                        <span className="text-destructive font-semibold">Disqualified</span>
                      ) : (
                        <span className="text-green-600 font-semibold">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
