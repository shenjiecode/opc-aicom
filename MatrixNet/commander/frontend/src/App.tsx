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
  const [mentionQuery, setMentionQuery] = useState("");
  const [currentSender, setCurrentSender] = useState("commander");
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
              <li key={w.id} className="flex items-center space-x-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span>{w.id}</span>
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
    </div>
  );
}

export default App;
