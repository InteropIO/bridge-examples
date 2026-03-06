import { useState, useEffect } from 'react';
import { useIOConnect } from '@interopio/react-hooks';
import EmailForm from './components/EmailForm';
import './OutlookApp.css';

function getBrowserInfo(): string {
  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let version = '';

  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Edg/')) {
    browser = 'Microsoft Edge';
    version = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
  } else if (ua.includes('Safari/')) {
    browser = 'Safari';
    version = ua.match(/Version\/([\d.]+)/)?.[1] || '';
  }

  return `${browser} ${version}`;
}

function OutlookApp() {
  // io is initialized by the provider and exposed via react-hooks helper
  const io = useIOConnect((initializedIO) => initializedIO);
  const [initialBody, setInitialBody] = useState<string | null>(null);

  useEffect(() => {
    if (!io) return;

    const loadProfileData = async () => {
      const browserInfo = getBrowserInfo();

      try {
        // system.getProfileData is available in Browser platform
        const system = (io as any).system;
        if (system && typeof system.getProfileData === 'function') {
          const profileData = await system.getProfileData();
          const platformVersion = profileData.productsInfo?.platform?.apiVersion || io.version;

          setInitialBody(
            `This message is prepared from ${browserInfo} using io.Connect ${platformVersion} via Outlook.`
          );
        } else {
          // Fallback for Desktop or older versions
          setInitialBody(
            `This message is prepared from ${browserInfo} using io.Connect ${io.version} via Outlook.`
          );
        }
      } catch (err) {
        // Fallback to io.version if getProfileData fails
        setInitialBody(
          `This message is prepared from ${browserInfo} using io.Connect ${io.version} via Outlook.`
        );
      }
    };

    loadProfileData();
  }, [io]);

  if (!io || initialBody === null) {
    return (
      <div className="outlook-container">
        <div className="loading">Connecting to io.Connect...</div>
      </div>
    );
  }


  return (
    <div className="outlook-container">
      <header className="outlook-header">
        <h1>📧 Outlook Email Demo</h1>
        <p>Send emails via io.Bridge to Outlook</p>
      </header>
      <main className="outlook-main">
        <EmailForm
          io={io}
          initialSubject="Outlook Test"
          initialBody={initialBody}
        />
      </main>
    </div>
  );
}

export default OutlookApp;
