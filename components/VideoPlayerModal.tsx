// components/VideoPlayerModal.tsx - SIMPLIFIED VERSION
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Modal,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DreamItem {
  id: string;
  prompt: string;
  videoUrl?: string | null;
  coverUrl?: string | null;
  createdAt: number;
  duration?: number;
}

interface VideoPlayerModalProps {
  visible: boolean;
  dream: DreamItem | null;
  onClose: () => void;
  onDreamDeleted?: () => void;
}

export default function VideoPlayerModal({ 
  visible, 
  dream, 
  onClose, 
  onDreamDeleted 
}: VideoPlayerModalProps) {
  const insets = useSafeAreaInsets();
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Auto-hide controls after 3 seconds
  useEffect(() => {
    if (showControls && visible) {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
      controlsTimer.current = setTimeout(() => {
        hideControls();
      }, 3000);
    }
    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [showControls, visible, fadeAnim]);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setIsPlaying(true);
      setShowControls(true);
      fadeAnim.setValue(1);
    }
  }, [visible, fadeAnim]);

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
  };

  const handleVideoTap = () => {
    if (showControls) {
      hideControls();
    } else {
      showControlsAnimated();
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    showControlsAnimated();
  };

  const handleShare = async () => {
    if (!dream) return;
    
    try {
      await Share.share({
        message: `Check out my dream: "${dream.prompt}" - Created with Dream AI`,
        url: dream.videoUrl || '',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDelete = async () => {
    if (!dream) return;

    Alert.alert(
      'Delete Dream',
      'Are you sure you want to delete this dream? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Import and call delete function
              const { deleteDream } = require('../utils/storage');
              await deleteDream(dream.id);
              onDreamDeleted?.();
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete dream');
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!dream || !visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* Video Placeholder */}
        <TouchableOpacity 
          style={styles.videoContainer}
          activeOpacity={1}
          onPress={handleVideoTap}
        >
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderIcon}>🎬</Text>
            <Text style={styles.videoPlaceholderText}>
              {dream.videoUrl ? 'Video Player Coming Soon' : 'Video Processing...'}
            </Text>
            <Text style={styles.dreamPrompt}>"{dream.prompt}"</Text>
          </View>
        </TouchableOpacity>

        {/* Controls Overlay */}
        {showControls && (
          <Animated.View 
            style={[styles.controlsOverlay, { opacity: fadeAnim }]}
            pointerEvents="box-none"
          >
            {/* Top Controls */}
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent']}
              style={[styles.topControls, { paddingTop: insets.top + 10 }]}
            >
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
              
              <View style={styles.topActions}>
                <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                  <Text style={styles.actionIcon}>↗</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.actionButton}>
                  <Text style={styles.actionIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Center Play Button */}
            <View style={styles.centerControls}>
              <TouchableOpacity onPress={handlePlayPause} style={styles.playButton}>
                <Text style={styles.playIcon}>
                  {isPlaying ? '⏸' : '▶'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={[styles.bottomControls, { paddingBottom: insets.bottom + 20 }]}
            >
              {/* Dream Info */}
              <View style={styles.dreamInfo}>
                <Text style={styles.dreamTitle} numberOfLines={2}>
                  {dream.prompt}
                </Text>
                <Text style={styles.dreamDate}>
                  {formatDate(dream.createdAt)}
                </Text>
              </View>

              {/* Mock Progress Bar */}
              <View style={styles.progressContainer}>
                <Text style={styles.timeText}>0:00</Text>
                
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressTrack} />
                  <View style={[styles.progressFill, { width: '30%' }]} />
                </View>
                
                <Text style={styles.timeText}>0:08</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  videoPlaceholder: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  
  videoPlaceholderIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  
  videoPlaceholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  
  dreamPrompt: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
  
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'box-none',
  },
  
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    height: 80,
  },
  
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  closeIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  
  topActions: {
    flexDirection: 'row',
    gap: 12,
  },
  
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  actionIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  
  playIcon: {
    fontSize: 24,
    color: '#7278E6',
    marginLeft: 2,
  },
  
  bottomControls: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  
  dreamInfo: {
    marginBottom: 16,
  },
  
  dreamTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  
  dreamDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 35,
    textAlign: 'center',
  },
  
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  
  progressTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  
  progressFill: {
    height: '100%',
    backgroundColor: '#7278E6',
    borderRadius: 2,
  },
});