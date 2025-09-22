// app/(tabs)/library.tsx - FIXED DURATION DISPLAY
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deleteDream, getDreams, type DreamItem } from '../utils/storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Professional Video Player Modal Component - NO EMOJIS
function VideoPlayerModal({ 
  visible, 
  dream, 
  onClose, 
  onDreamDeleted 
}: {
  visible: boolean;
  dream: DreamItem | null;
  onClose: () => void;
  onDreamDeleted?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<Video>(null);

  // Get video URLs - prioritize stitched video over clips
  const getVideoUrls = () => {
    if (!dream) return [];
    
    // If there's a single stitched video, use that
    if (dream.videoUrl && typeof dream.videoUrl === 'string') {
      return [dream.videoUrl];
    }
    
    // Otherwise use clips
    if (dream.clips && Array.isArray(dream.clips) && dream.clips.length > 0) {
      return dream.clips;
    }
    
    return [];
  };

  const videoUrls = getVideoUrls();
  const currentVideoUrl = videoUrls[currentIndex] || videoUrls[0];
  const hasMultipleVideos = videoUrls.length > 1;

  // Auto-hide controls after 4 seconds
  useEffect(() => {
    if (showControls && visible && !isBuffering) {
      resetControlsTimer();
    }
    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, [showControls, visible, isBuffering]);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setIsPlaying(true);
      setShowControls(true);
      setCurrentIndex(0);
      setPosition(0);
      fadeAnim.setValue(1);
    }
  }, [visible, fadeAnim]);

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

  const handleVideoTap = () => {
    if (showControls) {
      hideControls();
    } else {
      showControlsAnimated();
    }
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
    if (!dream) return;
    
    try {
      const videoToShare = currentVideoUrl || (dream.clips?.[0]) || dream.videoUrl || '';
      
      if (videoToShare.startsWith('file://')) {
        await Sharing.shareAsync(videoToShare, {
          dialogTitle: `Share Dream: ${createShortTitle(dream.prompt)}`,
          mimeType: 'video/mp4',
        });
      } else {
        await Share.share({
          message: `Check out my dream: "${dream.prompt}" - Created with Dream AI`,
          url: videoToShare,
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
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

      if (currentVideoUrl && currentVideoUrl.startsWith('file://')) {
        const asset = await MediaLibrary.createAssetAsync(currentVideoUrl);
        Alert.alert('Success', 'Video saved to your gallery!');
      } else {
        Alert.alert('Info', 'Video download not available');
      }
    } catch (error) {
      console.error('Error downloading video:', error);
      Alert.alert('Error', 'Failed to save video');
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

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!dream || !visible) return null;

  // If no video URLs, show processing placeholder
  if (videoUrls.length === 0) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <StatusBar hidden />
        <View style={modalStyles.container}>
          <View style={modalStyles.videoContainer}>
            <TouchableOpacity 
              style={modalStyles.videoPlaceholder}
              activeOpacity={1}
              onPress={handleVideoTap}
            >
              <View style={modalStyles.processingIcon}>
                <Ionicons name="videocam-outline" size={80} color="rgba(255,255,255,0.6)" />
              </View>
              <Text style={modalStyles.videoPlaceholderText}>
                Video Processing...
              </Text>
              <Text style={modalStyles.dreamPrompt}>"{dream.prompt}"</Text>
            </TouchableOpacity>
          </View>

          {/* Simple close button for processing state */}
          <View style={modalStyles.processingCloseContainer}>
            <TouchableOpacity onPress={onClose} style={modalStyles.processingCloseButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={modalStyles.container}>
        {/* Video Player Container */}
        <View style={modalStyles.videoContainer}>
          <TouchableOpacity 
            style={modalStyles.videoTouchArea}
            activeOpacity={1}
            onPress={handleVideoTap}
          >
            <Video
              ref={videoRef}
              source={{ uri: currentVideoUrl }}
              style={modalStyles.video}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isPlaying}
              isLooping={!hasMultipleVideos}
              onPlaybackStatusUpdate={onPlaybackStatusUpdate}
            />

            {/* Loading Indicator */}
            {isBuffering && (
              <View style={modalStyles.loadingOverlay}>
                <View style={modalStyles.loadingSpinner} />
                <Text style={modalStyles.loadingText}>Loading...</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Professional Controls Overlay */}
        {showControls && (
          <Animated.View style={[modalStyles.controlsOverlay, { opacity: fadeAnim }]}>
            {/* Top Controls Bar */}
            <LinearGradient
              colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)', 'transparent']}
              style={[modalStyles.topControls, { paddingTop: insets.top + 10 }]}
            >
              {/* Close Button */}
              <TouchableOpacity onPress={onClose} style={modalStyles.controlButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Title */}
              <View style={modalStyles.titleContainer}>
                <Text style={modalStyles.videoTitle} numberOfLines={1}>
                  {createShortTitle(dream.prompt)}
                </Text>
                {hasMultipleVideos && (
                  <Text style={modalStyles.videoSubtitle}>
                    Scene {currentIndex + 1} of {videoUrls.length}
                  </Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={modalStyles.topActions}>
                <TouchableOpacity onPress={handleShare} style={modalStyles.controlButton}>
                  <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDownload} style={modalStyles.controlButton}>
                  <Ionicons name="download-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={modalStyles.controlButton}>
                  <Ionicons name="trash-outline" size={22} color="#FF4444" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Center Play Controls */}
            <View style={modalStyles.centerControls}>
              {hasMultipleVideos && currentIndex > 0 && (
                <TouchableOpacity onPress={skipBackward} style={modalStyles.skipButton}>
                  <Ionicons name="play-skip-back" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={togglePlayPause} style={modalStyles.playButton}>
                <Ionicons 
                  name={isPlaying ? "pause" : "play"} 
                  size={36} 
                  color="#000000" 
                  style={!isPlaying ? { marginLeft: 4 } : {}}
                />
              </TouchableOpacity>

              {hasMultipleVideos && currentIndex < videoUrls.length - 1 && (
                <TouchableOpacity onPress={skipForward} style={modalStyles.skipButton}>
                  <Ionicons name="play-skip-forward" size={32} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom Controls Bar */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
              style={[modalStyles.bottomControls, { paddingBottom: insets.bottom + 20 }]}
            >
              {/* Dream Info */}
              <View style={modalStyles.dreamInfo}>
                <Text style={modalStyles.dreamTitle} numberOfLines={2}>
                  {dream.prompt}
                </Text>
                <Text style={modalStyles.dreamDate}>
                  {formatDate(dream.createdAt)}
                </Text>
              </View>

              {/* Progress Bar */}
              <View style={modalStyles.progressContainer}>
                <Text style={modalStyles.timeText}>{formatTime(position)}</Text>
                
                <View style={modalStyles.progressBarContainer}>
                  <View style={modalStyles.progressTrack} />
                  <View 
                    style={[
                      modalStyles.progressFill, 
                      { width: duration > 0 ? `${(position / duration) * 100}%` : '0%' }
                    ]} 
                  />
                </View>
                
                <Text style={modalStyles.timeText}>{formatTime(duration)}</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

// Main Library Screen Component
export default function LibraryScreen() {
  const [items, setItems] = useState<DreamItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDream, setSelectedDream] = useState<DreamItem | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    try {
      const list = await getDreams();
      setItems([...list].sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) {
      console.error('Failed to load dreams', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDreamPress = (dream: DreamItem) => {
    setSelectedDream(dream);
    setPlayerVisible(true);
  };

  const handlePlayerClose = () => {
    setPlayerVisible(false);
    setSelectedDream(null);
  };

  const handleDreamDeleted = () => {
    load();
  };

  const createShortTitle = (prompt: string): string => {
    if (!prompt) return 'Untitled Dream';
    
    const sentences = prompt.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();
    
    if (!firstSentence) return 'Untitled Dream';
    if (firstSentence.length <= 40) return firstSentence;
    
    const words = firstSentence.split(' ');
    let title = '';
    for (const word of words) {
      if ((title + word).length > 35) break;
      title += (title ? ' ' : '') + word;
    }
    
    return title + (title.length < firstSentence.length ? '...' : '');
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const renderDreamItem = ({ item }: { item: DreamItem }) => {
    // Check if this is a stitched video (has multiple clips or a single videoUrl)
    const hasMultipleClips = Boolean(item.clips && Array.isArray(item.clips) && item.clips.length > 1);
    const isStitched = hasMultipleClips || Boolean(item.videoUrl && typeof item.videoUrl === 'string');
    
    return (
      <TouchableOpacity 
        style={styles.videoCard} 
        activeOpacity={0.9}
        onPress={() => handleDreamPress(item)}
      >
        {/* Netflix-Style 16:9 Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {item.coverUrl && typeof item.coverUrl === 'string' ? (
            <Image source={{ uri: item.coverUrl }} style={styles.thumbnail} />
          ) : (
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.placeholderThumbnail}
            >
              <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          )}
          
          {/* Netflix Play Button Overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={16} color="#7C86FF" />
            </View>
          </View>
          
          {/* Cinema Badge for multi-clip videos */}
          {hasMultipleClips && (
            <LinearGradient
              colors={['#FF6B6B', '#FF8E8E']}
              style={styles.cinemaBadge}
            >
              <Text style={styles.cinemaText}>CINEMA</Text>
            </LinearGradient>
          )}
          
          {/* Duration Badge - Show "Dream Movie" for stitched videos */}
          {isStitched ? (
            <LinearGradient
              colors={['#7C86FF', '#9D6FFF']}
              style={styles.movieBadge}
            >
              <Ionicons name="film-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.movieText}>Dream Movie</Text>
            </LinearGradient>
          ) : (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>6s</Text>
            </View>
          )}
        </View>
        
        {/* Video Info */}
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {createShortTitle(item.prompt)}
          </Text>
          <Text style={styles.videoDate}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
      {/* FIX: Status Bar Configuration for Android */}
      <StatusBar 
        translucent={Platform.OS === 'android'}
        backgroundColor="transparent"
        barStyle="light-content"
      />
      
      {/* FIX: Custom SafeAreaView handling for Android */}
      <View style={{ 
        flex: 1,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : insets.top,
      }}>
        {/* ORIGINAL TITLE DESIGN */}
        <Text style={styles.title}>Your Dreams</Text>
        
        <FlatList
          data={items}
          keyExtractor={(d) => d.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="moon" size={48} color="rgba(255,255,255,0.8)" />
              <Text style={styles.emptyText}>No dreams yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first dream video from the Home tab!
              </Text>
            </View>
          }
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Platform.OS === 'android' ? 100 : 28, // More padding for Android tab bar
            flexGrow: 1,
          }}
          renderItem={renderDreamItem}
          showsVerticalScrollIndicator={false}
        />

        {/* Professional Video Player Modal */}
        <VideoPlayerModal
          visible={playerVisible}
          dream={selectedDream}
          onClose={handlePlayerClose}
          onDreamDeleted={handleDreamDeleted}
        />
      </View>
    </LinearGradient>
  );
}

// Professional Modal Styles with Android Font Fixes
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  
  videoTouchArea: {
    flex: 1,
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
    fontWeight: Platform.OS === 'ios' ? '500' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  videoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  
  processingIcon: {
    marginBottom: 20,
  },
  
  videoPlaceholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    marginBottom: 16,
    textAlign: 'center',
  },
  
  dreamPrompt: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  processingCloseContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  
  processingCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    marginBottom: 2,
  },
  
  videoSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: Platform.OS === 'ios' ? '400' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
  
  dreamInfo: {
    marginBottom: 16,
  },
  
  dreamTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    lineHeight: 22,
    marginBottom: 4,
  },
  
  dreamDate: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: Platform.OS === 'ios' ? '500' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
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
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
});

// Library Styles with Android Font Fixes
const styles = StyleSheet.create({
  title: {
    fontSize: Platform.OS === 'android' ? 40 : 45,
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    color: '#fff',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 8 : 4,
    paddingBottom: Platform.OS === 'android' ? 16 : 24,
  },
  
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  
  videoCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16/9,
  },
  
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  cinemaBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  
  cinemaText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: 0.8,
  },
  
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  
  durationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },

  movieBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },

  movieText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    letterSpacing: 0.3,
  },
  
  videoInfo: {
    padding: 16,
  },
  
  videoTitle: {
    fontSize: 15,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    color: '#1A1A1A',
    lineHeight: 20,
    marginBottom: 6,
  },
  
  videoDate: {
    fontSize: 12,
    fontWeight: Platform.OS === 'ios' ? '500' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    color: '#666666',
  },
  
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  
  emptyText: {
    fontSize: 24,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    color: 'rgba(255,255,255,0.95)',
    marginTop: 20,
    marginBottom: 12,
  },
  
  emptySubtext: {
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '400' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 24,
  },
});

// Utility function
const createShortTitle = (prompt: string): string => {
  if (!prompt) return 'Untitled Dream';
  
  const sentences = prompt.split(/[.!?]+/);
  const firstSentence = sentences[0]?.trim();
  
  if (!firstSentence) return 'Untitled Dream';
  if (firstSentence.length <= 40) return firstSentence;
  
  const words = firstSentence.split(' ');
  let title = '';
  for (const word of words) {
    if ((title + word).length > 35) break;
    title += (title ? ' ' : '') + word;
  }
  
  return title + (title.length < firstSentence.length ? '...' : '');
};