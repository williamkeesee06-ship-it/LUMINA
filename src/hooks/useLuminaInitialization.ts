import { useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { fetchConstructionJobs } from '../services/smartsheet';
import { 
  fetchGmailUnreadCount, 
  fetchDriveFiles 
} from '../services/google';
import { useUIStore } from '../store/useUIStore';

export function useLuminaInitialization() {
  const { 
    setJobs, 
    setLoading, 
    setError, 
    setGoogleToken, 
    setUnreadCount, 
    setDriveFiles 
  } = useUIStore();

  // 1. Auth Logic
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setGoogleToken(token);
      
      try {
        const count = await fetchGmailUnreadCount(token);
        setUnreadCount(count);
        
        const files = await fetchDriveFiles(token);
        setDriveFiles(files);
      } catch (err) {
        console.error('[Lumina] Google Enrichment Error:', err);
      }
    },
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly'
  });

  // 2. Data Loading (Smartsheet)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchConstructionJobs();
        if (!mounted) return;
        
        const initializedData = data.map(j => ({
          ...j,
          moons: [],
          satellites: []
        }));
        setJobs(initializedData);
        setLoading(false);
      } catch (err: any) {
        if (!mounted) return;
        console.error('[Lumina] Smartsheet Load Failure:', err);
        setError("The primary data stream failed to initialize.");
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [setJobs, setLoading, setError]);

  return { login };
}

