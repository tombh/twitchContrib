import { useState, useEffect } from 'react';
import { GetServerSideProps } from 'next';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';  // Dark theme
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import { ArrowPathIcon, ClipboardIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import db from '../lib/db';

interface Contribution {
  id: number;
  username: string;
  filename: string;
  line_number: number | null;
  code: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export const getServerSideProps: GetServerSideProps = async () => {
  const contributions = await db.getContributions();
  return {
    props: {
      initialContributions: contributions
    }
  };
};

export default function Home({ initialContributions }: { initialContributions: Contribution[] }) {
  const [contributions, setContributions] = useState<Contribution[]>(initialContributions);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    // Check token validity
    const checkToken = async () => {
      try {
        const response = await fetch('/api/check-token');
        const data = await response.json();
        
        if (!data.valid) {
          // Token is expired or invalid, redirect to auth page
          window.location.href = '/auth-twitch';
        } else {
          // Token is valid, initialize Twitch connection
          fetch('/api/init-twitch').catch(console.error);
        }
      } catch (error) {
        console.error('Failed to check token status:', error);
      }
    };
    
    checkToken();
    
    // Highlight all code blocks
    Prism.highlightAll();
  }, [contributions]);

  // Helper function to determine language from filename
  const getLanguage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'typescript';
      case 'tsx': return 'tsx';
      case 'js': return 'javascript';
      case 'jsx': return 'jsx';
      case 'css': return 'css';
      case 'json': return 'json';
      default: return 'typescript';
    }
  };

  const updateStatus = async (id: number, status: 'accepted' | 'rejected') => {
    await fetch('/api/contributions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });

    setContributions(contributions.map(contrib =>
      contrib.id === id ? { ...contrib, status } : contrib
    ));
  };

  const refreshContributions = async () => {
    try {
      const response = await fetch('/api/contributions');
      const data = await response.json();
      setContributions(data);
    } catch (error) {
      console.error('Failed to refresh contributions:', error);
    }
  };

  const copyToClipboard = async (id: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const sendToVSCodeWithPath = async (id: number) => {
    try {
      // Ask for path (optional)
      const filePath = prompt(
        "Enter path where file should be created (optional):\n" +
        "Leave blank to select in VSCode, or enter a path on your system.",
        ""
      );
      
      await fetch('/api/send-to-vscode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, filePath })
      });
      
      // Show success message
      alert('Contribution sent to VSCode!');
    } catch (error) {
      console.error('Failed to send to VSCode:', error);
      alert('Failed to send to VSCode. Make sure the VSCode extension is installed and running.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="max-w-[90%] mx-auto p-6">
        <h1 className="text-4xl font-bold mb-8 text-purple-400">TwitchContrib</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-blue-400">Pending Contributions</h2>
              <button 
                onClick={refreshContributions}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
              >
                <ArrowPathIcon className="w-5 h-5" />
                <span>Refresh</span>
              </button>
            </div>
            <div className="space-y-6">
              {contributions.filter(c => c.status === 'pending').map(contribution => (
                <div key={contribution.id} className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700 hover:border-purple-500 transition-all">
                  <div className="flex items-center mb-4">
                    <span className="text-purple-400 font-semibold">{contribution.username}</span>
                    <span className="mx-2 text-gray-500">•</span>
                    <span className="text-gray-400">{new Date(contribution.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mb-4 p-4 bg-gray-950 rounded-lg border border-gray-700">
                    <p className="text-gray-300 mb-2">
                      <span className="text-blue-400 font-semibold">File: </span>
                      <code className="text-yellow-400">{contribution.filename}</code>
                    </p>
                    {contribution.line_number && (
                      <p className="text-gray-300 mb-2">
                        <span className="text-blue-400 font-semibold">Line: </span>
                        <code className="text-yellow-400">{contribution.line_number}</code>
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <pre className="font-mono text-sm bg-[#1e1e1e] p-4 rounded-lg border border-gray-700 whitespace-pre overflow-x-auto">
                      <code className={`language-${getLanguage(contribution.filename)}`}>
                        {contribution.code}
                      </code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(contribution.id, contribution.code)}
                      className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                      title="Copy code"
                    >
                      {copiedId === contribution.id ? (
                        <ClipboardDocumentCheckIcon className="w-5 h-5 text-green-400" />
                      ) : (
                        <ClipboardIcon className="w-5 h-5 text-gray-300" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => updateStatus(contribution.id, 'accepted')}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => updateStatus(contribution.id, 'rejected')}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full">
            <h2 className="text-2xl font-bold mb-6 text-blue-400">History</h2>
            <div className="space-y-6">
              {contributions.filter(c => c.status !== 'pending').map(contribution => (
                <div key={contribution.id} className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
                  <div className="flex items-center mb-4">
                    <span className="text-purple-400 font-semibold">{contribution.username}</span>
                    <span className="mx-2 text-gray-500">•</span>
                    <span className="text-gray-400">{new Date(contribution.created_at).toLocaleString()}</span>
                  </div>
                  <div className="mb-4 p-4 bg-gray-950 rounded-lg border border-gray-700">
                    <p className="text-gray-300 mb-2">
                      <span className="text-blue-400 font-semibold">File: </span>
                      <code className="text-yellow-400">{contribution.filename}</code>
                    </p>
                    {contribution.line_number && (
                      <p className="text-gray-300 mb-2">
                        <span className="text-blue-400 font-semibold">Line: </span>
                        <code className="text-yellow-400">{contribution.line_number}</code>
                      </p>
                    )}
                  </div>
                  <div className="relative">
                    <pre className="font-mono text-sm bg-[#1e1e1e] p-4 rounded-lg border border-gray-700 whitespace-pre overflow-x-auto">
                      <code className={`language-${getLanguage(contribution.filename)}`}>
                        {contribution.code}
                      </code>
                    </pre>
                    <button
                      onClick={() => copyToClipboard(contribution.id, contribution.code)}
                      className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                      title="Copy code"
                    >
                      {copiedId === contribution.id ? (
                        <ClipboardDocumentCheckIcon className="w-5 h-5 text-green-400" />
                      ) : (
                        <ClipboardIcon className="w-5 h-5 text-gray-300" />
                      )}
                    </button>
                  </div>
                  <p className={`mt-4 font-semibold ${
                    contribution.status === 'accepted' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    Status: {contribution.status.charAt(0).toUpperCase() + contribution.status.slice(1)}
                  </p>
                  {contribution.status === 'accepted' && (
                    <button
                      onClick={() => sendToVSCodeWithPath(contribution.id)}
                      className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l-4-4m4 4l4-4" />
                      </svg>
                      <span>Send to VSCode</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 