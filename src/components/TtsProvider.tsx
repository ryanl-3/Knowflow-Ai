"use client";

import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import TtsPlayer, { TtsPlayerRef } from './TtsPlayer';

interface TtsRequest {
  text: string;
  voiceName?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
  repeat?: number;
  source?: string;
}

interface TtsContextType {
  playText: (request: TtsRequest) => void;
  isPlayerVisible: boolean;
  showPlayer: () => void;
  hidePlayer: () => void;
}

const TtsContext = createContext<TtsContextType | undefined>(undefined);

export const useTts = () => {
  const context = useContext(TtsContext);
  if (!context) {
    throw new Error('useTts must be used within a TtsProvider');
  }
  return context;
};

interface TtsProviderProps {
  children: ReactNode;
}

export const TtsProvider: React.FC<TtsProviderProps> = ({ children }) => {
  const [isPlayerVisible, setIsPlayerVisible] = useState(false);
  const ttsPlayerRef = useRef<TtsPlayerRef>(null);

  const playText = (request: TtsRequest) => {
    if (ttsPlayerRef.current) {
      setIsPlayerVisible(true);
      ttsPlayerRef.current.playText(request);
    }
  };

  const showPlayer = () => {
    setIsPlayerVisible(true);
  };

  const hidePlayer = () => {
    setIsPlayerVisible(false);
  };

  return (
    <TtsContext.Provider value={{ playText, isPlayerVisible, showPlayer, hidePlayer }}>
      {children}
      <TtsPlayer
        ref={ttsPlayerRef}
        isVisible={isPlayerVisible}
        onClose={hidePlayer}
      />
    </TtsContext.Provider>
  );
}; 