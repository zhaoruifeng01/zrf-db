import { useEffect } from 'react';
import { useNavigate } from 'react-router';

/**
 * Index route - redirects to the health smoke route on the client.
 *
 * SPA mode (ssr: false) does not support `loader`, so we cannot use a server
 * redirect. Real home page lands here once the chat/dashboard domain migrates.
 */
export default function IndexRoute() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/health', { replace: true });
  }, [navigate]);
  return null;
}
