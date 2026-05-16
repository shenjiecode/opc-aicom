import { useEffect, useState, useRef } from "react";

interface Worker {
  id: string;
  last_seen: string;
}

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: string;
}

const API_BASE = "http://localhost:8081/api";

function App() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('')
  const [currentSender, setCurrentSender] = useState('commander')
  
  // LightAgent config modal state
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [configWorkerId, setConfigWorkerId] = useState('')
  const [llmApiKey, setLlmApiKey] = useState('')
  const [llmBaseUrl, setLlmBaseUrl] = useState('')
  const [llmModel, setLlmModel] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPass, setSmtpPass] = useState('')

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchWorkers = async () => {
    try {
      const res = await fetch(`${API_BASE}/workers`);
      if (res.ok) {
        setWorkers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/messages`);
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchWorkers();
    fetchMessages();
    const interval = setInterval(() => {
      fetchWorkers();
      fetchMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setShowMentionMenu(true);
      setMentionQuery(lastWord.slice(1));
    } else {
      setShowMentionMenu(false);
    }
  };

  const handleSelectMention = (workerId: string) => {
    if (!inputRef.current) return;
    const cursorPosition = inputRef.current.selectionStart || 0;
    const textBeforeCursor = input.slice(0, cursorPosition);
    const textAfterCursor = input.slice(cursorPosition);

    const words = textBeforeCursor.split(/\s+/);
    words[words.length - 1] = `@${workerId} `;

    const newTextBefore = words.join(" ");
    setInput(newTextBefore + textAfterCursor);
    setShowMentionMenu(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleSaveConfig = async (closeModal = true) => {
    if (!configWorkerId) return
    
    const configPayload = {
      apiKey: llmApiKey,
      baseUrl: llmBaseUrl,
      model: llmModel,
      smtpHost: smtpHost,
      smtpPort: smtpPort,
      smtpUser: smtpUser,
      smtpPass: smtpPass
    };
    
    try {
      await fetch(`${API_BASE}/workers/${configWorkerId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPayload),
      });
      if (closeModal) setConfigModalOpen(false)
    } catch (error) {
      console.error("Failed to save config via API", error);
    }
  }

  const filteredWorkers = workers.filter((w) =>
    w.id.toLowerCase().includes(mentionQuery.toLowerCase()),
  );

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      await fetch(`${API_BASE}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, sender: currentSender }),
      });
      setInput("");
      fetchMessages();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900">
      {/* Sidebar - Workers List & Sender Selection */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="p-4 border-b font-bold text-lg text-gray-800">
          Command Center
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Online Workers ({workers.length})
          </h2>
          <ul className="space-y-2">
            {workers.map((w) => (
              <li key={w.id} className="flex items-center justify-between text-sm group">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  <span>{w.id}</span>
                </div>
                <button 
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                  onClick={async () => {
                    setConfigWorkerId(w.id)
                    try {
                      const res = await fetch(`${API_BASE}/workers/${w.id}/config`);
                      if (res.ok) {
                        const cfg = await res.json();
                        setLlmApiKey(cfg.apiKey || '');
                        setLlmBaseUrl(cfg.baseUrl || '');
                        setLlmModel(cfg.model || '');
                        setSmtpHost(cfg.smtpHost || '');
                        setSmtpPort(cfg.smtpPort || '');
                        setSmtpUser(cfg.smtpUser || '');
                        setSmtpPass(cfg.smtpPass || '');
                      } else {
                        setLlmApiKey('');
                        setLlmBaseUrl('');
                        setLlmModel('');
                        setSmtpHost('');
                        setSmtpPort('');
                        setSmtpUser('');
                        setSmtpPass('');
                      }
                    } catch (e) {
                      console.error("Failed to fetch config", e);
                      setLlmApiKey('');
                      setLlmBaseUrl('');
                      setLlmModel('');
                      setSmtpHost('');
                      setSmtpPort('');
                      setSmtpUser('');
                      setSmtpPass('');
                    }
                    setConfigModalOpen(true)
                  }}
                  title="Configure LightAgent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
              </li>
            ))}
            {workers.length === 0 && (
              <div className="text-gray-400 text-sm">No workers online.</div>
            )}
          </ul>
        </div>

        {/* Role Simulator Selection */}
        <div className="p-4 border-t bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Simulate Sender
          </h2>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="senderRole"
                value="commander"
                checked={currentSender === "commander"}
                onChange={() => setCurrentSender("commander")}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium">commander</span>
            </label>
            {workers.map((w) => (
              <label
                key={`sim-${w.id}`}
                className="flex items-center space-x-2 text-sm cursor-pointer"
              >
                <input
                  type="radio"
                  name="senderRole"
                  value={w.id}
                  checked={currentSender === w.id}
                  onChange={() => setCurrentSender(w.id)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{w.id}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 bg-white shadow-sm border-b">
          <h1 className="font-semibold text-lg">Matrix Network Chat</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.sender.includes("commander") ? "items-end" : "items-start"}`}
            >
              <span className="text-xs text-gray-500 mb-1">{m.sender}</span>
              <div
                className={`px-4 py-2 rounded-lg max-w-xl ${m.sender.includes("commander") ? "bg-blue-600 text-white" : "bg-white shadow-sm border"}`}
              >
                {m.body}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t relative">
          {showMentionMenu && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
              {filteredWorkers.map((w) => (
                <div
                  key={w.id}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSelectMention(w.id)}
                >
                  <span className="font-medium text-gray-900">{w.id}</span>
                </div>
              ))}
              {filteredWorkers.length === 0 && (
                <div className="px-4 py-2 text-sm text-gray-500">
                  没有匹配的 Worker
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSend} className="flex space-x-2">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:border-blue-500"
              placeholder="Type a message... Use @worker-001 to send command"
              value={input}
              onChange={handleInputChange}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* LightAgent Config Modal */}
      {configModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Configure Worker: {configWorkerId}</h3>
            
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 border-b pb-1">LLM Configuration</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input 
                  type="password" 
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="sk-..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base URL (Optional)</label>
                <input 
                  type="text" 
                  value={llmBaseUrl}
                  onChange={(e) => setLlmBaseUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="https://api.openai.com/v1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model Name (Optional)</label>
                <input 
                  type="text" 
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="gpt-4"
                />
              </div>
              <div className="flex justify-end">
                <button 
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  onClick={() => handleSaveConfig(false)}
                >
                  Save LLM Config
                </button>
              </div>

              <h4 className="font-semibold text-gray-800 border-b pb-1 mt-6">Email Skill Configuration</h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input 
                  type="text" 
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                <input 
                  type="text" 
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="465"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP User</label>
                <input 
                  type="text" 
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Password</label>
                <input 
                  type="password" 
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="password"
                />
              </div>
              <div className="flex justify-end">
                <button 
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                  onClick={() => handleSaveConfig(false)}
                >
                  Save Email Config
                </button>
              </div>

            </div>

            <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
              <button 
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                onClick={() => setConfigModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
