// components/CollapsibleChat.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Message } from '@/lib/types';

type CollapsibleChatProps = {
  title: string;
  aiName: string;
  messages: Message[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  canSend: boolean;
  personality?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  unreadCount: number;
  eliminated?: boolean;
};

export const CollapsibleChat = ({
  title,
  aiName,
  messages,
  input,
  onInputChange,
  onSend,
  canSend,
  personality,
  isExpanded,
  onToggleExpand,
  unreadCount
}: CollapsibleChatProps) => {
  return (
    <div className={`w-full transition-all duration-300 ease-in-out bg-white shadow rounded 
      ${isExpanded ? 'h-[600px]' : 'h-[70px]'}`}>
      {/* Header - always visible */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer border-b"
        onClick={onToggleExpand}
      >
        <div className="flex items-center">
          <h2 className="font-semibold">{title}</h2>
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {/* Chat content - only visible when expanded */}
      {isExpanded && (
        <div className="flex flex-col h-[calc(100%-70px)]">
          {personality && (
            <div className="text-xs text-gray-500 px-4 py-2 italic">
              {personality}
            </div>
          )}
          <div className="flex-1 overflow-y-auto space-y-2 p-4">
            {messages.map((m, i) => (
              <div 
                key={i} 
                className={`p-2 rounded text-sm ${
                  m.visibility === 'highlighted' 
                    ? 'bg-yellow-100 border border-yellow-300' 
                    : 'bg-gray-100'
                }`}
              >
                <strong>{m.sender} → {m.recipient}:</strong> {m.content}
              </div>
            ))}
          </div>
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e: { target: { value: string; }; }) => onInputChange(e.target.value)}
                placeholder={`Message to ${aiName}…`}
                className="flex-1"
                onKeyDown={(e: { key: string; }) => canSend && e.key === 'Enter' && onSend()}
                disabled={!canSend}
              />
              <Button onClick={onSend} disabled={!canSend}>Send</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};