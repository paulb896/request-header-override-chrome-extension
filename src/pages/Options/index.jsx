import React from 'react';
import { render } from 'react-dom';

import Popup from '../Popup/Popup';
import '../Popup/index.css';
import './index.css';

render(
  <Popup isOptionsPage={true} />,
  window.document.querySelector('#app-container')
);

if (module.hot) module.hot.accept();
