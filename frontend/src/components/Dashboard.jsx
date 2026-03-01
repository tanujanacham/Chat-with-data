import React, { useState } from 'react';
import FileUpload from './FileUpload';
import ChatInterface from './ChatInterface';
import DataGridDisplay from './DataGridDisplay';
import ChartDisplay from './ChartDisplay';
import { Database, Zap, Layout, BarChart2, Download } from 'lucide-react';

export default function Dashboard() {
  const [fileData, setFileData] = useState(null);
  const [schema, setSchema] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [activeVisualization, setActiveVisualization] = useState(null);

  const handleFileUpload = (data) => {
    setFileData(data.csvData);
    setSchema(data.schema);
    setSessionId(data.sessionId);
    setActiveVisualization(null);
  };

  const handleVisualize = (visualData) => {
    setActiveVisualization(visualData);
  };

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden relative font-sans text-slate-900">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-100/50 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-violet-100/40 blur-3xl"></div>
      </div>

      <div className="flex w-full h-full max-w-[1920px] mx-auto p-4 sm:p-6 gap-6 z-10 relative">
        {/* Left Side: Chat & Upload */}
        <div className={`w-1/3 min-w-[400px] max-w-[500px] flex flex-col glass-panel rounded-3xl overflow-hidden flex-shrink-0 transition-opacity duration-300 ${activeVisualization ? 'opacity-80' : 'opacity-100'}`}>
          <div className="p-8 pb-6">
            <div className="inline-flex items-center justify-center p-2.5 bg-indigo-50 rounded-2xl mb-4">
              <Zap className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Agentic Analyst</h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Upload your dataset and converse with your data. Insights delivered instantly.
            </p>
          </div>

          {!fileData ? (
            <div className="flex-1 px-8 pb-8 flex flex-col justify-center">
              <FileUpload onUploadSuccess={handleFileUpload} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
              <div className="px-4 py-3 mx-4 mb-4 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/60 flex justify-between items-center shadow-sm">
                <div className="flex items-center space-x-3">
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Live Session</span>
                </div>
                <button
                  onClick={() => { setFileData(null); setActiveVisualization(null); }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all border border-indigo-100 shadow-sm"
                >
                  Reset
                </button>
              </div>
              <ChatInterface
                sessionId={sessionId}
                schema={schema}
                onDataMutated={(newData) => {
                  setFileData(newData);
                  if (newData && newData.length > 0) {
                    setSchema(Object.keys(newData[0]));
                  }
                }}
                onVisualize={handleVisualize}
              />
            </div>
          )}
        </div>

        {/* Right Side: Data Grid / Visualization Panel */}
        <div className="flex-1 flex flex-col h-full min-w-0 space-y-6">
          {fileData ? (
            <>
              {/* Dynamic Panel: Grid or Chart */}
              <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col shadow-sm relative">
                <div className="px-8 py-5 border-b border-slate-200/50 bg-white/40 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-slate-800">Dataset Explorer</h2>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveVisualization(null)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!activeVisualization ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Layout className="w-4 h-4" />
                      <span>Table View</span>
                    </button>
                    {activeVisualization && (
                      <button
                        className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white shadow-sm text-indigo-600 ml-1"
                      >
                        <BarChart2 className="w-4 h-4" />
                        <span>Analysis</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center ml-4 space-x-3">
                    <div className="w-[1px] h-6 bg-slate-200/60 mx-1"></div>
                    <a
                      href={`/api/export/${sessionId}`}
                      download
                      className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95 border border-indigo-700/50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export CSV</span>
                    </a>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-white/50">
                  <DataGridDisplay data={fileData} />
                </div>

                {/* Side Panel for Chart (Overlay within the Right Panel) */}
                {activeVisualization && (
                  <div className="absolute top-4 right-4 bottom-4 w-[45%] min-w-[450px] z-50 glass-panel rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-right-8 duration-500 border border-indigo-100/50">
                    <ChartDisplay
                      data={activeVisualization.chartData}
                      config={activeVisualization.config}
                      onClose={() => setActiveVisualization(null)}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-24 h-24 mx-auto mb-6 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                  <Database className="w-10 h-10 text-indigo-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Intelligence Engine Standby</h3>
                <p className="text-slate-500 text-sm leading-relaxed px-4">
                  Upload a CSV file on the left to initialize the analysis engine. Our AI will help you clean, transform, and visualize your data.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
