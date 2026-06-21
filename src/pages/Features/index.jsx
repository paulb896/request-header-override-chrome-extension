import React from 'react';
import { render } from 'react-dom';

import Features from './Features';
import '../Popup/index.css';
import './index.css';

render(<Features />, window.document.querySelector('#app-container'));

if (module.hot) module.hot.accept();
