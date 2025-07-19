"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  Repeat, 
  X,
  ChevronUp,
  ChevronDown,
  Settings
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n';

export interface TtsPlayerProps {
  isVisible: boolean;
  onClose: () => void;
}

interface TtsRequest {
  text: string;
  voiceName?: string;
  rate?: string;
  pitch?: string;
  volume?: string;
  repeat?: number;
  source?: string; // "message" | "document" | "vocabulary"
}

export interface TtsPlayerRef {
  playText: (request: TtsRequest) => void;
}

const TtsPlayer = React.forwardRef<TtsPlayerRef, TtsPlayerProps>(
  ({ isVisible, onClose }, ref) => {
    const { t } = useTranslation();
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentText, setCurrentText] = useState<string>('');
    const [currentSource, setCurrentSource] = useState<string>('');
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(70);
    const [isExpanded, setIsExpanded] = useState(false);
    
    // 添加定时器引用
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // TTS Settings
    const [voiceName, setVoiceName] = useState('en-US-AvaMultilingualNeural');
    const [rate, setRate] = useState('medium');
    const [repeatCount, setRepeatCount] = useState(1);
    const [currentRepeat, setCurrentRepeat] = useState(0);
    
    const audioRef = useRef<HTMLAudioElement>(null);
    const currentRequestRef = useRef<TtsRequest | null>(null);

    // Expose methods through ref
    React.useImperativeHandle(ref, () => ({
      playText: (request: TtsRequest) => {
        currentRequestRef.current = request;
        setCurrentText(request.text);
        setCurrentSource(request.source || 'text');
        setRepeatCount(request.repeat || 1);
        setCurrentRepeat(0);
        playAudio(request);
      }
    }));

    const playAudio = React.useCallback(async (request: TtsRequest) => {
      if (!request.text) return;
      
      setIsLoading(true);
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: request.text,
            voiceName: request.voiceName || voiceName,
            rate: request.rate || rate,
            pitch: 'medium',
            volume: 'medium',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate speech');
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.volume = volume / 100;
          
          // 添加音频事件监听器
          audioRef.current.addEventListener('loadedmetadata', () => {
            console.log('Audio metadata loaded:', audioRef.current?.duration);
            setDuration(audioRef.current?.duration || 0);
          });
          
          await audioRef.current.play();
          setIsPlaying(true);
          
          // 启动进度更新定时器
          startProgressTimer();
        }
      } catch (error) {
        console.error('TTS error:', error);
      } finally {
        setIsLoading(false);
      }
    }, [volume, voiceName, rate]);

    const handlePlay = () => {
      if (audioRef.current && currentRequestRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
          setIsPlaying(true);
          startProgressTimer();
        } else {
          audioRef.current.pause();
          setIsPlaying(false);
          stopProgressTimer();
        }
      }
    };

    const handleStop = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        stopProgressTimer();
      }
    };

    const handleRepeat = () => {
      if (currentRequestRef.current) {
        playAudio(currentRequestRef.current);
      }
    };

    const handleVolumeChange = (delta: number) => {
      const newVolume = Math.max(0, Math.min(100, volume + delta));
      setVolume(newVolume);
      if (audioRef.current) {
        audioRef.current.volume = newVolume / 100;
      }
    };

    // 启动进度更新定时器
    const startProgressTimer = () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      
      progressTimerRef.current = setInterval(() => {
        if (audioRef.current && !audioRef.current.paused) {
          const current = audioRef.current.currentTime;
          const duration = audioRef.current.duration;
          
          if (duration && current >= 0) {
            const progressPercent = (current / duration) * 100;
            setProgress(progressPercent);
            setCurrentTime(current);
            console.log(`Timer Progress: ${progressPercent}%, Current: ${current}s, Duration: ${duration}s`);
          }
        }
      }, 100); // 每100ms更新一次
    };

    // 停止进度更新定时器
    const stopProgressTimer = () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const updateProgress = () => {
        if (audio.duration && audio.currentTime >= 0) {
          const progressPercent = (audio.currentTime / audio.duration) * 100;
          setProgress(progressPercent);
          setCurrentTime(audio.currentTime);
          console.log(`Progress: ${progressPercent}%, Current: ${audio.currentTime}s, Duration: ${audio.duration}s`);
        }
      };

      const handleLoadedMetadata = () => {
        setDuration(audio.duration || 0);
        setCurrentTime(0);
        setProgress(0);
      };

      const handleLoadStart = () => {
        setProgress(0);
        setCurrentTime(0);
      };

      const handleCanPlay = () => {
        setDuration(audio.duration || 0);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        stopProgressTimer();
        
        // Handle repeat
        if (currentRepeat < repeatCount - 1) {
          setCurrentRepeat(prev => prev + 1);
          setTimeout(() => {
            if (currentRequestRef.current) {
              playAudio(currentRequestRef.current);
            }
          }, 500);
        }
      };

      audio.addEventListener('timeupdate', updateProgress);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', updateProgress);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('ended', handleEnded);
        stopProgressTimer();
      };
    }, [currentRepeat, repeatCount, playAudio]);

    if (!isVisible) return null;

    const formatTime = (seconds: number) => {
      if (!seconds || isNaN(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
      <>
        <audio ref={audioRef} style={{ display: 'none' }} />
        
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
          <Card className="mx-auto max-w-4xl bg-background/95 backdrop-blur-md shadow-lg border">
            <CardContent className="p-4">
              {/* Main Controls */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isPlaying ? "default" : "outline"}
                    onClick={handlePlay}
                    disabled={isLoading || !currentText}
                  >
                    {isLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStop}
                    disabled={!currentText}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRepeat}
                    disabled={!currentText}
                  >
                    <Repeat className="h-4 w-4" />
                  </Button>
                  
                  {repeatCount > 1 && (
                    <Badge variant="secondary" className="text-xs">
                      {currentRepeat + 1}/{repeatCount}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-1"
                    title="Voice & Speed Settings"
                  >
                    <Settings className="h-4 w-4" />
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onClose}
                    title="Close TTS Player"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 relative">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  />
                  {/* Progress indicator */}
                  {progress > 0 && (
                    <div 
                      className="absolute top-0 w-1 h-2 bg-blue-800 rounded-full transition-all duration-150 ease-out"
                      style={{ left: `${Math.max(0, Math.min(100, progress))}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span className="text-gray-400">
                    {progress > 0 ? `${Math.round(progress)}%` : ''}
                  </span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Current Text */}
              <div className="mb-2">
                <div className="text-sm text-gray-600 mb-1 flex items-center gap-2">
                  <span>Reading:</span>
                  <Badge variant="outline" className="text-xs">
                    {currentSource}
                  </Badge>
                                     {currentText.length > 200 && (
                     <Badge variant="secondary" className="text-xs">
                       {currentText.length} {t('tts.characters')}
                     </Badge>
                   )}
                </div>
                <div className="text-sm bg-gray-50 rounded p-2 max-h-20 overflow-y-auto">
                  <div className="whitespace-pre-wrap break-words">
                    {currentText}
                  </div>
                                     {currentText.length > 500 && (
                     <div className="text-xs text-gray-500 mt-1 pt-1 border-t">
                       📢 {t('tts.playingFullContent')} ({currentText.length} {t('tts.characters')})
                     </div>
                   )}
                </div>
              </div>

              {/* Simple Volume Control */}
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="h-4 w-4 text-gray-500" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVolumeChange(-10)}
                  disabled={volume <= 0}
                >
                  -
                </Button>
                <span className="text-xs text-gray-500 w-12 text-center">{volume}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVolumeChange(10)}
                  disabled={volume >= 100}
                >
                  +
                </Button>
              </div>

              {/* Extended Controls */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Voice Selection */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Voice</label>
                      <select 
                        value={voiceName} 
                        onChange={(e) => setVoiceName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-background"
                      >
                        <option value="en-US-AvaMultilingualNeural">Ava (English, Multilingual)</option>
                        <option value="en-US-AndrewMultilingualNeural">Andrew (English, Multilingual)</option>
                        <option value="en-US-EmmaMultilingualNeural">Emma (English, Multilingual)</option>
                        <option value="en-US-BrianMultilingualNeural">Brian (English, Multilingual)</option>
                        <option value="zh-CN-XiaoxiaoMultilingualNeural">Xiaoxiao (Chinese, Multilingual)</option>
                        <option value="zh-CN-YunxiMultilingualNeural">Yunxi (Chinese, Multilingual)</option>
                        <option value="zh-CN-YunyeMultilingualNeural">Yunye (Chinese, Multilingual)</option>
                      </select>
                    </div>
                    
                    {/* Speed Selection */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Speed</label>
                      <select 
                        value={rate} 
                        onChange={(e) => setRate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-background"
                      >
                        <option value="x-slow">Very Slow</option>
                        <option value="slow">Slow</option>
                        <option value="medium">Normal</option>
                        <option value="fast">Fast</option>
                        <option value="x-fast">Very Fast</option>
                      </select>
                    </div>
                    
                    {/* Repeat Selection */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Repeat</label>
                      <select 
                        value={repeatCount.toString()} 
                        onChange={(e) => setRepeatCount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-background"
                      >
                        <option value="1">1 time</option>
                        <option value="2">2 times</option>
                        <option value="3">3 times</option>
                        <option value="5">5 times</option>
                        <option value="10">10 times</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <p>• Quality: High (Neural voices)</p>
                    <p>• Format: MP3</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }
);

TtsPlayer.displayName = 'TtsPlayer';

export default TtsPlayer; 