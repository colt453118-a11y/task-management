'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';

interface ChartData {
  donutData: Array<{ name: string; value: number }>;
  barData: Array<{ name: string; value: number; fill: string }>;
  total: number;
  pieColors: string[];
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
};

export default function RechartsCharts({ donutData, barData, total, pieColors }: ChartData) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Donut Chart */}
      <motion.div variants={itemVariants}>
        <Card className="neon-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="text-surface-500 h-4 w-4" />
              Task Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <p className="text-surface-500 text-sm">No tasks to display</p>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        animationBegin={200}
                        animationDuration={1200}
                      >
                        {donutData.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={pieColors[idx % pieColors.length]}
                            stroke="transparent"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-surface-200)',
                          border: '1px solid var(--color-brand-500/0.2)',
                          borderRadius: '12px',
                          color: 'var(--color-surface-900)',
                        }}
                        itemStyle={{ color: 'var(--color-surface-900)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {donutData.map((d, idx) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: pieColors[idx % pieColors.length] }}
                      />
                      <span className="text-surface-500">{d.name}</span>
                      <span className="text-surface-700 font-medium">{d.value}</span>
                      <span className="text-surface-500">
                        ({Math.round((d.value / total) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Bar Chart */}
      <motion.div variants={itemVariants}>
        <Card className="neon-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="text-surface-500 h-4 w-4" />
              Task Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-surface-500)', fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--color-surface-500)', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface-200)',
                      border: '1px solid var(--color-brand-500/0.2)',
                      borderRadius: '12px',
                      color: 'var(--color-surface-900)',
                    }}
                    itemStyle={{ color: 'var(--color-surface-900)' }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 0, 0]}
                    animationBegin={400}
                    animationDuration={1200}
                  >
                    {barData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
