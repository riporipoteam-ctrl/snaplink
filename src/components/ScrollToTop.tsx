import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Also scroll all scrollable containers
    document.querySelectorAll('main, [role="main"]').forEach(el => {
      el.scrollTo(0, 0);
    });
  }, [pathname]);

  return null;
}
