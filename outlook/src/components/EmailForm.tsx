import { useState } from 'react';
import type { IOConnectBrowser } from '@interopio/browser';
import type { IOConnectDesktop } from '@interopio/desktop';

interface EmailFormProps {
  io: IOConnectBrowser.API | IOConnectDesktop.API;
  initialSubject?: string;
  initialBody?: string;
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function EmailForm({ io, initialSubject = '', initialBody = '' }: EmailFormProps) {
  const [email, setEmail] = useState<EmailData>({
    to: '',
    subject: initialSubject,
    body: initialBody
  });
  const [status, setStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      // Invoke the Outlook add-on's email method via interop
      // T42.SendEmail accepts: To, Subject, Body, HTMLBody, Cc, Bcc, AttachFiles, SendFrom
      await io.interop.invoke('T42.SendEmail', {
        To: [email.to],
        Subject: email.subject,
        Body: email.body
      });

      setStatus('success');
      // Reset form after success
      setTimeout(() => {
        setEmail({ to: '', subject: initialSubject, body: initialBody });
        setStatus('idle');
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const handleChange = (field: keyof EmailData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setEmail(prev => ({ ...prev, [field]: e.target.value }));
    if (status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  };

  return (
    <form className="email-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="to">To:</label>
        <input
          type="email"
          id="to"
          value={email.to}
          onChange={handleChange('to')}
          placeholder="recipient@example.com"
          required
          disabled={status === 'sending'}
        />
      </div>

      <div className="form-group">
        <label htmlFor="subject">Subject:</label>
        <input
          type="text"
          id="subject"
          value={email.subject}
          onChange={handleChange('subject')}
          placeholder="Email subject"
          required
          disabled={status === 'sending'}
        />
      </div>

      <div className="form-group">
        <label htmlFor="body">Message:</label>
        <textarea
          id="body"
          value={email.body}
          onChange={handleChange('body')}
          placeholder="Type your message here..."
          rows={10}
          required
          disabled={status === 'sending'}
        />
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={status === 'sending'}
          className={status === 'success' ? 'success' : ''}
        >
          {status === 'sending' && '📤 Sending...'}
          {status === 'success' && '✓ Email Created!'}
          {status === 'error' && '⚠ Try Again'}
          {status === 'idle' && '📧 Send via Outlook'}
        </button>
      </div>

      {status === 'error' && (
        <div className="error-message">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {status === 'success' && (
        <div className="success-message">
          Email draft created in Outlook! Check your Outlook drafts folder.
        </div>
      )}
    </form>
  );
}
