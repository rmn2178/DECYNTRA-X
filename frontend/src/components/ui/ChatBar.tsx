import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import styles from './ChatBar.module.css';

interface ChatBarProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
}

const ChatBar: React.FC<ChatBarProps> = ({
  onSubmit,
  placeholder = 'Ask anything about your cash flow…',
  loading = false,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
        />
        <button
          className={`${styles.sendBtn} ${value.trim() ? styles.active : ''}`}
          onClick={handleSubmit}
          disabled={!value.trim() || loading}
        >
          <ArrowUp size={16} />
        </button>
      </div>
      <p className={styles.hint}>Press Enter to send, Shift+Enter for new line</p>
    </div>
  );
};

export default ChatBar;
