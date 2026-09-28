import { CONSTANTS } from './constants.js';

const loadHeadersFromStorage = async () => {
  try {
    const response = await chrome.storage.local.get([CONSTANTS.STORAGE_KEY]);
    const raw = response[CONSTANTS.STORAGE_KEY];
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return JSON.parse(raw);
    return [];
  } catch (error) {
    return [];
  }
};

export default loadHeadersFromStorage;
