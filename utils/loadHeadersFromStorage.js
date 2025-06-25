import { CONSTANTS } from './constants.js';

const loadHeadersFromStorage = async () => {
  try {
    const response = await chrome.storage.local.get([CONSTANTS.STORAGE_KEY]);
    if (!response[CONSTANTS.STORAGE_KEY]) return [];

    return JSON.parse(response[CONSTANTS.STORAGE_KEY]);
  } catch (error) {
    console.error('Error parsing headers from storage:', error);
    return [];
  }
};

export default loadHeadersFromStorage;