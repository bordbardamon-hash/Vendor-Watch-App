import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  Globe, 
  Database, 
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const data = [
  { time: "00:00", requests: 120, errors: 2 },
  { time: "04:00", requests: 450, errors: 5 },
  { time: "08:00", requests: 1200, errors: 12 },
  { time: "12:00", requests: 980, errors: 8 },
  { time: "16:00", requests: 1500, errors: 24 },
  { time: "20:00", requests: 850, errors: 4 },
  { time: "23:59", requests: 320, errors: 1 },
];

export default function Dashboard() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Scheduler Active
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          title="Total Requests" 
          value="45,231" 
          change="+20.1%" 
          icon={Globe}
          trend="up"
        />
        <MetricCard 
          title="Active Scrapers" 
          value="12" 
          change="+2" 
          icon={Activity}
          trend="up"
        />
        <MetricCard 
          title="Data Points" 
          value="1.2M" 
          change="+15%" 
          icon={Database}
          trend="up"
        />
        <MetricCard 
          title="Error Rate" 
          value="0.4%" 
          change="-0.1%" 
          icon={AlertTriangle}
          trend="down" // Good thing
          alert
        />
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Request Volume (24h)</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="requests" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { type: "success", msg: "Finished scraping e-commerce-site.com", time: "2m ago" },
                { type: "pending", msg: "Scheduled news-aggregator job", time: "15m ago" },
                { type: "error", msg: "Connection timeout on api.weather.org", time: "1h ago" },
                { type: "success", msg: "Database backup completed", time: "2h ago" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`mt-1 h-2 w-2 rounded-full ${
                    item.type === 'success' ? 'bg-emerald-500' : 
                    item.type === 'error' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{item.msg}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, icon: Icon, trend, alert }: any) {
  return (
    <Card className="border-sidebar-border bg-sidebar/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${alert ? 'text-amber-500' : 'text-primary'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          {trend === 'up' && <span className="text-emerald-500 flex items-center"><ArrowUpRight className="h-3 w-3 mr-1"/>{change}</span>}
          {trend === 'down' && <span className="text-emerald-500 flex items-center"><ArrowUpRight className="h-3 w-3 mr-1 rotate-180"/>{change}</span>}
          <span className="opacity-70">from last month</span>
        </p>
      </CardContent>
    </Card>
  );
}
