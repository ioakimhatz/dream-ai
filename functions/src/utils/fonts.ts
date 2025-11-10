// app/utils/fonts.ts - FONT HELPER FOR CROSS-PLATFORM
import { Platform } from 'react-native';

// Use this helper throughout your app for consistent fonts
export const fonts = {
  // Titles and Headers
  title: {
    fontSize: 45,
    fontWeight: Platform.OS === 'ios' ? '800' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  
  heading: {
    fontSize: 32,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  
  subheading: {
    fontSize: 22,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  
  // Body text
  bodyBold: {
    fontSize: 17,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  
  bodyMedium: {
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '500' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  bodyRegular: {
    fontSize: 16,
    fontWeight: Platform.OS === 'ios' ? '400' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  // Small text
  caption: {
    fontSize: 14,
    fontWeight: Platform.OS === 'ios' ? '500' : 'normal',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  
  // Button text
  button: {
    fontSize: 18,
    fontWeight: Platform.OS === 'ios' ? '600' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
};

// For Inter fonts specifically (in your auth screens)
export const getInterFont = (weight: '400' | '500' | '600' | '700' | '800' | '900') => {
  if (Platform.OS === 'ios') {
    return {
      fontFamily: 'Inter',
      fontWeight: weight,
    };
  }
  
  // Android mappings
  switch (weight) {
    case '900':
    case '800':
    case '700':
      return {
        fontFamily: 'sans-serif-black',
        fontWeight: 'bold',
      };
    case '600':
    case '500':
      return {
        fontFamily: 'sans-serif-medium',
        fontWeight: 'normal',
      };
    default:
      return {
        fontFamily: 'sans-serif',
        fontWeight: 'normal',
      };
  }
};