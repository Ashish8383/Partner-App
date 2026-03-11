import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey:      'AIzaSyDY9RyKyjOxzQ7fU1mMn22riMeIyL_KlDc',
  authDomain:  'partner-console-sandbox.firebaseapp.com',
  databaseURL: 'https://partner-console-sandbox-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:   'partner-console-sandbox',
  appId:       '1:1025748391482:web:26b63ccce1e750bdae4703',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getDatabase(app);