import { useState, useEffect, useCallback } from 'react';
import type { SyntheticEvent, ChangeEvent } from 'react';
import type { IOConnectBrowser } from '@interopio/browser';
import type { IOConnectDesktop } from '@interopio/desktop';

type IOApi = IOConnectBrowser.API | IOConnectDesktop.API;

const OUTLOOK_METHOD = 'T42.Outlook.CreateEmail';

interface EmailFormProps {
  io: IOApi;
  initialSubject?: string;
  initialBody?: string;
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

interface OutlookServerInfo {
  available: boolean;
  machine?: string;
  application?: string;
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

export default function EmailForm({ io, initialSubject = '', initialBody = '' }: EmailFormProps) {
  const [email, setEmail] = useState<EmailData>({
    to: '',
    subject: initialSubject,
    body: initialBody
  });

  const [outlookServer, setOutlookServer] = useState<OutlookServerInfo>({ available: false });

  // Check if the Outlook method is available and track server info
  const updateOutlookMethodStatus = useCallback(() => {
    const methods = io.interop.methods({ name: OUTLOOK_METHOD });
    if (methods.length > 0) {
      // Get the first server that provides this method
      const servers = methods[0].getServers?.() || [];
      if (servers.length > 0) {
        const server = servers[0];
        setOutlookServer({
          available: true,
          machine: server.machine,
          application: server.application
        });
        return;
      }
    }
    setOutlookServer({ available: false });
  }, [io]);

  useEffect(() => {
    // Check initial state
    updateOutlookMethodStatus();

    // Subscribe to method added/removed events
    const unsubAdded = io.interop.serverMethodAdded(({ method }) => {
      if (method.name === OUTLOOK_METHOD) {
        updateOutlookMethodStatus();
      }
    });

    const unsubRemoved = io.interop.serverMethodRemoved(({ method }) => {
      if (method.name === OUTLOOK_METHOD) {
        updateOutlookMethodStatus();
      }
    });

    return () => {
      unsubAdded();
      unsubRemoved();
    };
  }, [io, updateOutlookMethodStatus]);

  // Sync initial values when props change (e.g., when initialBody is loaded async)
  useEffect(() => {
    setEmail(prev => ({
      ...prev,
      subject: initialSubject,
      body: initialBody
    }));
  }, [initialSubject, initialBody]);
  const [status, setStatus] = useState<SendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement, SubmitEvent>) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      // Invoke the Outlook add-on's email method via interop
      // T42.SendEmail accepts: To, Subject, Body, HTMLBody, Cc, Bcc, AttachFiles, SendFrom
      await io.interop.invoke(OUTLOOK_METHOD, {
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
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
          disabled={status === 'sending' || !outlookServer.available}
          className={status === 'success' ? 'success' : ''}
        >
          {status === 'sending' && '📤 Sending...'}
          {status === 'success' && '✓ Email Created!'}
          {status === 'error' && '⚠ Try Again'}
          {status === 'idle' && !outlookServer.available && '⏳ Waiting for Outlook...'}
          {status === 'idle' && outlookServer.available && '📧 Send via Outlook'}
        </button>
      </div>

      {outlookServer.available && (
        <div className="server-info">
          ✓ Connected to Outlook on <strong>{outlookServer.machine || 'unknown'}</strong>
          {outlookServer.application && <span> ({outlookServer.application})</span>}
        </div>
      )}

      {!outlookServer.available && (
        <div className="warning-message">
          ⚠ Outlook method not available. Make sure io.Connect Desktop with the Outlook add-on is running and connected via io.Bridge.
        </div>
      )}

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
