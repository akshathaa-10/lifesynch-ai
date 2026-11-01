export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  suggestedQuestions?: string[];
  sources?: SourceMetadata[];
  intent?: string;
}

export interface SourceMetadata {
  id: string;
  type: 'task' | 'gmail' | 'calendar';
  title?: string;
  sender?: string;
}

export interface AskAssistantRequest {
  question: string;
  history?: ChatMessage[];
  timezone?: string;
}

export interface AskAssistantResponse {
  answer: string;
  timestamp: string;
  sources?: SourceMetadata[];
  intent?: string;
  suggestedQuestions?: string[];
}

