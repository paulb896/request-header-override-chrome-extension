import React from 'react';
import './Popup.css';
import RequestHeadersApp from './components/RequestHeadersApp';

const DATA = [];

const Popup = () => {
  return (
    <React.StrictMode>
      <RequestHeadersApp headers={DATA} />
    </React.StrictMode>
  );
};

export default Popup;
