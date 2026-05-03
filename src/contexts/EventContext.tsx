import React, { createContext, useContext } from 'react';
import type { SnapLinkEventRecord } from '../lib/events';

interface EventContextValue {
  events: SnapLinkEventRecord[];
  activeEvent: SnapLinkEventRecord | null;
}

const EventContext = createContext<EventContextValue>({
  events: [],
  activeEvent: null,
});

export function EventProvider({
  value,
  children,
}: {
  value: EventContextValue;
  children: React.ReactNode;
}) {
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useSnapLinkEvents() {
  return useContext(EventContext);
}
