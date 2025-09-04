// components/ProfessionalVideoPlayer.tsx - NETFLIX-STYLE CINEMATIC PLAYER
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ProfessionalVideoPlayerProps {
  videoUrls: string[];
  title?: string;
  onClose: () => void;
  onDelete?: () => void;
  autoPlay?: boolean;
}

export const ProfessionalVideoPlayer: React.FC<ProfessionalVideoPlayerProps> = ({
  videoUrls,
  title = "Dream Video",
  onClose,
  onDelete,
  autoPlay = true,
}) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [showControls, setShowControls] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const videoRef = useRef<Video>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentVideoUrl = videoUrls[currentIndex] || videoUrls[0];
  const hasMultipleVideos = videoUrls.length > 1;

  // Auto-hide controls
  useEffect(() => {
    if (showControls && !isBuffering) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [showControls, isBuffering]);

  const resetControlsTimer = () => {
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }
    controlsTimer.current = setTimeout(() => {
      hideControls();
    }, 4000);
  };

  const hideControls = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowControls(false));
  };

  const showControlsAnimated = () => {
    setShowControls(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    resetControlsTimer();
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
      showControlsAnimated();
    }
  };

  const skipForward = () => {
    if (hasMultipleVideos && currentIndex < videoUrls.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setPosition(0);
    } else if (videoRef.current) {
      videoRef.current.setPositionAsync(Math.min(position + 10000, duration));
    }
    showControlsAnimated();
  };

  const skipBackward = () => {
    if (hasMultipleVideos && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setPosition(0);
    } else if (videoRef.current) {
      videoRef.current.setPositionAsync(Math.max(position - 10000, 0));
    }
    showControlsAnimated();
  };

  const handleShare = async () => {
    try {
      if (currentVideoUrl.startsWith('file://')) {
        // Local file - use native sharing
        await Sharing.shareAsync(currentVideoUrl, {
          dialogTitle: `Share Dream: ${title}`,
          mimeType: 'video/mp4',
        });
      } else {
        // URL - share link
        await Sharing.shareAsync(currentVideoUrl);
      }
    } catch (error) {
      console.error('Error sharing video:', error);
      Alert.alert('Error', 'Failed to share video');
    }
  };

  const handleDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save videos to your gallery');
        return;
      }

      if (currentVideoUrl.startsWith('file://')) {
        const asset = await MediaLibrary.createAssetAsync(currentVideoUrl);
        Alert.alert('Success', 'Video saved to your gallery!');
      } else {
        Alert.alert('Info', 'Video download from URL not supported');
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      Alert.alert('Error', 'Failed to save video');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDelete,
        },
      ]
    );
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      setIsBuffering(status.isBuffering || false);
      
      if (status.didJustFinish && hasMultipleVideos && currentIndex < videoUrls.length - 1) {
        // Auto-advance to next video
        setTimeout(() => {
          setCurrentIndex(currentIndex + 1);
          setPosition(0);
        }, 500);
      }
    }
  };

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleVideoPress = () => {
    if (showControls) {
      hideControls();
    } else {
      showControlsAnimated();
    }
  };

  const handleSeek = async (value: number) => {
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(value * duration);
      showControlsAnimated();
    }
  };

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <TouchableOpacity 
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={handleVideoPress}
      >
        <Video
          ref={videoRef}
          source={{ uri: currentVideoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={isPlaying}
          isLooping={!hasMultipleVideos}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />

        {/* Loading Indicator */}
        {isBuffering && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingSpinner} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* Professional Controls Overlay */}
        {showControls && (
          <Animated.View style={[styles.controlsOverlay, { opacity: fadeAnim }]}>
            {/* Top Controls Bar */}
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'transparent']}
              style={[styles.topControls, { paddingTop: insets.top + 10 }]}
            >
              {/* Close Button */}
              <TouchableOpacity onPress={onClose} style={styles.controlButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  {title}
                </Text>
                {hasMultipleVideos && (
                  <Text style={styles.videoSubtitle}>
                    Scene {currentIndex + 1} of {videoUrls.length}
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.topActions}>
                <TouchableOpacity onPress={handleShare} style={styles.controlButton}>
                  <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDownload} style={styles.controlButton}>
                  <Ionicons name="download-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                {onDelete && (
                  <TouchableOpacity onPress={handleDelete} style={styles.controlButton}>
                    <Ionicons name="trash-outline" size={22} color="#FF4444" />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>

            {/* Center Play Controls */}
            <View style={styles.centerControls}>
              {hasMultipleVideos && currentIndex > 0 && (
                <TouchableOpacity onPress={skipBackward} style={styles.skipButton}>
                  <Ionicons name="play-skip-back" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={36} 
                  color="#000000" 
                  style={!isPlaying ? { marginLeft: 4 } : {}}
                />
              </TouchableOpacity>

              {hasMultipleVideos && currentIndex < videoUrls.length - 1 && (
                <TouchableOpacity onPress={skipForward} style={styles.skipButton}>
                  <Ionicons name="play-skip-forward" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom Controls Bar */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
              style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}
            >
              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressTrack} />
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: duration > 0 ? `${(position / duration) * 100}%` : '0%' }
                    ]} 
                  />
                  <TouchableOpacity
                    style={[
                      styles.progressThumb,
                      { left: duration > 0 ? `${(position / duration) * 100}%` : '0%' }
                    ]}
                    onPress={(e) => {
                      const percentage = (e.nativeEvent.locationX || 0) / SCREEN_WIDTH;
                      handleSeek(percentage);
                    }}
                  />
                </View>
                
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              {/* Additional Controls */}
              <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.controlButton}>
                  <Ionicons name="volume-medium" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                
                <View style={styles.spacer} />
                
                <TouchableOpacity style={styles.controlButton}>
                  <Ionicons name="expand-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  
  video: {
    width: '100%',
    height: '100%',
  },
  
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingSpinner: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: '#FFFFFF30',
    borderTopColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
  },
  
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  
  topControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 60,
  },
  
  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  
  videoSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '400',
  },
  
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  skipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  bottomControls: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  
  timeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
  
  progressThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF0000',
    top: -6,
    marginLeft: -8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  spacer: {
    flex: 1,
  },
});