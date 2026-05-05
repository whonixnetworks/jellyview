import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { HistoryStatsByDay } from '@/api/history';

interface WatchStatsChartProps {
  stats: HistoryStatsByDay[];
  isLoading?: boolean;
}

export function WatchStatsChart({ stats, isLoading = false }: WatchStatsChartProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatWatchTime = (seconds: number) => {
    const hours = seconds / 3600;
    if (hours >= 1) {
      return `${hours.toFixed(1)}h`;
    }
    return `${(seconds / 60).toFixed(0)}m`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Watch Statistics</CardTitle>
          <CardDescription>Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (stats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Watch Statistics</CardTitle>
          <CardDescription>No data available for the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">No data available</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPlays = stats.reduce((sum, day) => sum + day.plays, 0);
  const totalWatchTime = stats.reduce((sum, day) => sum + day.watch_time, 0);
  const avgCompletion = stats.reduce((sum, day) => sum + day.avg_completion, 0) / stats.length;

  const chartData = stats.map((day) => ({
    date: formatDate(day.date),
    fullDate: day.date,
    plays: day.plays,
    watchTimeHours: day.watch_time / 3600,
    uniqueUsers: day.unique_users,
    avgCompletion: day.avg_completion,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Watch Statistics</CardTitle>
        <CardDescription>
          Daily plays and watch time
        </CardDescription>
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Total Plays: {totalPlays}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Watch Time: {formatWatchTime(totalWatchTime)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              Avg Completion: {avgCompletion.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-sm"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              yAxisId="left"
              className="text-sm"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              label={{ value: 'Plays', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              className="text-sm"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              label={{ value: 'Hours', angle: 90, position: 'insideRight', fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => {
                if (name === 'Plays') return [value, 'Plays'];
                if (name === 'Watch Time') return [value.toFixed(1), 'Watch Time (hours)'];
                return [value, name];
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="plays" 
              name="Plays"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="watchTimeHours" 
              name="Watch Time"
              stroke="hsl(var(--secondary))" 
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
