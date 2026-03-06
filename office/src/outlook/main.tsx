import ReactDOM from 'react-dom/client';
import { IOConnectProvider } from '@interopio/react-hooks';
import IOBrowser from '@interopio/browser';
import IOSearch from "@interopio/search-api";
import OutlookApp from './OutlookApp';
import '../index.css';

const settings = {
    browser: {
        config: {
            libraries: [IOSearch]
        },
        factory: IOBrowser
    }
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <IOConnectProvider settings={settings}>
        <OutlookApp/>
    </IOConnectProvider>
);
