import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MeetingProvider } from './contexts/MeetingContext';
import { EntranceAnimation } from './components/layout/EntranceAnimation';
import { MeetingWidget } from './components/ui/MeetingWidget';
import { ScrollToTop } from './components/ScrollToTop';
import { AnimatedRoutes } from './AnimatedRoutes';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MeetingProvider>
          <EntranceAnimation>
            <BrowserRouter>
              <ScrollToTop />
              <AnimatedRoutes />
              <MeetingWidget />
            </BrowserRouter>
          </EntranceAnimation>
        </MeetingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
