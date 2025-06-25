import { CONSTANTS } from './constants.js';

const generateRandomId = (max = CONSTANTS.MAX_HEADER_ID) =>
  Math.floor(Math.random() * max) + 1;

export default generateRandomId;