import React, { useState } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon, X, Maximize2 } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

export default function ChartDisplay({ data, config, onClose }) {
    const [chartType, setChartType] = useState(config.type || 'bar');

    // Keep chart type in sync with config changes
    React.useEffect(() => {
        if (config.type) setChartType(config.type);
    }, [config.type]);

    const isEmpty = !data || data.length === 0;

    const renderChart = () => {
        switch (chartType) {
            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={config.xAxis} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value.toLocaleString()} />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey={config.yAxis} stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                    </LineChart>
                );
            case 'pie':
                return (
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey={config.yAxis}
                            nameKey={config.xAxis}
                            label
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                );
            case 'area':
                return (
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={config.xAxis} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey={config.yAxis} stroke="#6366f1" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                );
            default: // bar
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={config.xAxis} stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey={config.yAxis} fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                );
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in zoom-in duration-300">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">{config.title || 'Visualization'}</h3>
                    <p className="text-xs text-slate-500 mt-1">Single series analysis</p>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl mr-4">
                        <button
                            onClick={() => setChartType('bar')}
                            className={`p-2 rounded-lg transition-all ${chartType === 'bar' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Bar Chart"
                        >
                            <BarChart3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setChartType('line')}
                            className={`p-2 rounded-lg transition-all ${chartType === 'line' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Line Chart"
                        >
                            <LineIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setChartType('pie')}
                            className={`p-2 rounded-lg transition-all ${chartType === 'pie' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Pie Chart"
                        >
                            <PieIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setChartType('area')}
                            className={`p-2 rounded-lg transition-all ${chartType === 'area' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Area Chart"
                        >
                            <AreaIcon className="w-4 h-4" />
                        </button>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 p-6 min-h-[400px]">
                {isEmpty ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                            <BarChart3 className="w-8 h-8 text-slate-200" />
                        </div>
                        <div>
                            <p className="text-slate-900 font-bold italic font-sans dark:text-gray-100">No data available for this chart</p>
                            <p className="text-slate-500 text-sm italic font-sans dark:text-gray-100">Try adjusting your query or filter</p>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        {renderChart()}
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
