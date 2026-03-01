import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, User, Bot, Database, Sparkles, Download } from 'lucide-react';
import axios from 'axios';

export default function ChatInterface({ sessionId, schema, onDataMutated, onVisualize }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Hello! I have analyzed your dataset. What would you like to know about it?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [showSchema, setShowSchema] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('/api/chat', {
        sessionId,
        query: userMessage.content,
      });

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.answer,
        downloadUrl: response.data.downloadUrl,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.data.type === 'visualize' && onVisualize) {
        onVisualize({
          chartData: response.data.chartData,
          config: response.data.config
        });
      }

      if (response.data.updatedData && onDataMutated) {
        onDataMutated(response.data.updatedData);
      }
    } catch (error) {
      console.error('[Chat Error]', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.response?.data?.error || error.message}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] relative">
      {/* Schema View Toggle */}
      <div className="absolute top-0 w-full z-20 flex justify-center -translate-y-1/2">
        <button
          onClick={() => setShowSchema(!showSchema)}
          className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 bg-white/90 backdrop-blur-md px-4 py-1.5 border border-slate-200/60 rounded-full shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-200"
        >
          <Database className="w-3.5 h-3.5 text-indigo-500" />
          <span>{showSchema ? 'Hide Schema' : 'View Schema'}</span>
        </button>
      </div>

      {showSchema && schema && (
        <div className="mx-4 mt-6 mb-2 p-4 bg-white/60 backdrop-blur-md border border-indigo-100 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2 z-10 relative">
          <div className="text-xs font-semibold text-indigo-900 mb-3 flex items-center tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
            Detected Columns
          </div>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {schema.map((col, idx) => (
              <span key={idx} className="bg-white border border-slate-200/60 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-medium shadow-sm hover:border-indigo-300 transition-colors">
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar pb-32">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'user'
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-500 ml-3'
                  : 'bg-white border border-slate-200 mr-3'
                  }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Bot className="w-4 h-4 text-indigo-600" />
                )}
              </div>
              <div
                className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-sm'
                  : msg.isError
                    ? 'bg-red-50/90 backdrop-blur-sm text-red-700 border border-red-100/50 rounded-tl-sm'
                    : 'bg-white/80 backdrop-blur-sm border border-slate-100 text-slate-800 rounded-tl-sm'
                  }`}
              >
                <div>{msg.content}</div>
                {msg.downloadUrl && (
                  <div className="mt-4">
                    <a
                      href={msg.downloadUrl}
                      download
                      className="inline-flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Processed CSV</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
            <div className="flex max-w-[85%] flex-row">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 mr-3 flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="px-5 py-3.5 rounded-2xl text-[15px] shadow-sm bg-white/80 backdrop-blur-sm border border-slate-100 text-slate-600 rounded-tl-sm flex items-center space-x-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="animate-pulse">Synthesizing data...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/90 to-transparent pt-12">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative flex items-center group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your data..."
              className="w-full pl-5 pr-14 py-4 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all text-[15px] shadow-sm text-slate-800 placeholder:text-slate-400"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 p-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 disabled:hover:bg-indigo-600 shadow-sm flex items-center justify-center transform active:scale-95 group-focus-within:shadow-md"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
          <div className="mt-2 text-center">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
              AI-Powered Insight Engine
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
